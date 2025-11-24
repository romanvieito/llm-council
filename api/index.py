"""Vercel API handler for LLM Council backend."""

import json

def handler(event, context):
    """API handler for LLM Council endpoints."""
    # For Vercel API routes, the path is relative to the function location
    # Since this is api/index.py, it handles /api/* routes
    # The path in event might be just the part after /api/
    full_path = event.get('path', '')
    method = event.get('httpMethod', 'GET')

    # Extract the path part after /api/
    path = full_path.replace('/api', '') if full_path.startswith('/api') else full_path
    if not path or path == '/':
        path = '/conversations'  # Default to conversations endpoint

    # CORS headers
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    # Handle OPTIONS requests for CORS preflight
    if method == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": headers,
            "body": ""
        }

    # Route different endpoints
    if path == '/conversations':
        if method == 'GET':
            # List conversations
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({
                    "conversations": []
                })
            }
        elif method == 'POST':
            # Create conversation
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({
                    "id": "test-conversation-id",
                    "created_at": "2025-01-01T00:00:00Z",
                    "title": "Test Conversation",
                    "messages": []
                })
            }

    # Debug response for unmatched routes
    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "debug": True,
            "full_path": full_path,
            "path": path,
            "method": method,
            "message": f"Debug: Endpoint {method} {path} (full: {full_path})"
        })
    }
