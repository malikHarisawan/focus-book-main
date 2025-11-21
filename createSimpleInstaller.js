const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Simple installer that just copies files to Program Files
const installerScript = `
const fs = require('fs')
const path = require('path')

const sourceDir = './focusbook-win32-x64'
const targetDir = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'FocusBook')

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
const desktopPath = path.join(require('os').homedir(), 'Desktop', 'FocusBook.lnk')
const targetExe = path.join(targetDir, 'focusbook.exe')

try {
  execSync(\`powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('\${desktopPath}'); $s.TargetPath='\${targetExe}'; $s.Save()"\`)
  console.log('Desktop shortcut created')
} catch (error) {
  console.warn('Could not create desktop shortcut:', error.message)
}

console.log('Installation completed!')
console.log('You can now run FocusBook from:', targetExe)
`

fs.writeFileSync('simple-installer.js', installerScript)
console.log('Simple installer created: simple-installer.js')
console.log('Run with: node simple-installer.js (as administrator)')