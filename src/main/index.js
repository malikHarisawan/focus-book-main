const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
import icon from '../../resources/icon.png?asset'
import { join } from 'path'
import {  is } from '@electron-toolkit/utils'

let mainWindow = null;
let popupWindow = null;
let tray = null;
let totalSeconds = 0;
let timeDisplay = 0;
let timerInterval = null; // Changed to null initialization
let app_name = null;
let n_pid = null;

// Add cleanup flag
let isCleaningUp = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    mainWindow.on('close', (e) => {
        if (!app.isQuiting) {
            e.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}


function clearAppTimers() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
}

function createPopUp() {
    if (popupWindow || isCleaningUp) return;
    
    try {
        const cursorPosition = screen.getCursorScreenPoint();
        const distractedDisplay = screen.getDisplayNearestPoint(cursorPosition);
        const { x, y, width, height } = distractedDisplay.workArea;

        const popupWidth = 600;
        const popupHeight = 600;
        const popupX = x + (width - popupWidth) / 2;
        const popupY = y + (height - popupHeight) / 2;

        popupWindow = new BrowserWindow({
            width: popupWidth,
            height: popupHeight,
            x: Math.round(popupX),
            y: Math.round(popupY),
            frame: false,
            alwaysOnTop: true,
            transparent: true,
            fullscreen: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/index.js'),

            },
        });

        popupWindow.loadFile(path.join(__dirname, '../renderer/popup.html'));


        popupWindow.on('closed', () => {
            popupWindow = null;
        });
    } catch (error) {
        console.error('Error creating popup window:', error);
    }
}

app.whenReady().then(() => {
    createWindow();
    
    ipcMain.on('show-popup-message', (event, appName, pid) => {
        if (isCleaningUp) return;
        console.log("pid", pid, "appName", appName);
        app_name = appName;
        n_pid = pid;
        createPopUp();
    });



    ipcMain.handle('load-data', async () => {
        return loadData();
      });
      
      ipcMain.handle('save-data', async (event, appUsageData) => {
        return saveData(appUsageData);
      });
    tray = new Tray(icon);
    const trayMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => showMainWindow() },
        {
            label: 'Quit', click: () => {
                app.isQuiting = true;
                if (mainWindow) {
                    mainWindow.close();
                }
                app.quit()
            }
        },
    ]);

    tray.setContextMenu(trayMenu);
    tray.setToolTip('Focusbook');

    tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
    });
    globalShortcut.register('CommandOrControl+o', () => {
        showMainWindow();
    });

    globalShortcut.register('CommandOrControl+q', () => {
        app.isQuiting = true
        if (mainWindow) {
            mainWindow.close();
        }
        app.quit()
    });

});

app.on('will-quit', () => {
    isCleaningUp = true;
    globalShortcut.unregisterAll();
    clearAppTimers();
});
app.on('window-all-closed', (e) => {
    if (process.platform !== 'darwin') {
        e.preventDefault();
   
    }
});
app.on('before-quit', () => {
    isCleaningUp = true;
    clearAppTimers();
});

ipcMain.on('stay-focused', (event,data) => {
    console.log("stay-focus recevied in main process")
    if (popupWindow) {
        popupWindow.close();
        popupWindow = null;
        if (!app_name.endsWith('.exe')) {

            const closeScriptPath = path.join(__dirname, "../../scripts/closeTab.py",)
            const pythonProcess = spawn('python', [closeScriptPath, n_pid, app_name]);
            pythonProcess.stdout.on('data', (data) => {
                //const result = JSON.parse(data.toString());
            });

            pythonProcess.stderr.on('data', (data) => {
                console.error('Python script error:', data.toString());
            });
        } else {
            exec(`taskkill /IM ${app_name} /F`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error closing app: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`Error: ${stderr}`);
                    return;
                }
                console.log(`App closed: ${stdout}`);
            });
        }
    }
});
// app.on('activate', () => {
//     if (mainWindow && !mainWindow.isVisible()) {
//         mainWindow.show();
//     } else if (!mainWindow) {
//         createWindow();
//     }
// });
ipcMain.on('cooldown', (event) => {
    console.log(" cooldown Received in main process")
    if (popupWindow) {
        popupWindow.close();
        popupWindow = null;
        if (mainWindow) {
            mainWindow.webContents.send('cooldown');
        }
    }
});

ipcMain.on('dismiss', (event) => { 
    console.log(" dismiss Received in main process")

    if (popupWindow) {
        if (mainWindow) {
            console.log("dismess index")
            mainWindow.webContents.send('dismiss', app_name);
        }
        popupWindow.close();
        popupWindow = null;
    }
});


ipcMain.on('categoriesUpdated', (event, catTags) => {

    console.log(catTags)
    const data  = JSON.stringify(catTags, null , 4)
    fs.writeFileSync('Distractedcat.json', data, (err)=>{
        console.log("error writing file", err)
    })
});



ipcMain.on('start-focus', (event, isFocused) => {
    timerInterval = setInterval(() => {
        totalSeconds++;
        timeDisplay = totalSeconds;
        mainWindow.webContents.send('start-focus', isFocused,timeDisplay);

      }, 1500);
});

ipcMain.on('end-focus',(event, isFocused)=>{
    mainWindow.webContents.send('end-focus',isFocused)

})



// Add these functions to your main process

function loadData() {
    try {
      const userDataDir = path.join(app.getPath('userData'), 'Data');
      const dataPath = path.join(userDataDir, 'data.json');
      console.log('Loading data from:', dataPath);
      
      if (!fs.existsSync(dataPath)) {
        console.error('File does not exist:', dataPath);
        return {};
      }
      
      const data = fs.readFileSync(dataPath, 'utf-8');
      const appUsageData = JSON.parse(data);
      console.log('Data loaded successfully');
      return appUsageData;
    } catch (error) {
      console.error('Error loading data:', error);
      return {};
    }
  }
  
  function saveData(appUsageData) {
    try {
      const userDataDir = path.join(app.getPath('userData'), 'Data');
      const dataPath = path.join(userDataDir, 'data.json');
  
      
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
  
      if (fs.existsSync(dataPath)) {
        const backupPath = path.join(userDataDir, `data.backup-${Date.now()}.json`);
        fs.copyFileSync(dataPath, backupPath);
  
        const backupFiles = fs.readdirSync(userDataDir)
            .filter(file => file.startsWith('data.backup-') && file.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a));
  
        if (backupFiles.length > 5) {
            backupFiles.slice(5).forEach(file => {
                fs.unlinkSync(path.join(userDataDir, file));
            });
        }
      }
  
      const tempPath = path.join(userDataDir, 'data.temp.json');
      const jsonData = JSON.stringify(appUsageData, null, 4);
      fs.writeFileSync(tempPath, jsonData);
  
      fs.renameSync(tempPath, dataPath);
      console.log('Data saved successfully at', dataPath);
      return true;
    } catch (err) {
      console.error('Error saving data:', err);
      return false;
    }
  }
  
