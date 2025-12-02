#!/usr/bin/env python3
"""
Build script to create a standalone executable for the AI service using PyInstaller.
This script handles the creation of the executable and copies necessary dependencies.
"""

import os
import sys
import subprocess
import shutil
import platform
from pathlib import Path

def create_spec_file(current_dir):
    """Create PyInstaller spec file"""
    spec_content = """# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['start_service.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('math_mcp_server.py', '.'),
        ('langgraph_mcp_client.py', '.'),
        ('app.py', '.')
    ],
    hiddenimports=[
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.lifespan.on',
        'fastapi',
        'starlette',
        'pydantic',
        'langchain',
        'langchain_openai',
        'langchain_core',
        'langchain_mcp_adapters',
        'langchain_google_genai',
        'langgraph',
        'openai',
        'mcp',
        'sqlite3',
        'json',
        'asyncio'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ai_service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
"""
    spec_file = current_dir / "ai_service.spec"
    spec_file.write_text(spec_content)
    print(f"Created spec file: {spec_file}")

def main():
    """Main build function"""
    
    # Get the current directory (AI_agent folder)
    current_dir = Path(__file__).parent
    
    # Define paths
    spec_file = current_dir / "ai_service.spec"
    dist_dir = current_dir / "dist"
    build_dir = current_dir / "build"
    
    # Clean previous builds
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    if build_dir.exists():
        shutil.rmtree(build_dir)
    
    # Create spec file if it doesn't exist
    if not spec_file.exists():
        print("Creating PyInstaller spec file...")
        create_spec_file(current_dir)
    
    print("Building AI service executable...")
    
    # Run PyInstaller
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--clean",
        str(spec_file)
    ]
    
    try:
        result = subprocess.run(cmd, cwd=current_dir, check=True, capture_output=True, text=True)
        print("Build successful!")
        print(f"Executable created at: {dist_dir / 'ai_service'}")
        
        # Show output directory contents
        if dist_dir.exists():
            print("\nBuild output:")
            for item in dist_dir.iterdir():
                print(f"  {item.name}")
                
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False
    
    return True

if __name__ == "__main__":
    main()