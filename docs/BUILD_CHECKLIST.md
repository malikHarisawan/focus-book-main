# FocusBook Build & Release Checklist

## 🎯 Quick Start

### First Time Setup
```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/focusbook.git
cd focusbook

# 2. Install dependencies
npm install
pip install -r AI_agent/requirements.txt

# 3. Test local build
npm run dev
```

---

## 📋 Pre-Release Checklist

### Before Creating a Release

- [ ] **Update version number**
  ```json
  // package.json
  {
    "version": "1.0.0"  // ← Change this
  }
  ```

- [ ] **Update CHANGELOG** (if you have one)
  ```markdown
  ## [1.0.0] - 2025-11-25
  ### Added
  - AI-powered productivity insights
  - Multi-platform support

  ### Fixed
  - Database connection issues
  - Port conflicts in AI service
  ```

- [ ] **Test locally on your OS**
  ```bash
  # Build everything
  npm run build-ai-service
  npm run build

  # Package for your OS
  npx electron-builder --win  # or --mac, --linux

  # Test the installer in dist/ folder
  ```

- [ ] **Commit all changes**
  ```bash
  git add .
  git commit -m "Release v1.0.0"
  git push origin main
  ```

- [ ] **Check GitHub Actions passes**
  - Go to: https://github.com/YOUR_USERNAME/focusbook/actions
  - Wait for green checkmarks ✅
  - If red ❌, fix issues and push again

---

## 🚀 Creating a Release

### Option 1: Command Line (Recommended)

```bash
# 1. Create and push tag
git tag v1.0.0
git push origin v1.0.0

# 2. That's it! GitHub Actions does the rest:
#    - Builds on Windows, macOS, Linux
#    - Creates GitHub Release
#    - Uploads installers
```

### Option 2: GitHub UI

1. Go to: https://github.com/YOUR_USERNAME/focusbook/releases
2. Click "Create a new release"
3. Click "Choose a tag" → Type `v1.0.0` → "Create new tag"
4. Add release title: "FocusBook v1.0.0"
5. Add description (auto-generated or custom)
6. Click "Publish release"

---

## 🔍 Monitoring the Build

### Watch Progress

1. Go to: https://github.com/YOUR_USERNAME/focusbook/actions
2. Click on "Build & Release FocusBook" workflow
3. Click on the latest run

### Expected Timeline

```
Time    | Step
--------|--------------------------------------------------
0:00    | 🟡 Lint job starts
0:30    | ✅ Lint job completes
0:30    | 🟡 3 build jobs start (Windows, macOS, Linux)
5:00    | 🟡 Dependencies installed (with cache)
8:00    | 🟡 AI service building
10:00   | 🟡 Electron app building
12:00   | 🟡 Packaging apps
15:00   | ✅ All builds complete
15:30   | 🟡 Release job starts (if tagged)
16:00   | ✅ Release published with installers
```

### What Success Looks Like

```
✅ Lint & Code Quality (30s)
✅ Build (windows-latest) (15m)
✅ Build (macos-latest) (15m)
✅ Build (ubuntu-latest) (15m)
✅ Publish Release (30s)
```

---

## 📦 Artifacts & Outputs

### For Regular Pushes (Testing)

Artifacts available for 30 days:
```
Artifacts (click to download):
📦 focusbook-windows-latest
   └── focusbook-setup.exe (125 MB)

📦 focusbook-macos-latest
   └── FocusBook-1.0.0.dmg (140 MB)

📦 focusbook-ubuntu-latest
   ├── FocusBook-1.0.0.AppImage (135 MB)
   ├── focusbook_1.0.0_amd64.deb (135 MB)
   └── focusbook_1.0.0_amd64.snap (130 MB)
```

### For Tagged Releases (Public)

Permanent release with installers:
```
Releases → v1.0.0
📥 Assets:
   💻 focusbook-setup.exe (Windows)
   🍎 FocusBook-1.0.0.dmg (macOS)
   🐧 FocusBook-1.0.0.AppImage (Linux)
   📦 focusbook_1.0.0_amd64.deb (Debian/Ubuntu)
   📦 focusbook_1.0.0_amd64.snap (Snap Store)
```

---

## 🐛 Troubleshooting Build Failures

### Common Issues & Solutions

#### 1. ESLint Errors (Lint Job Fails)

**Error:**
```
❌ Lint & Code Quality
src/main/index.js:42:10 - Unused variable 'oldData'
```

**Solution:**
```bash
# Fix locally
npm run lint

# Or auto-fix
npm run lint -- --fix

git add .
git commit -m "Fix lint errors"
git push
```

---

#### 2. Python Dependencies Missing

**Error:**
```
❌ Build (windows-latest)
ModuleNotFoundError: No module named 'langchain'
```

**Solution:**
Check `AI_agent/requirements.txt` includes all dependencies:
```
langchain
langchain-openai
fastapi
uvicorn
pyinstaller>=6.0.0
```

---

#### 3. Native Module Build Fails

**Error:**
```
❌ Build (windows-latest)
Error: Cannot find module 'electron-active-window'
```

**Solution:**
The `rebuild-native` script should handle this. Check `package.json`:
```json
"rebuild-native": "npm rebuild"
```

---

#### 4. AI Service Build Fails

**Error:**
```
❌ Build AI Service
PyInstaller: command not found
```

**Solution:**
Add to `AI_agent/requirements.txt`:
```
pyinstaller>=6.0.0
```

---

#### 5. Packaging Fails

**Error:**
```
❌ Package App
electron-builder: Application directory not found
```

**Solution:**
Ensure `npm run build` completed successfully first. Check workflow order:
```yaml
- name: Build Electron App
  run: npm run build

- name: Package App  # ← This depends on previous step
  run: npx electron-builder --win
```

---

#### 6. Release Not Created

**Problem:** Build succeeds but no release appears

**Check:**
1. Did you push a tag? `git tag v1.0.0`
2. Does tag start with `v`? (required by workflow)
3. Check workflow file:
   ```yaml
   if: startsWith(github.ref, 'refs/tags/v')
   ```

**Solution:**
```bash
# Check existing tags
git tag

# Create and push tag
git tag v1.0.0
git push origin v1.0.0
```

---

## 🧪 Testing Your Build Locally

### Test the Complete Build Process

```bash
# 1. Clean previous builds
rm -rf dist out AI_agent/dist

# 2. Install dependencies (fresh)
npm ci
pip install -r AI_agent/requirements.txt

# 3. Build AI service
npm run build-ai-service
# Check: AI_agent/dist/ai_service.exe should exist

# 4. Build Electron app
npm run build
# Check: out/ folder should contain compiled code

# 5. Package app
npx electron-builder --win
# Check: dist/focusbook-setup.exe should exist

# 6. Test the installer
# Double-click dist/focusbook-setup.exe
# Install and run FocusBook
```

### Quick Smoke Test

```bash
# Test in development mode
npm run dev

# Test AI service manually
cd AI_agent
python start_service.py
# Should start on port 8000
# Open http://localhost:8000/docs
```

---

## 📊 Build Size Expectations

### Typical Build Sizes

| Platform | Installer Size | Installed Size |
|----------|---------------|----------------|
| Windows  | 125-150 MB    | 350-400 MB     |
| macOS    | 140-160 MB    | 380-420 MB     |
| Linux    | 130-155 MB    | 360-410 MB     |

**Why so large?**
- Electron runtime (~100 MB)
- Node.js embedded
- Python AI service with dependencies (~50 MB)
- Your app code (~10 MB)
- Native modules (sqlite3, etc.)

### Reducing Build Size (Optional)

1. **Remove unused dependencies**
   ```bash
   npm uninstall package-name
   ```

2. **Optimize PyInstaller**
   ```python
   # ai_service.spec
   excludes=['tkinter', 'matplotlib', ...]
   ```

3. **Use electron-builder compression**
   ```yaml
   # electron-builder.yml
   compression: maximum  # Default is 'normal'
   ```

---

## 🔐 Security Checklist

### Before Releasing

- [ ] **No API keys in code**
  ```bash
  # Check for exposed secrets
  git grep -i "api_key"
  git grep -i "password"
  ```

- [ ] **API keys from config.json**
  ```javascript
  // Good: Read from user config
  const config = JSON.parse(fs.readFileSync(configPath))
  const apiKey = config.apiKey

  // Bad: Hardcoded
  const apiKey = "AIza..." // ❌ NEVER DO THIS
  ```

- [ ] **.gitignore includes secrets**
  ```gitignore
  .env
  config.json
  *.secret
  *.key
  ```

- [ ] **GitHub secrets configured**
  - GITHUB_TOKEN (auto-provided)
  - Add custom secrets in: Settings → Secrets → Actions

---

## 🎉 Post-Release Tasks

### After Successful Release

1. **Announce the release**
   - Share GitHub release URL
   - Post on social media
   - Email users

2. **Update documentation**
   - README with download links
   - Update version references

3. **Monitor issues**
   - Check GitHub Issues
   - Watch for user feedback

4. **Plan next release**
   - Start working on v1.1.0!

---

## 📚 Quick Reference

### Version Numbering (Semantic Versioning)

```
v1.2.3
│ │ │
│ │ └─ Patch (bug fixes)
│ └─── Minor (new features, backwards compatible)
└───── Major (breaking changes)
```

**Examples:**
- `v1.0.0` → Initial release
- `v1.0.1` → Bug fix release
- `v1.1.0` → New feature added
- `v2.0.0` → Major redesign

### Useful Git Commands

```bash
# Check current version
git describe --tags

# List all releases
git tag

# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin :refs/tags/v1.0.0

# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"
```

### GitHub URLs

```
Repository:   github.com/YOUR_USERNAME/focusbook
Actions:      github.com/YOUR_USERNAME/focusbook/actions
Releases:     github.com/YOUR_USERNAME/focusbook/releases
Issues:       github.com/YOUR_USERNAME/focusbook/issues
```

---

## 🆘 Getting Help

### If Builds Fail

1. **Check the logs**
   - Actions tab → Click failed job → Read error

2. **Test locally first**
   ```bash
   npm run build-ai-service
   npm run build
   npx electron-builder --win
   ```

3. **Check workflow file syntax**
   - Use online YAML validator
   - Check indentation (spaces, not tabs)

4. **Search GitHub Issues**
   - Common electron-builder issues
   - Common GitHub Actions issues

5. **Ask for help**
   - GitHub Issues
   - Electron Discord
   - Stack Overflow

---

**Good luck with your releases! 🚀**

*This checklist is for FocusBook v1.0.0+*
