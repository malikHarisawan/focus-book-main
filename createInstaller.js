const electronInstaller = require('electron-winstaller')
const path = require('path')
electronInstaller
  .createWindowsInstaller({
    appDirectory: './focusbook-win32-x64',
    outputDirectory: './installer',
    authors: '© 2025 Comrex PVT LTD',
    exe: 'Focusbook.exe',
    setupIcon: './icon.ico',
    setupExe: 'FocusbookInstaller.exe',
    noMsi: false,
    setupIcon: './icon.ico',
    setupExe: 'FocusbookInstaller.exe',
    noMsi: true,
    iconUrl: path.resolve('./icon.ico'),
    setupEvents: {
      postInstall: function (options) {
        const startupPath = path.join(
          process.env.APPDATA,
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Startup'
        )
        const shortcutPath = path.join(startupPath, 'Focusbook.lnk')
        const targetPath = path.join(options.appDirectory, 'Focusbook.exe')

        require('child_process').execSync(
          `powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('${shortcutPath}'); $s.TargetPath='${targetPath}'; $s.Save()"`
        )
      }
    }
  })
  .then(() => {
    console.log('Installer created successfully!')
  })
  .catch(console.error)
