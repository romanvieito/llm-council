"""Vercel API handler for LLM Council backend."""

import json

def handler(event, context):
    """Simple API handler for testing."""
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({
            "status": "ok",
            "message": "API is working!",
            "conversations": []
        })
    }