import json

def handler(event, context):
    """Vercel Python API handler for conversations endpoint."""
    method = event.get('httpMethod', 'GET')
    
    # CORS headers
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    
    # Handle OPTIONS for CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": headers,
            "body": ""
        }
    
    if method == "GET":
        # List conversations
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"conversations": []})
        }
    
    elif method == "POST":
        # Create conversation
        import uuid
        from datetime import datetime
        conversation_id = str(uuid.uuid4())
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "id": conversation_id,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "title": "New Conversation",
                "messages": []
            })
        }
    
    # Method not allowed
    return {
        "statusCode": 405,
        "headers": headers,
        "body": json.dumps({"error": "Method not allowed"})
    }
