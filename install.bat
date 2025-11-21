@echo off
echo Installing FocusBook...
echo This requires administrator privileges.
cd /d "%~dp0"
powershell -Command "Start-Process node -ArgumentList '%cd%\simple-installer.js' -Verb RunAs -WorkingDirectory '%cd%'"
pause