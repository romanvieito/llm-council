import json

def handler(event, context):
    """Vercel Python API handler - AWS Lambda format."""
    method = event.get('httpMethod', 'GET')
    
    if method == "GET":
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"conversations": []})
        }
    
    elif method == "POST":
        import uuid
        from datetime import datetime
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "id": str(uuid.uuid4()),
                "created_at": datetime.utcnow().isoformat() + "Z",
                "title": "New Conversation",
                "messages": []
            })
        }
    
    return {
        "statusCode": 405,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": "Method not allowed"})
    }
