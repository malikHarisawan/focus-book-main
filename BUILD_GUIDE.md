# FocusBook Build & Deployment Guide

Complete guide for building and deploying FocusBook using both local builds and CI/CD pipelines.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Local Building (Two-Step Process)](#local-building-two-step-process)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Build Targets](#build-targets)
- [Troubleshooting](#troubleshooting)
- [Release Process](#release-process)

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Git** (for CI/CD)
- **Windows** (for Windows builds), macOS (for Mac builds), or Linux (for Linux builds)

### Install Dependencies

```bash
npm run setup
```

This will install both Node.js and Python dependencies.

---

## Local Building (Two-Step Process)

The two-step build process separates building the application from creating the installer, which helps avoid file locking issues with antivirus software.

### Method 1: Using Batch Script (Windows)

```bash
.\build-local.bat
```

**What it does:**
1. Kills any running FocusBook/Electron processes
2. Cleans the `dist` folder
3. Builds the unpacked application to `dist/win-unpacked`
4. Creates the installer from the unpacked app

### Method 2: Using PowerShell Script (Windows - Recommended)

```powershell
.\build-local.ps1
```

Better error handling and colored output. Requires execution policy:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\build-local.ps1
```

### Method 3: Using npm Script

```bash
npm run build:win:local
```

Runs the two-step process via package.json script.

### Manual Two-Step Build

If you prefer manual control:

```bash
# Step 1: Build unpacked app
npm run build
npx electron-builder --win --dir

# Step 2: Create installer from unpacked app
npx electron-builder --win --prepackaged dist/win-unpacked
```

---

## GitHub Actions CI/CD

### Overview

The GitHub Actions workflow (`.github/workflows/build.yml`) automatically:
- ✅ Runs lint checks
- ✅ Builds for Windows, macOS, and Linux in parallel
- ✅ Uploads build artifacts
- ✅ Creates GitHub Releases (on version tags)

### Workflow Triggers

**Automatic triggers:**
- Push to `main` branch
- Pull requests to `main`
- New version tags (`v*`)

**Manual trigger:**
- Go to "Actions" tab → "Build & Release FocusBook" → "Run workflow"

### Using CI/CD Builds

#### 1. Push Changes to Trigger Build

```bash
git add .
git commit -m "Your changes"
git push origin main
```

#### 2. Monitor Build Progress

1. Go to your GitHub repository
2. Click the "Actions" tab
3. View the running workflow
4. See real-time logs for each build step

#### 3. Download Build Artifacts

Once the build completes:

1. Click on the completed workflow run
2. Scroll to "Artifacts" section
3. Download:
   - `focusbook-windows` - Windows installer
   - `focusbook-macos` - macOS DMG
   - `focusbook-linux` - Linux packages

Artifacts are kept for 30 days.

### Creating Releases

To create an official release with installers:

#### Option 1: Using Git Tags

```bash
# Create a new version tag
git tag v1.0.0

# Push the tag to GitHub
git push origin v1.0.0
```

This will:
1. Trigger the build workflow
2. Build for all platforms
3. Create a GitHub Release
4. Upload all installers to the release
5. Generate release notes automatically

#### Option 2: Using GitHub UI

1. Go to "Releases" in your repo
2. Click "Draft a new release"
3. Create a new tag (e.g., `v1.0.0`)
4. Click "Publish release"
5. Workflow will run automatically

### Advantages of CI/CD

✅ **No local file locking issues** - Fresh build environment every time
✅ **Multi-platform builds** - Windows, Mac, Linux simultaneously
✅ **Reproducible builds** - Same environment every time
✅ **No antivirus interference** - Clean GitHub servers
✅ **Free for public repos** - Unlimited minutes
✅ **Build artifacts** - Download anytime within 30 days
✅ **Automated releases** - One command creates everything

---

## Build Targets

### Windows Targets

Choose different installer types:

#### NSIS (Default - Recommended)
```bash
npm run build:nsis
```
Creates a professional NSIS installer with install/uninstall support.

#### Portable
```bash
npm run build:portable
```
Creates a single `.exe` file that runs without installation.

#### Squirrel
```bash
# Change electron-builder.yml target to 'squirrel'
npm run build:win
```
Auto-update enabled installer (may have file locking issues locally).

#### All Targets
Edit `electron-builder.yml`:
```yaml
win:
  target:
    - nsis
    - portable
    - zip
```

### macOS Targets

```bash
npm run build:mac
```

Creates `.dmg` installer for macOS.

### Linux Targets

```bash
npm run build:linux
```

Creates:
- `.AppImage` - Universal Linux package
- `.deb` - Debian/Ubuntu package
- `.snap` - Snap package

---

## Troubleshooting

### Issue: "File is being used by another process"

**Solution 1:** Use the two-step build process
```bash
.\build-local.bat
```

**Solution 2:** Manually kill processes
```bash
taskkill /F /IM FocusBook.exe /T
taskkill /F /IM electron.exe /T
```

**Solution 3:** Add Windows Defender exclusion
```powershell
Add-MpPreference -ExclusionPath "D:\CODE\focusbookMain\dist"
```

**Solution 4:** Use GitHub Actions (recommended)
- No local file locking
- Fresh environment every build

### Issue: Build fails with Python errors

**Solution:** Ensure Python dependencies are installed
```bash
npm run install-python-deps
```

Or manually:
```bash
pip install -r requirements.txt
pip install -r AI_agent/requirements.txt
```

### Issue: Native modules build errors

**Solution:** Rebuild native modules
```bash
npm run rebuild-native
```

### Issue: GitHub Actions build fails

**Check:**
1. Go to "Actions" tab → View failed workflow
2. Check logs for specific error
3. Common issues:
   - Missing Python dependencies (check workflow Python setup)
   - Node version mismatch (ensure Node 18+)
   - Disk space (usually not an issue on GitHub servers)

---

## Release Process

### Complete Release Workflow

#### 1. Update Version

Edit `package.json`:
```json
{
  "version": "1.0.1"
}
```

#### 2. Commit Changes

```bash
git add .
git commit -m "Release v1.0.1"
git push origin main
```

#### 3. Create Release Tag

```bash
git tag v1.0.1
git push origin v1.0.1
```

#### 4. Automated Build & Release

GitHub Actions will automatically:
- Build for Windows, macOS, Linux
- Create GitHub Release
- Upload all installers
- Generate release notes

#### 5. Download & Test

1. Go to "Releases" in your repo
2. Download installers
3. Test on target platforms
4. Announce release!

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features)
- `v1.0.1` - Patch release (bug fixes)

---

## Build Performance

### Local Build Times

- **Full build:** ~2-5 minutes
- **Incremental build:** ~1-2 minutes
- **Two-step build:** ~3-6 minutes (safer for local)

### CI/CD Build Times

- **Lint:** ~1 minute
- **Windows build:** ~5-8 minutes
- **macOS build:** ~5-8 minutes
- **Linux build:** ~4-6 minutes
- **Total (parallel):** ~8-10 minutes

All platforms build in parallel, so total time is the slowest build.

---

## Best Practices

### For Development

✅ Use `npm run dev` for hot reload during development
✅ Test locally with `npm run build:unpack` before creating installer
✅ Use two-step build process for final local testing

### For Production

✅ **Always use GitHub Actions for production builds**
✅ Tag releases with semantic versioning
✅ Test installers on clean machines before release
✅ Keep changelog updated
✅ Document breaking changes

### For Team Collaboration

✅ Push to `main` triggers automatic builds
✅ Pull requests show build status
✅ Download artifacts from Actions tab
✅ Releases are automatically created from tags

---

## Additional Resources

- [Electron Builder Docs](https://www.electron.build/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)

---

## Summary

### Choose Your Build Method:

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| **GitHub Actions** | Production releases, multi-platform | No file locking, automated, multi-platform | Requires internet, slower feedback |
| **Two-step local** | Testing, quick iterations | Fast, local control | File locking issues possible |
| **npm scripts** | Quick local builds | Simple, fast | May encounter file locking |

**Recommendation:** Use **GitHub Actions** for all production releases and important builds. Use **two-step local** for testing and development.

---

**Happy Building! 🚀**
