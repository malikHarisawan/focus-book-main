@echo off
echo ==========================================
echo FocusBook Installer (User Directory)
echo ==========================================
echo.
echo Installing to your user directory (no admin required)...
echo.

node "%~dp0user-installer.js"

if %errorLevel% equ 0 (
    echo.
    echo ==========================================
    echo Installation completed successfully!
    echo ==========================================
    echo.
) else (
    echo.
    echo ==========================================
    echo Installation failed!
    echo ==========================================
    echo.
)

pause
