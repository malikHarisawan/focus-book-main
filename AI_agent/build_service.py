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