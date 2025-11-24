"""Vercel API handler for LLM Council backend."""

import json
import os
import sys

# Add the parent directory to the path so we can import the backend module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from mangum import Mangum
    from backend.main import app

    # Create the handler using Mangum adapter for FastAPI
    handler = Mangum(app, lifespan="off")

except Exception as e:
    # Fallback handler for debugging
    def handler(event, context):
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "error": str(e),
                "message": "Backend import failed",
                "python_path": sys.path,
                "working_dir": os.getcwd(),
                "files": os.listdir(".") if os.path.exists(".") else [],
            })
        }