# ========================================
# FocusBook Local Two-Step Build Script
# PowerShell Version
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FocusBook Local Build - Two-Step Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 0: Kill any running processes
Write-Host "[Step 0] Cleaning up running processes..." -ForegroundColor Yellow
$processes = @("FocusBook", "electron", "ai_service")
foreach ($proc in $processes) {
    try {
        Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "  Stopped: $proc" -ForegroundColor Gray
    } catch {
        # Process not running, ignore
    }
}
Write-Host "  Waiting for processes to terminate..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Step 0.5: Clean dist folder
Write-Host ""
Write-Host "[Step 0.5] Cleaning dist folder..." -ForegroundColor Yellow
if (Test-Path "dist") {
    try {
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction Stop
        Write-Host "  Dist folder removed" -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Could not remove dist folder completely" -ForegroundColor Yellow
        Write-Host "  Attempting force removal..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2

# Step 1: Build to unpacked directory
Write-Host ""
Write-Host "[Step 1] Building unpacked application..." -ForegroundColor Yellow
Write-Host "  Running: npm run build" -ForegroundColor Gray

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm run build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Running: electron-builder --win --dir" -ForegroundColor Gray
npx electron-builder --win --dir
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: electron-builder --win --dir failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[Step 1 Complete] Unpacked app created at: dist\win-unpacked" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting 5 seconds before creating installer..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Step 2: Create installer from unpacked directory
Write-Host ""
Write-Host "[Step 2] Creating installer from unpacked app..." -ForegroundColor Yellow
Write-Host "  Running: electron-builder --win --prepackaged dist\win-unpacked" -ForegroundColor Gray

npx electron-builder --win --prepackaged dist\win-unpacked
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: electron-builder --win --prepackaged failed!" -ForegroundColor Red
    Write-Host "Retrying in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    npx electron-builder --win --prepackaged dist\win-unpacked
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Retry failed!" -ForegroundColor Red
        exit 1
    }
}

# Success!
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "BUILD SUCCESS!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installer created at: dist\" -ForegroundColor Cyan

# List created installers
Get-ChildItem -Path "dist" -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor White
}

Write-Host ""