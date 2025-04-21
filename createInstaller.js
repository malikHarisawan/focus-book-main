
const electronInstaller = require('electron-winstaller');

electronInstaller.createWindowsInstaller({
  appDirectory: './focusbook-win32-x64',
  outputDirectory: './installer',
  authors: 'Haris',
  exe: 'Focusbook.exe',
  setupIcon: './icon.ico',
  setupExe: 'FocusbookInstaller.exe',
}).then(() => {
  console.log("Installer created successfully!");
}).catch(console.error);
