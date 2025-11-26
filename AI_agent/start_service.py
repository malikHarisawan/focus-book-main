#!/usr/bin/env python3
"""
Startup script for the AI service that handles configuration and launching.
This script is called by the Electron main process to start the AI service.
"""

import os
import sys
import asyncio
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

def setup_environment():
    """Setup environment variables and paths"""

    # Load environment variables from .env file first
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    env_file = script_dir / '.env'

    if env_file.exists():
        load_dotenv(env_file)
        print(f"Loaded .env file from: {env_file}")
    else:
        print(f"Warning: .env file not found at: {env_file}")
        # Try loading from current directory as fallback
        load_dotenv()

    # Get database path from command line argument or environment variable
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
        os.environ['FOCUSBOOK_DB_PATH'] = db_path

    # Get OpenAI API key from environment or command line
    # Only override if a non-empty API key is provided via command line
    if len(sys.argv) > 2 and sys.argv[2].strip():
        api_key = sys.argv[2]
        os.environ['OPENAI_API_KEY'] = api_key

    # Get port from command line argument (default to 8000)
    port = 8000
    if len(sys.argv) > 3:
        try:
            port = int(sys.argv[3])
        except ValueError:
            port = 8000

    # Get AI provider from command line argument (default to 'openai')
    provider = 'openai'
    if len(sys.argv) > 4:
        provider = sys.argv[4].strip().lower()
        if provider not in ['openai', 'gemini']:
            provider = 'openai'
        os.environ['AI_PROVIDER'] = provider

    # Get Gemini API key from environment or command line
    # Only override if a non-empty API key is provided via command line
    if len(sys.argv) > 5 and sys.argv[5].strip():
        gemini_key = sys.argv[5]
        os.environ['GEMINI_API_KEY'] = gemini_key

    return port

def main():
    """Main startup function"""
    
    try:
        port = setup_environment()
        
        # Import the FastAPI app after environment setup
        from app import app
        
        print(f"Starting AI service on port {port}")
        print(f"Database path: {os.environ.get('FOCUSBOOK_DB_PATH', 'Not set')}")
        print(f"AI Provider: {os.environ.get('AI_PROVIDER', 'openai')}")
        
        # Run the FastAPI server
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=port,
            log_level="info",
            access_log=False
        )
        
    except Exception as e:
        print(f"Error starting AI service: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()