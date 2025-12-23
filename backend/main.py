"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio
import os

from .council import (
    generate_conversation_title,
    stage1_collect_responses,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings,
)
from .openrouter import fetch_available_models

app = FastAPI(title="LLM Council API")

# Enable CORS (tighten in public deployments)
#
# For production, set ALLOWED_ORIGINS to a comma-separated list, e.g.:
# ALLOWED_ORIGINS=https://your-app.example,https://your-app.vercel.app
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
    if _allowed_origins_env
    else [
        "http://localhost:5173",  # Local development
        "http://localhost:3000",  # Alternative local port
    ]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str

class ModelConfigPayload(BaseModel):
    council_models: List[str]
    chairman_model: str
    presets: Optional[Dict[str, Any]] = None

class CouncilStreamRequest(BaseModel):
    """Request to run the council process (stateless)."""
    content: str
    # Pydantic v2 reserves `model_config`; keep wire format as `model_config` via alias.
    model_cfg: ModelConfigPayload = Field(alias="model_config")
    # Optional future extension; not used by current orchestration prompts
    conversation_context: Optional[List[Dict[str, Any]]] = None

    model_config = {
        "populate_by_name": True,
    }

class ModelInfo(BaseModel):
    """Information about an available model."""
    id: str
    name: str
    description: str
    pricing: Dict[str, Any]
    context_length: Optional[int]
    supported_parameters: List[str]
    provider: str
    created: Optional[int]


def _require_openrouter_key(x_openrouter_api_key: Optional[str]) -> str:
    if not x_openrouter_api_key:
        raise HTTPException(status_code=400, detail="Missing X-OpenRouter-Api-Key header")
    return x_openrouter_api_key


# Very small in-memory throttling to reduce abuse on a public proxy.
_RATE_WINDOW_SEC = 30
_RATE_MAX_REQS = 30
_rate_state: Dict[str, List[float]] = {}


def _check_rate_limit(client_ip: str):
    import time

    now = time.time()
    window_start = now - _RATE_WINDOW_SEC
    bucket = _rate_state.get(client_ip, [])
    bucket = [t for t in bucket if t >= window_start]
    if len(bucket) >= _RATE_MAX_REQS:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    bucket.append(now)
    _rate_state[client_ip] = bucket


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/models", response_model=List[ModelInfo])
async def get_available_models(
    request: Request,
    x_openrouter_api_key: Optional[str] = Header(default=None),
):
    """Get list of available models from OpenRouter (stateless, user-keyed)."""
    _check_rate_limit(request.client.host if request.client else "unknown")
    api_key = _require_openrouter_key(x_openrouter_api_key)
    models = await fetch_available_models(api_key=api_key)
    if models is None:
        raise HTTPException(status_code=503, detail="Unable to fetch models from OpenRouter")
    return models


@app.post("/api/council/stream")
async def council_stream(
    request: Request,
    body: CouncilStreamRequest,
    x_openrouter_api_key: Optional[str] = Header(default=None),
):
    """
    Run the 3-stage council process (stateless) and stream it via SSE.
    """
    _check_rate_limit(request.client.host if request.client else "unknown")
    api_key = _require_openrouter_key(x_openrouter_api_key)

    # Basic payload guards for public proxy
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="content cannot be empty")
    if len(body.content) > 30_000:
        raise HTTPException(status_code=413, detail="content too large")
    if len(body.model_cfg.council_models) == 0 or not body.model_cfg.chairman_model:
        raise HTTPException(status_code=400, detail="model_config must include council_models and chairman_model")
    if len(body.model_cfg.council_models) > 10:
        raise HTTPException(status_code=400, detail="Too many council_models (max 10)")

    async def event_generator():
        try:
            # Title generation (always; frontend can decide whether to use it)
            title_task = asyncio.create_task(generate_conversation_title(body.content, api_key=api_key))

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(
                body.content,
                council_models=body.model_cfg.council_models,
                api_key=api_key,
            )
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(
                body.content,
                stage1_results,
                council_models=body.model_cfg.council_models,
                api_key=api_key,
            )
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(
                body.content,
                stage1_results,
                stage2_results,
                chairman_model=body.model_cfg.chairman_model,
                api_key=api_key,
            )
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation
            title = await title_task
            yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
