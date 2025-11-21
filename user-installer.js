const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

const scriptDir = __dirname
const sourceDir = path.join(scriptDir, 'dist', 'win-unpacked')
const targetDir = path.join(os.homedir(), 'AppData', 'Local', 'FocusBook')
const targetExe = path.join(targetDir, 'FocusBook.exe')

console.log('Installing FocusBook to:', targetDir)

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Copy all files
function copyRecursive(src, dest) {
  const stats = fs.statSync(src)
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    fs.readdirSync(src).forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file))
    })
  } else {
    fs.copyFileSync(src, dest)
  }
}

console.log('Copying files...')
copyRecursive(sourceDir, targetDir)
console.log('✅ Files copied successfully')

// Create desktop shortcut
const desktopPath = path.join(os.homedir(), 'Desktop', 'FocusBook.lnk')

try {
  const powershellCmd = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${desktopPath}'); $s.TargetPath='${targetExe}'; $s.WorkingDirectory='${targetDir}'; $s.Description='FocusBook Productivity Tracker'; $s.Save()`
  execSync(`powershell -Command "${powershellCmd}"`, { stdio: 'ignore' })
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

  const powershellCmd = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${startMenuPath}'); $s.TargetPath='${targetExe}'; $s.WorkingDirectory='${targetDir}'; $s.Description='FocusBook Productivity Tracker'; $s.Save()`
  execSync(`powershell -Command "${powershellCmd}"`, { stdio: 'ignore' })
  console.log('✅ Start Menu shortcut created')
} catch (error) {
  console.warn('❌ Could not create Start Menu shortcut:', error.message)
}

// Add to user startup (no admin required)
try {
  const startupRegKey = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
  execSync(`reg add "${startupRegKey}" /v "FocusBook" /d "\\"${targetExe}\\"" /f`, { stdio: 'ignore' })
  console.log('✅ Added to Windows startup')
} catch (error) {
  console.warn('❌ Could not add to startup:', error.message)
}

// Try to add to user PATH for search functionality
try {
  const currentPath = execSync('powershell -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"', { encoding: 'utf8' }).trim()
  if (!currentPath.includes(targetDir)) {
    const newPath = currentPath ? `${currentPath};${targetDir}` : targetDir
    execSync(`powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath}', 'User')"`, { stdio: 'ignore' })
    console.log('✅ Added to user PATH (for Windows search)')
  }
} catch (error) {
  console.warn('❌ Could not add to PATH:', error.message)
}

console.log('')
console.log('🎉 Installation completed!')
console.log('📍 Installed to:', targetExe)
console.log('🖥️  Desktop shortcut created')
console.log('📂 Start Menu shortcut created')
console.log('🚀 FocusBook will start automatically with Windows')
console.log('')
console.log('You can now:')
console.log('  - Double-click the desktop shortcut')
console.log('  - Search for "FocusBook" in Windows Start Menu')
console.log('  - Disable startup in Windows Settings > Apps > Startup')
console.log('')
