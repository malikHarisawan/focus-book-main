@echo off
title FocusBook Installer
color 0A

echo.
echo  ███████╗ ██████╗  ██████╗██╗   ██╗███████╗██████╗  ██████╗  ██████╗ ██╗  ██╗
echo  ██╔════╝██╔═══██╗██╔════╝██║   ██║██╔════╝██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝
echo  █████╗  ██║   ██║██║     ██║   ██║███████╗██████╔╝██║   ██║██║   ██║█████╔╝
echo  ██╔══╝  ██║   ██║██║     ██║   ██║╚════██║██╔══██╗██║   ██║██║   ██║██╔═██╗
echo  ██║     ╚██████╔╝╚██████╗╚██████╔╝███████║██████╔╝╚██████╔╝╚██████╔╝██║  ██╗
echo  ╚═╝      ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝
echo.
echo                          Productivity Tracking Application
echo                                    Version 1.0
echo.
echo This installer requires administrator privileges to install FocusBook.
echo.
pause

echo Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Node.js is required but not found on your system.
    echo Please install Node.js from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

echo Starting installation with administrator privileges...
powershell -Command "Start-Process node -ArgumentList 'enhanced-installer.js' -Verb RunAs -Wait"

echo.
echo Installation process completed.
pause