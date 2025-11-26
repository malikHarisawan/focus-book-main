# GitHub Actions Guide for FocusBook

## 📚 Table of Contents
1. [What is GitHub Actions?](#what-is-github-actions)
2. [Why Do We Need It?](#why-do-we-need-it)
3. [How Does It Work?](#how-does-it-work)
4. [Your FocusBook Workflow Explained](#your-focusbook-workflow-explained)
5. [Step-by-Step Breakdown](#step-by-step-breakdown)
6. [Common Scenarios](#common-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## What is GitHub Actions?

**GitHub Actions** is like having a robot assistant that automatically builds, tests, and deploys your code whenever you push changes to GitHub.

### Real-World Analogy
Think of it like an assembly line in a factory:
- **You**: Push code to GitHub (deliver raw materials)
- **GitHub Actions**: Automatically builds your app on Windows, macOS, and Linux (assembly line)
- **Result**: Ready-to-install applications for users (finished products)

### Before GitHub Actions (Manual Process)
```
You → Build on Windows manually → Test → Package → Upload to server
You → Build on macOS manually → Test → Package → Upload to server
You → Build on Linux manually → Test → Package → Upload to server
Time: 2-3 hours, error-prone
```

### With GitHub Actions (Automated)
```
You → Push code to GitHub → GitHub Actions does everything automatically
Result: 3 builds ready in 15 minutes, consistent quality
```

---

## Why Do We Need It?

### Problem Without GitHub Actions

Let's say you want to release FocusBook v1.0.0:

```bash
# On Windows PC
npm install
pip install -r AI_agent/requirements.txt
npm run build-ai-service
npm run build
electron-builder --win
# Upload focusbook-setup.exe somewhere

# Borrow a Mac
npm install
pip install -r AI_agent/requirements.txt
npm run build-ai-service
npm run build
electron-builder --mac
# Upload FocusBook.dmg somewhere

# Find a Linux machine
npm install
pip install -r AI_agent/requirements.txt
npm run build-ai-service
npm run build
electron-builder --linux
# Upload FocusBook.AppImage somewhere

# Total time: 3-4 hours
# Problems: Forgot a step? Different versions? Human error?
```

### Solution With GitHub Actions

```bash
# On your PC
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions automatically:
# - Builds on Windows ✅
# - Builds on macOS ✅
# - Builds on Linux ✅
# - Creates GitHub Release ✅
# - Uploads all installers ✅

# Total time: 15 minutes, fully automated
```

---

## How Does It Work?

### The Workflow File

Your workflow is defined in `.github/workflows/build.yml`. This file tells GitHub Actions what to do.

**Think of it as a recipe:**
```yaml
# Recipe: How to build FocusBook
name: Build & Release FocusBook  # Recipe name

on:
  push:
    branches: [main]  # When: Every time you push to main branch

jobs:
  build:  # Step 1: Build the app
    steps:
      - Install dependencies
      - Build AI service
      - Package app
```

---

## Your FocusBook Workflow Explained

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  You Push Code to GitHub (main branch or v* tag)           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions Starts Three Jobs in Parallel              │
├─────────────────┬──────────────────┬────────────────────────┤
│   Lint Job      │   Build Job      │   (Build waits for   │
│   (Quick check) │   (3 OS builds)  │    Lint to finish)   │
└────────┬────────┴────────┬─────────┴────────────────────────┘
         │                 │
         ▼                 ▼
    ┌────────┐    ┌───────────────────────┐
    │ ESLint │    │  Build Matrix         │
    │ Check  │    │  ┌─────────────────┐  │
    └────────┘    │  │ Windows Build   │  │
                  │  ├─────────────────┤  │
                  │  │ macOS Build     │  │
                  │  ├─────────────────┤  │
                  │  │ Linux Build     │  │
                  │  └─────────────────┘  │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Upload Artifacts     │
                  │  - Windows: .exe      │
                  │  - macOS: .dmg        │
                  │  - Linux: .AppImage   │
                  └───────────┬───────────┘
                              │
                              ▼ (only on v* tags)
                  ┌───────────────────────┐
                  │  Create GitHub        │
                  │  Release with all     │
                  │  installers          │
                  └───────────────────────┘
```

---

## Step-by-Step Breakdown

### Part 1: Workflow Triggers

**File**: `.github/workflows/build.yml` (Lines 3-9)

```yaml
on:
  push:
    branches: [main]      # Trigger: Push to main branch
    tags: ['v*']          # Trigger: Create version tag (v1.0.0)
  pull_request:
    branches: [main]      # Trigger: Open pull request
  workflow_dispatch:      # Trigger: Manual button click
```

**What This Means:**
- **Push to main**: Every commit to main → builds everything (for testing)
- **Create tag v1.0.0**: Creates release with installers
- **Pull request**: Tests your changes before merging
- **Manual**: Click "Run workflow" button in GitHub

**Example Scenario:**
```bash
# Scenario 1: Push to main (builds for testing)
git add .
git commit -m "Add new feature"
git push origin main
# → GitHub Actions builds everything but doesn't create release

# Scenario 2: Create release (builds + creates release)
git tag v1.0.0
git push origin v1.0.0
# → GitHub Actions builds everything AND creates GitHub release
```

---

### Part 2: Concurrency Control

**File**: `.github/workflows/build.yml` (Lines 11-13)

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**What This Means:**
If you push twice quickly, the second push cancels the first build.

**Real Example:**
```bash
# 10:00 AM - You push commit A
git push origin main
# → Build A starts (will take 15 minutes)

# 10:02 AM - You notice a typo, push commit B
git push origin main
# → Build B starts, Build A is cancelled automatically

# Why? No point building old code if newer code is available!
```

---

### Part 3: Lint Job (Code Quality Check)

**File**: `.github/workflows/build.yml` (Lines 15-32)

```yaml
lint:
  name: Lint & Code Quality
  runs-on: ubuntu-latest  # Use Ubuntu computer

  steps:
    - uses: actions/checkout@v4        # Download your code

    - uses: actions/setup-node@v4      # Install Node.js 20
      with:
        node-version: 20
        cache: npm                      # Speed up with cache

    - name: Install Node deps
      run: npm ci                       # Install packages

    - name: Run ESLint
      run: npm run lint                 # Check code quality
      continue-on-error: true           # Don't fail if lint has warnings
```

**What This Does:**
1. Gets a fresh Ubuntu computer from GitHub
2. Downloads your FocusBook code
3. Installs Node.js and your npm packages
4. Runs ESLint to check for code issues

**Example Output:**
```
✓ Checking out code...
✓ Installing Node.js 20...
✓ Installing dependencies...
✓ Running ESLint...
  src/main/index.js
    ⚠ Line 42: Unused variable 'oldData'
    ⚠ Line 89: Missing semicolon

  2 warnings found
✓ Lint job completed (warnings allowed)
```

---

### Part 4: Build Matrix (Multi-OS Builds)

**File**: `.github/workflows/build.yml` (Lines 38-45)

```yaml
build:
  name: Build (${{ matrix.os }})
  needs: lint                          # Wait for lint to finish
  runs-on: ${{ matrix.os }}            # Use matrix OS

  strategy:
    matrix:
      os: [windows-latest, macos-latest, ubuntu-latest]
```

**What This Means:**
GitHub Actions runs the same build steps on **three different computers** in parallel.

**Visual Representation:**
```
        ┌─────────────────────┐
        │   Lint Job Done     │
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        │  Start Build Matrix │
        └──┬────────┬────────┬─┘
           │        │        │
    ┌──────▼─┐  ┌──▼─────┐  ┌▼────────┐
    │Windows │  │ macOS  │  │  Linux  │
    │Build   │  │ Build  │  │  Build  │
    │        │  │        │  │         │
    │15 min  │  │15 min  │  │ 15 min  │
    └────────┘  └────────┘  └─────────┘
     (Parallel - all run at same time!)
```

---

### Part 5: Build Steps (The Real Work)

#### Step 5.1: Setup Environment

```yaml
steps:
  - uses: actions/checkout@v4              # Download your code

  - uses: actions/setup-node@v4            # Install Node.js
    with:
      node-version: 20
      cache: npm                            # Cache npm packages

  - name: Install X11 libs (Linux only)    # Linux-specific dependencies
    if: matrix.os == 'ubuntu-latest'
    run: |
      sudo apt-get update
      sudo apt-get install -y libx11-dev libxtst-dev libxkbfile-dev

  - uses: actions/setup-python@v5          # Install Python
    with:
      python-version: "3.11"
      cache: 'pip'                          # Cache Python packages
      cache-dependency-path: 'AI_agent/requirements.txt'
```

**What Happens Here (Using Your Code):**

1. **Checkout**: Downloads your FocusBook repository
2. **Node.js**: Installs Node.js 20 (needed for Electron)
3. **Linux libs**: On Linux, installs X11 libraries (needed for `electron-active-window`)
4. **Python**: Installs Python 3.11 (needed for AI service)

**Why Caching Matters:**

Without cache:
```
First build: Download 500MB of npm packages → 5 minutes
Second build: Download 500MB of npm packages → 5 minutes
Third build: Download 500MB of npm packages → 5 minutes
```

With cache:
```
First build: Download 500MB of npm packages → 5 minutes
Second build: Use cached packages → 30 seconds
Third build: Use cached packages → 30 seconds
```

---

#### Step 5.2: Install Dependencies

```yaml
- name: Install Node dependencies
  run: npm ci

- name: Install Python dependencies
  shell: bash
  run: |
    python -m pip install --upgrade pip
    pip install -r AI_agent/requirements.txt
```

**What This Does (Using Your Files):**

1. **npm ci**: Installs all packages from your `package.json`:
   ```json
   {
     "dependencies": {
       "electron-active-window": "^0.0.6",
       "sqlite3": "^5.1.7",
       "recharts": "^2.15.1",
       // ... 50+ packages
     }
   }
   ```

2. **pip install**: Installs all packages from `AI_agent/requirements.txt`:
   ```
   langchain
   langgraph
   langchain-openai
   fastapi
   uvicorn
   pyinstaller>=6.0.0
   // ... 15+ packages
   ```

---

#### Step 5.3: Build AI Service

```yaml
- name: Build AI Service
  run: npm run build-ai-service
```

**What This Does (Using Your Code):**

Runs the script from `package.json`:
```json
"build-ai-service": "cd AI_agent && python build_service.py"
```

Which executes `AI_agent/build_service.py`:
```python
# Simplified version
def main():
    # Run PyInstaller to create standalone executable
    subprocess.run([
        "pyinstaller",
        "--clean",
        "ai_service.spec"  # Your spec file
    ])

    # Creates: AI_agent/dist/ai_service.exe (on Windows)
```

**Result:**
```
AI_agent/dist/
└── ai_service.exe        # Standalone AI service (no Python needed!)
```

This bundles your entire Python AI service into a single executable file that users don't need Python installed to run!

---

#### Step 5.4: Rebuild Native Modules

```yaml
- name: Rebuild native modules
  run: npm run rebuild-native
```

**What This Does:**

Runs from `package.json`:
```json
"rebuild-native": "npm rebuild"
```

**Why Needed:**

Some npm packages (like `sqlite3`, `electron-active-window`) contain **native code** that needs to be compiled for each operating system.

**Example:**
```
sqlite3 package:
├── sqlite3.js              # JavaScript code (works on all OS)
├── node_sqlite3.node       # Native binary (OS-specific!)
│   ├── Windows: .node compiled with MSVC
│   ├── macOS: .node compiled with Clang
│   └── Linux: .node compiled with GCC
```

`npm rebuild` recompiles these for the current OS.

---

#### Step 5.5: Build Electron App

```yaml
- name: Build Electron App
  run: npm run build
```

**What This Does:**

Runs from `package.json`:
```json
"build": "electron-vite build"
```

Which compiles your React code:
```
src/renderer/src/
├── App.jsx              → out/renderer/App.js
├── components/
│   ├── Dashboard/       → out/renderer/components/Dashboard/
│   ├── Activity/        → out/renderer/components/Activity/
│   └── Settings/        → out/renderer/components/Settings/
└── assets/              → out/renderer/assets/

Result: Optimized production build in out/ folder
```

---

#### Step 5.6: Package App

```yaml
- name: Package App
  run: |
    if [ "${{ matrix.os }}" = "windows-latest" ]; then
      npx electron-builder --win
    elif [ "${{ matrix.os }}" = "macos-latest" ]; then
      npx electron-builder --mac
    else
      npx electron-builder --linux
    fi
  shell: bash
```

**What This Does (Using Your electron-builder.yml):**

On **Windows**:
```yaml
# electron-builder.yml
win:
  target:
    - target: nsis
      arch: [x64]
nsis:
  oneClick: false
  createDesktopShortcut: true
  artifactName: focusbook-setup.${ext}
```

Creates:
```
dist/
├── focusbook-setup.exe        # Windows installer
└── focusbook-setup.exe.blockmap
```

On **macOS**:
```yaml
mac:
  category: Utility
dmg:
  artifactName: ${name}-${version}.${ext}
```

Creates:
```
dist/
├── FocusBook-1.0.0.dmg        # macOS disk image
└── FocusBook-1.0.0.dmg.blockmap
```

On **Linux**:
```yaml
linux:
  target: [AppImage, snap, deb]
appImage:
  artifactName: ${name}-${version}.${ext}
```

Creates:
```
dist/
├── FocusBook-1.0.0.AppImage   # Universal Linux app
├── focusbook_1.0.0_amd64.deb  # Debian/Ubuntu
└── focusbook_1.0.0_amd64.snap # Snap package
```

---

### Part 6: Upload Artifacts (Save Build Results)

```yaml
# Windows artifacts
- name: Upload Windows artifacts
  if: matrix.os == 'windows-latest'
  uses: actions/upload-artifact@v4
  with:
    name: focusbook-windows-latest
    path: |
      dist/*.exe
      dist/*.msi
    retention-days: 30

# Similar for macOS and Linux...
```

**What This Does:**

Uploads your build files to GitHub so you can download them later.

**Example Workflow:**
```
1. Windows build completes
2. GitHub saves focusbook-setup.exe
3. You go to Actions tab → Click workflow run → Download artifacts

GitHub UI:
┌─────────────────────────────────────────┐
│ Build & Release FocusBook               │
│ ✓ Completed in 15m 23s                  │
│                                         │
│ Artifacts:                              │
│ 📦 focusbook-windows-latest (125 MB)   │
│ 📦 focusbook-macos-latest (140 MB)     │
│ 📦 focusbook-ubuntu-latest (135 MB)    │
└─────────────────────────────────────────┘
```

**Why 30 days retention:**
```yaml
retention-days: 30
```
Artifacts are deleted after 30 days to save GitHub storage space. Good for testing builds, but releases are permanent.

---

### Part 7: Create Release (Only on Version Tags)

```yaml
release:
  name: Publish Release
  needs: build                                    # Wait for all builds
  runs-on: ubuntu-latest
  if: startsWith(github.ref, 'refs/tags/v')      # Only on v* tags

  steps:
    - name: Download Windows artifacts
      uses: actions/download-artifact@v4
      with:
        name: focusbook-windows-latest
        path: dist/windows

    # Download macOS and Linux artifacts...

    - name: Create GitHub Release
      uses: softprops/action-gh-release@v1
      with:
        files: |
          dist/windows/*
          dist/macos/*
          dist/linux/*
        draft: false
        prerelease: false
        generate_release_notes: true
```

**What This Does:**

**When you push a version tag:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

1. All three builds complete (Windows, macOS, Linux)
2. Download all build artifacts
3. Create GitHub Release v1.0.0
4. Upload all installers to the release
5. Auto-generate release notes from commits

**Result in GitHub:**

```
Releases
┌─────────────────────────────────────────────────────────┐
│ v1.0.0 - FocusBook Release                              │
│ Released on Nov 25, 2025                                │
│                                                         │
│ What's New:                                             │
│ - Added AI-powered productivity insights                │
│ - Fixed database connection issues                      │
│ - Improved multi-platform support                       │
│                                                         │
│ Downloads:                                              │
│ 💻 focusbook-setup.exe (125 MB) - Windows              │
│ 🍎 FocusBook-1.0.0.dmg (140 MB) - macOS               │
│ 🐧 FocusBook-1.0.0.AppImage (135 MB) - Linux          │
│ 📦 focusbook_1.0.0_amd64.deb (135 MB) - Debian        │
└─────────────────────────────────────────────────────────┘
```

Users can now download and install FocusBook!

---

## Common Scenarios

### Scenario 1: Regular Development (Testing)

**What you do:**
```bash
# Make changes
git add .
git commit -m "Add new dashboard widget"
git push origin main
```

**What happens:**
1. ✅ Lint job runs (checks code quality)
2. ✅ Build jobs run on Windows, macOS, Linux
3. ✅ Artifacts uploaded for testing
4. ❌ No release created (no tag)

**When to use:** Daily development, testing if builds work

---

### Scenario 2: Creating a Release

**What you do:**
```bash
# Update version in package.json
{
  "version": "1.0.0"
}

# Commit and tag
git add package.json
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

**What happens:**
1. ✅ Lint job runs
2. ✅ Build jobs run on Windows, macOS, Linux
3. ✅ Artifacts uploaded
4. ✅ GitHub Release v1.0.0 created with installers

**When to use:** Publishing new version for users

---

### Scenario 3: Testing Pull Requests

**What you do:**
```bash
# Create feature branch
git checkout -b feature/new-widget
# Make changes
git push origin feature/new-widget
# Open pull request on GitHub
```

**What happens:**
1. ✅ Lint job runs on PR
2. ✅ Build jobs run to ensure PR doesn't break builds
3. ✅ You can see if builds pass before merging

**When to use:** Testing changes before merging to main

---

### Scenario 4: Manual Workflow Run

**What you do:**
1. Go to GitHub → Actions tab
2. Click "Build & Release FocusBook"
3. Click "Run workflow" button
4. Select branch
5. Click "Run workflow"

**What happens:**
Same as pushing to main - builds everything but no release

**When to use:** Testing builds without pushing code

---

## How Your FocusBook Files Connect

### The Complete Flow

```
📁 Your Repository
│
├── 📄 package.json
│   ├── "build": "electron-vite build"  ←─ Compiles React
│   ├── "build-ai-service": "..."       ←─ Builds Python service
│   └── "rebuild-native": "npm rebuild" ←─ Compiles native modules
│
├── 📄 electron-builder.yml
│   ├── files: ["out/**/*"]             ←─ What to include in app
│   ├── extraResources:
│   │   └── from: AI_agent/dist         ←─ Bundles AI service
│   └── win/mac/linux configs           ←─ OS-specific settings
│
├── 📁 AI_agent/
│   ├── 📄 requirements.txt             ←─ Python dependencies
│   ├── 📄 ai_service.spec              ←─ PyInstaller configuration
│   ├── 📄 build_service.py             ←─ Builds standalone executable
│   └── 📄 start_service.py             ←─ Entry point
│
├── 📁 src/
│   ├── main/                           ←─ Electron main process
│   ├── preload/                        ←─ Electron preload scripts
│   └── renderer/                       ←─ React app
│
└── 📁 .github/workflows/
    └── 📄 build.yml                    ←─ Tells GitHub what to do
```

### Build Process Flow

```
GitHub Actions Starts
        │
        ▼
1. Install Node.js & Python
   (from build.yml)
        │
        ▼
2. Install Dependencies
   npm ci          → reads package.json
   pip install     → reads AI_agent/requirements.txt
        │
        ▼
3. Build AI Service
   npm run build-ai-service
        ├→ Runs AI_agent/build_service.py
        ├→ Uses AI_agent/ai_service.spec
        └→ Creates AI_agent/dist/ai_service.exe
        │
        ▼
4. Rebuild Native Modules
   npm run rebuild-native
        └→ Recompiles sqlite3, electron-active-window
        │
        ▼
5. Build Electron App
   npm run build
        └→ Compiles src/ → out/
        │
        ▼
6. Package App
   electron-builder
        ├→ Reads electron-builder.yml
        ├→ Includes out/ (Electron app)
        ├→ Includes AI_agent/dist/ (AI service)
        ├→ Includes scripts/ (Python scripts)
        └→ Creates dist/focusbook-setup.exe
        │
        ▼
7. Upload to GitHub
   artifacts or release
```

---

## Troubleshooting

### Issue 1: Build Fails - "npm run rebuild-native not found"

**Error in GitHub Actions:**
```
Run npm run rebuild-native
npm ERR! missing script: rebuild-native
```

**Solution:**
Add to `package.json`:
```json
"rebuild-native": "npm rebuild"
```

**Why it happened:** GitHub Actions calls a script that doesn't exist.

---

### Issue 2: PyInstaller Fails - "Module not found"

**Error in GitHub Actions:**
```
Building AI service...
ModuleNotFoundError: No module named 'fastapi'
```

**Solution:**
Check `AI_agent/requirements.txt` includes:
```
fastapi
uvicorn
pyinstaller>=6.0.0
```

**Why it happened:** Python dependencies not installed before building.

---

### Issue 3: Packaged App Crashes - "Cannot find ai_service"

**Error when users run the app:**
```
Error: Cannot find ai_service executable
```

**Solution:**
Check `electron-builder.yml`:
```yaml
extraResources:
  - from: AI_agent/dist
    to: ai_service
```

And `AI_agent/ai_service.spec`:
```python
datas=[
    ('math_mcp_server.py', '.'),
    ('langgraph_mcp_client.py', '.'),
    ('app.py', '.')
]
```

**Why it happened:** AI service files not included in packaged app.

---

### Issue 4: Workflow Doesn't Run

**Problem:** Pushed code but no workflow runs

**Check:**
1. File is at `.github/workflows/build.yml` (correct path)
2. File is valid YAML (use YAML validator)
3. Push is to `main` branch
4. Check Actions tab → Click workflow → See errors

---

### Issue 5: Artifacts Empty or Missing

**Error:**
```
Upload artifacts: No files found
```

**Solution:**
Check paths in workflow match your build output:
```yaml
path: |
  dist/*.exe    # ← Make sure electron-builder outputs here
  dist/*.msi
```

Check `electron-builder.yml`:
```yaml
directories:
  output: dist    # ← Should match workflow path
```

---

## Quick Reference

### Key Files and Their Purpose

| File | Purpose | Used By |
|------|---------|---------|
| `.github/workflows/build.yml` | Defines automated build process | GitHub Actions |
| `package.json` | Node.js dependencies & scripts | npm, GitHub Actions |
| `electron-builder.yml` | Electron packaging configuration | electron-builder |
| `AI_agent/requirements.txt` | Python dependencies | pip, GitHub Actions |
| `AI_agent/ai_service.spec` | PyInstaller configuration | PyInstaller |
| `AI_agent/build_service.py` | Builds AI service executable | npm script |

### Common Commands

```bash
# Test build locally (before pushing)
npm ci
pip install -r AI_agent/requirements.txt
npm run build-ai-service
npm run build
npx electron-builder --win

# Create release
git tag v1.0.0
git push origin v1.0.0

# View workflow runs
# Go to: https://github.com/YOUR_USERNAME/focusbook/actions
```

---

## Summary

**GitHub Actions automates:**
1. ✅ Code quality checks (ESLint)
2. ✅ Multi-platform builds (Windows, macOS, Linux)
3. ✅ Python AI service compilation
4. ✅ Electron app packaging
5. ✅ Release creation with installers

**You just:**
1. Write code
2. Push to GitHub
3. Get ready-to-distribute apps automatically!

**Time saved:** ~3-4 hours per release → 15 minutes automated

---

## Next Steps

1. **Push your fixed workflow**: `git push origin main`
2. **Watch it run**: Go to Actions tab in GitHub
3. **Test a release**: Create tag `v1.0.0` when ready
4. **Share with users**: They download from GitHub Releases

🎉 **You now understand GitHub Actions!**

---

*Last updated: November 2025*
*FocusBook Version: 1.0.0*
