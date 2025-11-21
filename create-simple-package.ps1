# Simple FocusBook Distribution Packager
Write-Host "Creating FocusBook distribution package..." -ForegroundColor Green

# Check if built app exists
if (-not (Test-Path "focusbook-win32-x64")) {
    Write-Host "Error: Built application not found!" -ForegroundColor Red
    Write-Host "Please run 'npm run build:unpack' first to create the application." -ForegroundColor Yellow
    exit 1
}

# Create distribution directory
$distDir = "FocusBook-Distribution"
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

Write-Host "Copying installer files..." -ForegroundColor Yellow
Copy-Item "enhanced-install.bat" -Destination "$distDir\"
Copy-Item "enhanced-installer.js" -Destination "$distDir\"

# Create a simple batch file to copy the app directory
$copyScript = @"
@echo off
echo Preparing distribution package...
robocopy "focusbook-win32-x64" "$distDir\focusbook-win32-x64" /E /R:2 /W:1 /MT:4 /XF nul /XD .git node_modules
echo Application files copied.
"@

$copyScript | Out-File -FilePath "copy-app.bat" -Encoding ASCII
& .\copy-app.bat
Remove-Item "copy-app.bat"

# Create ZIP package
$zipPath = "$distDir.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Creating ZIP package..." -ForegroundColor Yellow
Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

# Get file size
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "✅ Distribution package created!" -ForegroundColor Green
Write-Host "📦 File: $zipPath" -ForegroundColor Cyan
Write-Host "📊 Size: $size MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Share this ZIP file with others for installation!" -ForegroundColor Green