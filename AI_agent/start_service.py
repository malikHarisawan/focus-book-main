#!/usr/bin/env python3
"""
Startup script for the AI service that handles configuration and launching.
This script is called by the Electron main process to start the AI service.
"""

import os
import sys
import asyncio
import multiprocessing
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

def run_mcp_server():
    """Run the bundled MCP server over stdio.

    This is the re-entrant path for the frozen exe: langgraph_mcp_client.py
    launches `ai_service.exe --run-mcp-server` as the MCP stdio subprocess, and
    we dispatch here instead of starting the web server. In a normal (unfrozen)
    run this path is never taken — the client runs math_mcp_server.py directly.
    """
    from math_mcp_server import mcp
    mcp.run(transport='stdio')


def main():
    """Main startup function"""

    # Re-entrant dispatch MUST come first: if invoked as the MCP server, run that
    # and nothing else (no web server, no environment/port setup).
    if '--run-mcp-server' in sys.argv:
        run_mcp_server()
        return

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
    # CRITICAL for PyInstaller --onefile: without freeze_support(), any transitive
    # use of multiprocessing (uvicorn/anyio and some deps) makes the frozen exe
    # re-launch itself, so each child re-runs main() and spawns another server —
    # producing a cascade of processes and a startup that never completes. This
    # must run before anything spawns a process.
    multiprocessing.freeze_support()
    main()