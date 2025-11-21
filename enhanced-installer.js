const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

console.log('🚀 FocusBook Installer v1.0')
console.log('===========================')

const sourceDir = './focusbook-win32-x64'
const targetDir = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'FocusBook')
const targetExe = path.join(targetDir, 'focusbook.exe')

// Check if Node.js is available
function checkNodeJs() {
  try {
    execSync('node --version', { stdio: 'pipe' })
    return true
  } catch (error) {
    return false
  }
}

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error('❌ Error: Application files not found!')
  console.error(`Expected directory: ${sourceDir}`)
  console.error('Please ensure you extracted all files from the installer package.')
  process.exit(1)
}

// Check administrator privileges
function isAdmin() {
  try {
    execSync('net session >nul 2>&1', { stdio: 'pipe' })
    return true
  } catch (error) {
    return false
  }
}

if (!isAdmin()) {
  console.error('❌ Administrator privileges required!')
  console.error('Please right-click on install.bat and select "Run as administrator"')
  process.exit(1)
}

console.log('✅ Administrator privileges confirmed')
console.log('📁 Installing to:', targetDir)

// Remove existing installation
if (fs.existsSync(targetDir)) {
  console.log('🔄 Removing previous installation...')
  try {
    execSync(`rmdir /s /q "${targetDir}"`, { stdio: 'pipe' })
  } catch (error) {
    console.warn('⚠️ Could not remove previous installation, continuing...')
  }
}

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Copy all files with progress
function copyRecursive(src, dest) {
  const stats = fs.statSync(src)
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest)
    }
    fs.readdirSync(src).forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file))
    })
  } else {
    fs.copyFileSync(src, dest)
  }
}

console.log('📦 Copying application files...')
copyRecursive(sourceDir, targetDir)
console.log('✅ Application files copied')

// Create desktop shortcut
const desktopPath = path.join(os.homedir(), 'Desktop', 'FocusBook.lnk')

try {
  const powershellCmd = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${desktopPath}'); $s.TargetPath='${targetExe}'; $s.WorkingDirectory='${targetDir}'; $s.Description='FocusBook Productivity Tracker'; $s.IconLocation='${targetExe}'; $s.Save()`
  execSync(`powershell -Command "${powershellCmd}"`)
  console.log('✅ Desktop shortcut created')
} catch (error) {
  console.warn('❌ Could not create desktop shortcut:', error.message)
}

// Create Start Menu shortcut
const startMenuPath = path.join(process.env.APPDATA || os.homedir(), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'FocusBook.lnk')

try {
  const startMenuDir = path.dirname(startMenuPath)
  if (!fs.existsSync(startMenuDir)) {
    fs.mkdirSync(startMenuDir, { recursive: true })
  }

  const powershellCmd = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${startMenuPath}'); $s.TargetPath='${targetExe}'; $s.WorkingDirectory='${targetDir}'; $s.Description='FocusBook Productivity Tracker'; $s.IconLocation='${targetExe}'; $s.Save()`
  execSync(`powershell -Command "${powershellCmd}"`)
  console.log('✅ Start Menu shortcut created')
} catch (error) {
  console.warn('❌ Could not create Start Menu shortcut:', error.message)
}

// Windows Registry registration
try {
  const appName = 'FocusBook'
  const appVersion = '1.0.0'
  const publisher = 'FocusBook Team'

  const regCommands = [
    // App Paths registration
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\focusbook.exe" /ve /d "${targetExe}" /f`,
    // Uninstall information
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v DisplayName /d "${appName}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v DisplayVersion /d "${appVersion}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v Publisher /d "${publisher}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v InstallLocation /d "${targetDir}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v DisplayIcon /d "${targetExe}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v UninstallString /d "cmd /c rmdir /s /q \\"${targetDir}\\" && reg delete \\"HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}\\" /f" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v NoModify /t REG_DWORD /d 1 /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v NoRepair /t REG_DWORD /d 1 /f`
  ]

  regCommands.forEach(cmd => {
    execSync(cmd, { stdio: 'pipe' })
  })
  console.log('✅ Windows Registry entries created')
} catch (error) {
  console.warn('❌ Could not create registry entries:', error.message)
}

console.log('')
console.log('🎉 Installation completed successfully!')
console.log('====================================')
console.log('📍 Installation location:', targetExe)
console.log('🔍 Search for "FocusBook" in Windows Start Menu')
console.log('🖥️ Desktop shortcut created')
console.log('')
console.log('To uninstall: Windows Settings > Apps > Apps & features > FocusBook')
console.log('')
console.log('Press any key to close...')