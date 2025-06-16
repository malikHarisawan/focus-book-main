const { app, powerMonitor, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
import icon from '../../resources/icon.png?asset'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow = null;
let popupWindow = null;
let tray = null;
let totalSeconds = 0;
let timeDisplay = 0;
let timerInterval = null;
let app_name = null;
let n_pid = null;
let isCleaningUp = false;

// Timer management state
const activeTimers = new Set();
let cleanupTimeout = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        resizable: true,
        show: false,
        Menu: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
        },
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
        console.log("running in dev")
    } else {
        console.log("running in prod")
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        mainWindow.webContents.openDevTools()
    }

    mainWindow.on('close', (e) => {
        if (!app.isQuiting) {
            e.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    // Add cleanup when window is destroyed
    mainWindow.on('closed', () => {
        clearAppTimers();
        mainWindow = null;
    });
}

function clearAppTimers() {
    try {
        if (timerInterval) {
            clearInterval(timerInterval);
            activeTimers.delete(timerInterval);
            timerInterval = null;
            console.log('Focus timer cleared');
        }
        
        // Clear any remaining tracked timers
        activeTimers.forEach(timerId => {
            try {
                clearInterval(timerId);
                clearTimeout(timerId);
            } catch (error) {
                console.error('Error clearing timer:', error);
            }
        });
        activeTimers.clear();
        
        // Clear cleanup timeout
        if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
            cleanupTimeout = null;
        }
    } catch (error) {
        console.error('Error in clearAppTimers:', error);
    }
}

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
}

function createPopUp() {
    if (popupWindow) return;
    
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

    ipcMain.on('save-categories', async (event, data) => {
        return saveCategories(data)
    })

    ipcMain.handle('load-categories', async (event) => {
        return loadCategories()
    })

    ipcMain.handle('load-data', async () => {
        return loadData();
    });

    ipcMain.handle('save-data', async (event, appUsageData) => {
        return saveData(appUsageData);
    });

    ipcMain.handle('idle-state', async (event, idleThreshold) => {
        let state = powerMonitor.getSystemIdleState(idleThreshold)
        console.log(`[${new Date().toLocaleTimeString()}] State: ${state}`);
        return state
    })

    ipcMain.handle('load-custom-categories', async () => {
        return loadCustomCategories();
    });

    ipcMain.handle('save-custom-categories', async (event, mappings) => {
        return saveCustomCategories(mappings);
    });

    tray = new Tray(icon);
    const trayMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => showMainWindow() },
        {
            label: 'Quit', click: () => {
                app.isQuiting = true;
                cleanup();
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
        app.isQuiting = true;
        cleanup();
        app.quit();
    });
});

// Centralized cleanup function with timeout protection
function cleanup() {
    if (isCleaningUp) {
        console.log('Cleanup already in progress');
        return;
    }
    
    console.log('Starting application cleanup...');
    isCleaningUp = true;
    
    // Set a timeout to force exit if cleanup takes too long
    cleanupTimeout = setTimeout(() => {
        console.log('Cleanup timeout reached, forcing exit');
        process.exit(0);
    }, 5000);
    
    try {
        // Clear all timers first
        clearAppTimers();
        
        // Close popup window
        if (popupWindow && !popupWindow.isDestroyed()) {
            try {
                popupWindow.close();
            } catch (error) {
                console.error('Error closing popup window:', error);
            }
            popupWindow = null;
        }
        
        // Close main window
        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                mainWindow.close();
            } catch (error) {
                console.error('Error closing main window:', error);
            }
            mainWindow = null;
        }
        
        // Destroy tray
        if (tray && !tray.isDestroyed()) {
            try {
                tray.destroy();
            } catch (error) {
                console.error('Error destroying tray:', error);
            }
            tray = null;
        }
        
        // Clear global shortcuts
        try {
            globalShortcut.unregisterAll();
        } catch (error) {
            console.error('Error unregistering shortcuts:', error);
        }
        
        console.log('Cleanup completed successfully');
        
        // Clear the cleanup timeout since we completed successfully
        if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
            cleanupTimeout = null;
        }
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

app.on('will-quit', () => {
    cleanup();
});

app.on('window-all-closed', (e) => {
    if (process.platform !== 'darwin') {
        e.preventDefault();
    }
});

app.on('before-quit', () => {
    cleanup();
});

// Add comprehensive process signal handlers for graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    cleanup();
    setTimeout(() => process.exit(0), 1000);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    cleanup();
    setTimeout(() => process.exit(0), 1000);
});

process.on('SIGUSR2', () => {
    console.log('Received SIGUSR2 (nodemon restart), shutting down gracefully');
    cleanup();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanup();
    setTimeout(() => process.exit(1), 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit for unhandled rejections, just log them
});

ipcMain.on('stay-focused', (event, data) => {
    if (isCleaningUp) return;
    
    console.log("stay-focus received in main process")
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
        popupWindow = null;
        
        if (!app_name.endsWith('.exe')) {
            const closeScriptPath = path.join(__dirname, "../../scripts/closeTab.py")
            const pythonProcess = spawn('python', [closeScriptPath, n_pid, app_name]);
            
            pythonProcess.stdout.on('data', (data) => {
                // Handle output if needed
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
            });
        }
    }
});

ipcMain.on('cooldown', (event) => {
    if (isCleaningUp) return;
    
    console.log("cooldown Received in main process")
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
        popupWindow = null;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('cooldown');
        }
    }
});

ipcMain.on('dismiss', (event) => {
    if (isCleaningUp) return;
    
    console.log("dismiss Received in main process")
    if (popupWindow && !popupWindow.isDestroyed()) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            console.log("dismiss index")
            mainWindow.webContents.send('dismiss', app_name);
        }
        popupWindow.close();
        popupWindow = null;
    }
});

ipcMain.on('categoriesUpdated', (event, catTags) => {
    if (isCleaningUp) return;
    
    console.log(catTags)
    const data = JSON.stringify(catTags, null, 4)
    fs.writeFileSync('Distractedcat.json', data, (err) => {
        console.log("error writing file", err)
    })
});

ipcMain.on('start-focus', (event, isFocused) => {
    if (isCleaningUp) return;
    
    // Clear any existing timer first
    clearAppTimers();
    
    timerInterval = setInterval(() => {
        // Check if we're cleaning up or main window is destroyed
        if (isCleaningUp || !mainWindow || mainWindow.isDestroyed()) {
            clearAppTimers();
            return;
        }
        
        totalSeconds++;
        timeDisplay = totalSeconds;
        
        try {
            mainWindow.webContents.send('start-focus', isFocused, timeDisplay);
        } catch (error) {
            console.error('Error sending focus timer update:', error);
            clearAppTimers();
        }
    }, 1500);
    
    // Track the timer for cleanup
    if (timerInterval) {
        activeTimers.add(timerInterval);
        console.log('Focus timer started and tracked');
    }
});

ipcMain.on('end-focus', (event, isFocused) => {
    if (isCleaningUp) return;
    
    clearAppTimers(); // Clear timer when focus ends
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('end-focus', isFocused);
        } catch (error) {
            console.error('Error sending end-focus:', error);
        }
    }
});

function saveCategories(data) {
    try {
        console.log("Categories data =====> ", data)
        const userDataDir = path.join(app.getPath('userData'), 'Data');
        const dataPath = path.join(userDataDir, 'categories_data.json');
        
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        
        fs.writeFileSync(dataPath, JSON.stringify(data))
        console.log("cat saved ")
    } catch (e) {
        console.log("couldn't update the distracted categories", e)
    }
}

function loadCategories() {
    try {
        console.log('Loading data load-categories:');
        const userDataDir = path.join(app.getPath('userData'), 'Data');
        const dataPath = path.join(userDataDir, 'categories_data.json');
        
        if (!fs.existsSync(dataPath)) {
            console.error('File does not exist:', dataPath);
            return {};
        }
        
        const data = fs.readFileSync(dataPath, 'utf-8');
        const catParsed = JSON.parse(data);
        const { productive, distracted } = catParsed;
        return [productive, distracted];
    } catch (error) {
        console.error('Error loading data:', error);
        return {};
    }
}

function loadData() {
    try {
        const userDataDir = path.join(app.getPath('userData'), 'Data');
        const dataPath = path.join(userDataDir, 'data.json');
        
        if (!fs.existsSync(dataPath)) {
            console.error('File does not exist:', dataPath);
            return {};
        }
        
        const data = fs.readFileSync(dataPath, 'utf-8');
        const appUsageData = JSON.parse(data);
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
        
        return true;
    } catch (err) {
        console.error('Error saving data:', err);
        return false;
    }
}

function loadCustomCategories() {
    try {
        const userDataDir = path.join(app.getPath('userData'), 'Data');
        const filePath = path.join(userDataDir, 'custom-categories.json');
        
        if (!fs.existsSync(filePath)) {
            return {};
        }
        
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading custom categories:', error);
        return {};
    }
}

function saveCustomCategories(mappings) {
    try {
        const userDataDir = path.join(app.getPath('userData'), 'Data');
        const filePath = path.join(userDataDir, 'custom-categories.json');
        
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(mappings, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving custom categories:', error);
        return false;
    }
}