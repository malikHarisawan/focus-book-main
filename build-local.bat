@echo off
REM ========================================
REM FocusBook Local Two-Step Build Script
REM ========================================

echo.
echo ========================================
echo FocusBook Local Build - Two-Step Process
echo ========================================
echo.

REM Step 0: Kill any running processes
echo [Step 0] Cleaning up running processes...
taskkill /F /IM FocusBook.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
taskkill /F /IM ai_service.exe /T 2>nul
echo Waiting for processes to terminate...
timeout /t 3 /nobreak >nul

REM Step 0.5: Clean dist folder
echo.
echo [Step 0.5] Cleaning dist folder...
if exist dist (
    rmdir /S /Q dist 2>nul
    if exist dist (
        echo WARNING: Could not remove dist folder completely
        echo Attempting force removal...
        powershell -Command "Start-Sleep -Seconds 2; Remove-Item -Path 'dist' -Recurse -Force -ErrorAction SilentlyContinue"
    )
)
timeout /t 2 /nobreak >nul

REM Step 1: Build to unpacked directory (no installer)
echo.
echo [Step 1] Building unpacked application...
echo Running: npm run build
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm run build failed!
    exit /b 1
)

echo.
echo Running: npx electron-builder --win --dir
call npx electron-builder --win --dir
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx electron-builder --win --dir failed!
    exit /b 1
)

echo.
echo [Step 1 Complete] Unpacked app created at: dist\win-unpacked
echo.
echo Waiting 5 seconds before creating installer...
timeout /t 5 /nobreak >nul

REM Step 2: Create installer from unpacked directory
echo.
echo [Step 2] Creating installer from unpacked app...
echo Running: npx electron-builder --win --prepackaged dist\win-unpacked
call npx electron-builder --win --prepackaged dist\win-unpacked
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx electron-builder --win --prepackaged failed!
    echo Retrying in 5 seconds...
    timeout /t 5 /nobreak >nul
    call npx electron-builder --win --prepackaged dist\win-unpacked
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Retry failed!
        exit /b 1
    )
)

echo.
echo ========================================
echo BUILD SUCCESS!
echo ========================================
echo.
echo Installer created at: dist\
dir dist\*.exe 2>nul
echo.
pause