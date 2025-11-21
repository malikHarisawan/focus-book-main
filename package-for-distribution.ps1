# FocusBook Distribution Packager
Write-Host "Creating FocusBook distribution package..." -ForegroundColor Green

# Check if built app exists
if (-not (Test-Path "focusbook-win32-x64")) {
    Write-Host "Error: Built application not found!" -ForegroundColor Red
    Write-Host "Please run 'npm run build:unpack' first to create the application." -ForegroundColor Yellow
    exit 1
}

# Create distribution directory
$distDir = "dist\FocusBook-Installer"
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
Copy-Item "focusbook-win32-x64" -Destination "$distDir\" -Recurse

# Copy installer files
Copy-Item "enhanced-install.bat" -Destination "$distDir\"
Copy-Item "enhanced-installer.js" -Destination "$distDir\"

# Create ZIP package
$zipPath = "dist\FocusBook-Installer.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Creating ZIP package..." -ForegroundColor Yellow
Compress-Archive -Path "$distDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

# Get file size
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "✅ Distribution package created successfully!" -ForegroundColor Green
Write-Host "📦 File: $zipPath" -ForegroundColor Cyan
Write-Host "📊 Size: $size MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now share this ZIP file with others!" -ForegroundColor Green
Write-Host "Recipients should:" -ForegroundColor Yellow
Write-Host "1. Extract the ZIP file" -ForegroundColor White
Write-Host "2. Right-click enhanced-install.bat and 'Run as administrator'" -ForegroundColor White
Write-Host "3. Follow the installation prompts" -ForegroundColor White