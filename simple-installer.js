
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

// Get the directory where this script is located (not the current working directory)
const scriptDir = __dirname
const sourceDir = path.join(scriptDir, 'dist', 'win-unpacked')
const targetDir = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'FocusBook')
const targetExe = path.join(targetDir, 'FocusBook.exe')

console.log('Script directory:', scriptDir)
console.log('Source directory:', sourceDir)
console.log('Installing FocusBook to:', targetDir)
console.log('')

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error('❌ Error: Source directory not found!')
  console.error('Expected to find:', sourceDir)
  console.error('')
  console.error('Please make sure you have built the application first by running:')
  console.error('  npm run build:win')
  process.exit(1)
}

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Copy all files
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

copyRecursive(sourceDir, targetDir)

// Create desktop shortcut
const desktopPath = path.join(os.homedir(), 'Desktop', 'FocusBook.lnk')

try {
  const powershellCmd = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${desktopPath}'); $s.TargetPath='${targetExe}'; $s.WorkingDirectory='${targetDir}'; $s.Description='FocusBook Productivity Tracker'; $s.Save()`
  execSync(`powershell -Command "${powershellCmd}"`)
  console.log('✅ Desktop shortcut created')
} catch (error) {
  console.warn('❌ Could not create desktop shortcut:', error.message)
}

// Create Start Menu shortcut
const startMenuPath = path.join(process.env.APPDATA || os.homedir(), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'FocusBook.lnk')

try {
  // Create Start Menu Programs directory if it doesn't exist
  const startMenuDir = path.dirname(startMenuPath)
  if (!fs.existsSync(startMenuDir)) {
    fs.mkdirSync(startMenuDir, { recursive: true })
  }

  const powershellCmd = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${startMenuPath}'); $s.TargetPath='${targetExe}'; $s.WorkingDirectory='${targetDir}'; $s.Description='FocusBook Productivity Tracker'; $s.Save()`
  execSync(`powershell -Command "${powershellCmd}"`)
  console.log('✅ Start Menu shortcut created')
} catch (error) {
  console.warn('❌ Could not create Start Menu shortcut:', error.message)
}

// Add to Windows Registry for proper app registration and search
try {
  const appName = 'FocusBook'
  const appVersion = '1.0.0'
  const regCommands = [
    // Register the application
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\focusbook.exe" /ve /d "${targetExe}" /f`,
    // Add to installed programs list
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v DisplayName /d "${appName}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v DisplayVersion /d "${appVersion}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v Publisher /d "FocusBook Team" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v InstallLocation /d "${targetDir}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v DisplayIcon /d "${targetExe}" /f`,
    `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appName}" /v UninstallString /d "cmd /c rmdir /s /q \\"${targetDir}\\"" /f`
  ]

  regCommands.forEach(cmd => {
    execSync(cmd)
  })
  console.log('✅ Windows Registry entries created')
} catch (error) {
  console.warn('❌ Could not create registry entries:', error.message)
}

// Add to startup (optional - user can disable this)
try {
  const startupRegKey = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
  execSync(`reg add "${startupRegKey}" /v "FocusBook" /d "\\"${targetExe}\\"" /f`)
  console.log('✅ Added to Windows startup')
} catch (error) {
  console.warn('❌ Could not add to startup:', error.message)
}

console.log('')
console.log('🎉 Installation completed!')
console.log('📍 Installed to:', targetExe)
console.log('🔍 You can now search for "FocusBook" in Windows')
console.log('🚀 FocusBook will start automatically with Windows')
console.log('📧 You can disable startup in Windows Settings > Apps > Startup')
