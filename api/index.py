"""Vercel API handler for LLM Council backend."""

import os
import sys

# Add the parent directory to the path so we can import the backend module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum
from backend.main import app

# Create the handler using Mangum adapter for FastAPI
handler = Mangum(app, lifespan="off")