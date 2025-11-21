@echo off
echo ==========================================
echo Building FocusBook (No Code Signing)
echo ==========================================
echo.

:: Set environment variable to skip code signing
set CSC_IDENTITY_AUTO_DISCOVERY=false

:: Run the build
npm run build:win

echo.
echo ==========================================
echo Build Complete!
echo ==========================================
echo.
echo Check the dist/ folder for:
echo   - FocusBook-1.0.0-Setup.exe (NSIS installer)
echo   - win-unpacked/FocusBook.exe (portable version)
echo.
pause
