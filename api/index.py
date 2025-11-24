"""Vercel API handler for LLM Council backend."""

import json

def handler(event, context):
    """API handler for LLM Council endpoints."""
    path = event.get('path', '')
    method = event.get('httpMethod', 'GET')

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
    if path == '/api/conversations':
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

    # Default response for unmatched routes
    return {
        "statusCode": 404,
        "headers": headers,
        "body": json.dumps({
            "error": "Not Found",
            "message": f"Endpoint {method} {path} not found"
        })
    }
