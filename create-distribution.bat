@echo off
echo Creating FocusBook distribution package...

:: Create distribution directory
if not exist "dist" mkdir dist
if exist "dist\FocusBook-Installer" rmdir /s /q "dist\FocusBook-Installer"
mkdir "dist\FocusBook-Installer"

:: Copy the built app
echo Copying application files...
xcopy "focusbook-win32-x64" "dist\FocusBook-Installer\focusbook-win32-x64\" /E /I /H /Y

:: Copy installer files
copy "install.bat" "dist\FocusBook-Installer\"
copy "simple-installer.js" "dist\FocusBook-Installer\"

:: Create README for users
echo Creating installation instructions...
(
echo FocusBook Installation Package
echo =============================
echo.
echo REQUIREMENTS:
echo - Windows 10/11
echo - Node.js ^(will be auto-installed if missing^)
echo - Administrator privileges
echo.
echo INSTALLATION:
echo 1. Extract this ZIP file to any folder
echo 2. Right-click on install.bat and select "Run as administrator"
echo 3. Follow the on-screen instructions
echo.
echo The app will be installed to: C:\Program Files\FocusBook
echo Desktop and Start Menu shortcuts will be created automatically.
echo.
echo UNINSTALL:
echo Go to Windows Settings ^> Apps ^> Apps ^& features ^> FocusBook ^> Uninstall
) > "dist\FocusBook-Installer\README.txt"

:: Create the ZIP file
echo Creating ZIP package...
powershell -Command "Compress-Archive -Path 'dist\FocusBook-Installer\*' -DestinationPath 'dist\FocusBook-Installer.zip' -Force"

echo.
echo ✅ Distribution package created: dist\FocusBook-Installer.zip
echo.
echo You can now share this ZIP file with others!
pause