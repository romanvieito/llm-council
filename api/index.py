"""Vercel API handler for LLM Council backend."""

import json

def handler(event, context):
    """Handle Vercel serverless function requests."""
    # Return a simple test response
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({
            "message": "API is working!",
            "conversations": []
        })
    }