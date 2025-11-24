"""Vercel API handler for LLM Council backend."""

import json

def handler(event, context):
    """Simple API handler for conversations."""
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

    # Default response
    return {
        "statusCode": 405,
        "headers": headers,
        "body": json.dumps({
            "error": "Method not allowed"
        })
    }
