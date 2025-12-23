"""Configuration for the LLM Council."""

import os
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Default council members - list of OpenRouter model identifiers
DEFAULT_COUNCIL_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

# Default chairman model - synthesizes final response
DEFAULT_CHAIRMAN_MODEL = "google/gemini-3-pro-preview"

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"

# Model configuration file path
MODELS_CONFIG_FILE = "config/models.json"

# Current model configuration (loaded from file or defaults)
COUNCIL_MODELS = DEFAULT_COUNCIL_MODELS
CHAIRMAN_MODEL = DEFAULT_CHAIRMAN_MODEL


def load_model_config() -> Dict[str, Any]:
    """
    Load model configuration from file.

    Returns:
        Dict with 'council_models', 'chairman_model', and 'presets' keys
    """
    global COUNCIL_MODELS, CHAIRMAN_MODEL

    try:
        with open(MODELS_CONFIG_FILE, 'r') as f:
            config = json.load(f)
            # Update globals
            COUNCIL_MODELS = config.get('council_models', DEFAULT_COUNCIL_MODELS)
            CHAIRMAN_MODEL = config.get('chairman_model', DEFAULT_CHAIRMAN_MODEL)
            
            # Ensure 'presets' key exists in the returned config
            if 'presets' not in config:
                config['presets'] = {}
                
            return config
    except (FileNotFoundError, json.JSONDecodeError):
        # Return defaults if file doesn't exist or is invalid
        return {
            'council_models': DEFAULT_COUNCIL_MODELS,
            'chairman_model': DEFAULT_CHAIRMAN_MODEL,
            'presets': {}
        }


def save_model_config(council_models: List[str], chairman_model: str, presets: Optional[Dict[str, Any]] = None) -> bool:
    """
    Save model configuration to file.

    Args:
        council_models: List of model IDs for council
        chairman_model: Model ID for chairman
        presets: Optional dictionary of named presets

    Returns:
        True if successful, False otherwise
    """
    global COUNCIL_MODELS, CHAIRMAN_MODEL

    # If presets is None, try to preserve existing presets from file
    if presets is None:
        existing_config = load_model_config()
        presets = existing_config.get('presets', {})
    
    config = {
        'council_models': council_models,
        'chairman_model': chairman_model,
        'presets': presets
    }

    try:
        # Ensure config directory exists
        os.makedirs(os.path.dirname(MODELS_CONFIG_FILE), exist_ok=True)

        with open(MODELS_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)

        # Update global variables for the current running process
        COUNCIL_MODELS = council_models
        CHAIRMAN_MODEL = chairman_model

        return True
    except Exception as e:
        print(f"Error saving model config: {e}")
        return False


def get_current_config() -> Dict[str, Any]:
    """
    Get current model configuration.

    Returns:
        Dict with current config and system defaults
    """
    # Always reload from file to ensure we have the latest state (especially presets)
    config = load_model_config()
    return {
        'council_models': COUNCIL_MODELS,
        'chairman_model': CHAIRMAN_MODEL,
        'presets': config.get('presets', {}),
        'defaults': {
            'council_models': DEFAULT_COUNCIL_MODELS,
            'chairman_model': DEFAULT_CHAIRMAN_MODEL
        }
    }


# Load configuration on module import
load_model_config()
