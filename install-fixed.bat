@echo off
echo ==========================================
echo FocusBook Installer
echo ==========================================
echo.
echo This installer requires administrator privileges.
echo Please approve the UAC prompt...
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Running with administrator privileges...
echo.

:: Change to the script directory to ensure relative paths work
cd /d "%~dp0"

:: Run the Node.js installer
node simple-installer.js

if %errorLevel% equ 0 (
    echo.
    echo ==========================================
    echo Installation completed successfully!
    echo ==========================================
    echo.
    echo You can now:
    echo   - Search for "FocusBook" in Windows Start Menu
    echo   - Use the desktop shortcut
    echo   - Find it in your installed programs
    echo.
) else (
    echo.
    echo ==========================================
    echo Installation failed!
    echo ==========================================
    echo.
    echo Error code: %errorLevel%
    echo.
)

pause
