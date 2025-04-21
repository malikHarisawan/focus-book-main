const { app,contextBridge, ipcRenderer } = require('electron');
const activeWindows = require('electron-active-window');
const fs = require('fs');
const { spawn } = require('child_process');
import APP_CATEGORIES from './categories';
const { exec } = require('child_process');
//const { renderCategories } = require("./settings.js")
const path = require('path');
let appUsageData = {};
let lastActiveApp = null;
let lastUpdateTime = Date.now();
let Distracted_List = [
  "Entertainment",
  "Email",
  "Communication",
  "Idle"
]

let active_url = null;
let isFocusSessionActive = false
let dismissedApps = {};
let isCoolDown = false
let startDismisstime = 0;
let focusSessionStartTime = 0;
let totalFocusTime = 0;
loadData();


async function getActiveChromeTab(pid) {
    if (!pid) {
        console.warn('Invalid PID: Cannot fetch Chrome tab info');
        return null;
    }

    return new Promise((resolve, reject) => {
        const getURLScriptPath = path.join(__dirname, "../../scripts/get_active_url.py",)
        const pythonProcess = spawn('python', [getURLScriptPath, pid.toString()]);

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    resolve(result);
                } catch (parseError) {
                    reject(`Error parsing JSON: ${parseError.message}`);
                }
            } else {
                reject(`Python process exited with code ${code}: ${error}`);
            }
        });
    });
}

const util = require('util');
const execPromise = util.promisify(exec);

async function getAppDescription(executablePath) {
    try {
     
      const escapedPath = executablePath.replace(/'/g, "''").replace(/"/g, '`"');
      
      const powershellCommand = `(Get-ItemProperty -Path '${escapedPath}' -ErrorAction SilentlyContinue).VersionInfo.FileDescription`;
      const { stdout } = await execPromise(`powershell -command "${powershellCommand}"`);
      return stdout.trim() || executablePath.split('\\').pop();
    } catch (error) {
      console.error('Error getting app description:', error);
      return executablePath ? executablePath.split('\\').pop() : 'Unknown application';
    }
  }
  
  async function getProcessDetails(pid) {
    try {
     
      const { stdout: wmiOutput } = await execPromise(`wmic process where ProcessId=${pid} get ExecutablePath /format:list`);
      const execPathMatch = wmiOutput.match(/ExecutablePath=(.+)/);
      const executablePath = execPathMatch ? execPathMatch[1].trim() : null;
      
      if (!executablePath) {
        return { description: 'Unknown application' };
      }
      
      const description = await getAppDescription(executablePath);
      
      return {
        executablePath,
        description
      };
    } catch (error) {
      console.error('Error getting process details:', error);
      return { description: 'Unknown application' };
    }
  }
async function updateAppUsage() {
    try {

        const currentWindow = await getActiveWindow();
      //  console.log("currentwindow ", currentWindow)
        if (!isValidWindow(currentWindow)) {
            return;
        }
        let appIdentifier = currentWindow.windowClass == "chrome.exe" || currentWindow.windowClass === "brave.exe"
            ? getCategory(currentWindow.windowName)
            : getCategory(currentWindow.windowClass);

        const isFocused = !Distracted_List.includes(appIdentifier)
        let isDismissed = handleDismiss(appIdentifier)

        if (isFocused && !isFocusSessionActive) {
            startFocusSession(isFocused)
        }

        if (!isFocused && isFocusSessionActive) {
            console.log(isFocusSessionActive)
            handlePopup(appIdentifier, currentWindow,isDismissed);
            endFocusSession(isFocused)
        }
        updateUsageData(currentWindow);



    } catch (error) {
        console.error('Error updating app usage:', error);
    }
}
function startFocusSession(isFocused) {
    isFocusSessionActive = true;
    focusSessionStartTime = Date.now();
    ipcRenderer.send('start-focus', isFocused);

}
function endFocusSession(isFocused) {
    isFocusSessionActive = false;
    ipcRenderer.send('end-focus', isFocused);
    const focusTime = Date.now() - focusSessionStartTime;
    totalFocusTime += focusTime;
}

function getTotalFocusTime() {
    return totalFocusTime;
}

async function getActiveWindow() {
    try {
        return await activeWindows().getActiveWindow();
    } catch (error) {
        console.error("Error getting active window", error);
        return null;
    }
}

function isValidWindow(currentWindow) {
    if (!currentWindow || !currentWindow.windowClass) {
        return false;
    }

    let isidle = getCategory(currentWindow.windowClass)

    if (isidle === "Idle") {
        return false;
    }
    return true;
}


async function updateUsageData(currentWindow) {
    const currentTime = Date.now();
    if (lastActiveApp && lastActiveApp.windowClass) {
        const timeSpent = currentTime - lastUpdateTime;
        const formattedDate = getFormattedDate();
        const formattedHour = getFormattedHour();

        if (!appUsageData.hasOwnProperty(formattedDate)) {
            appUsageData[formattedDate] = { apps: {} };
        }
        if (!appUsageData[formattedDate].hasOwnProperty(formattedHour)) {
            appUsageData[formattedDate][formattedHour] = {};
        }

        const appClass = currentWindow.windowClass;
        const appDescription = await getProcessDetails(currentWindow.windowPid);
      //  const appDescription = processInfo ? processInfo.description : appClass;
        
        console.log("app description --->", appDescription.description);
        if (appClass == "chrome.exe" || appClass == "brave.exe") {
            const pid = await getChromePid(currentWindow);
            
            if (pid) {
                const chromeTabInfo = await getActiveChromeTab(pid);
                active_url = String(chromeTabInfo.active_app);
                if(active_url === "undefined") active_url = null
            }
            updateChromeTime(formattedDate,lastActiveApp.windowName, appDescription.description,active_url, timeSpent, formattedHour);
        } else {
            updateAppTime(formattedDate, appClass, appDescription.description, timeSpent, formattedHour);
        }
    }

    lastActiveApp = currentWindow;
    lastUpdateTime = currentTime;
}

function updateAppTime(formattedDate, appClass,description, timeSpent, formattedHour) {
    if (!appUsageData[formattedDate].apps.hasOwnProperty(appClass)) {
        appUsageData[formattedDate].apps[appClass] = {
            time: 0,
            category: getCategory(appClass),
            description:description
        };
    }
    appUsageData[formattedDate].apps[appClass].time += timeSpent;

    if (!appUsageData[formattedDate][formattedHour].hasOwnProperty(appClass)) {
        appUsageData[formattedDate][formattedHour][appClass] = {
            time: 0,
            category: getCategory(appClass),
            description:description
        };
    }
    appUsageData[formattedDate][formattedHour][appClass].time += timeSpent;
}

function updateChromeTime(formattedDate, windowName,description, active_url, timeSpent, formattedHour) {
    if (!appUsageData[formattedDate].apps.hasOwnProperty(windowName)) {
        appUsageData[formattedDate].apps[windowName] = {
            time: 0,
            category: getCategory(windowName),
            domain: active_url,
            description:description
        };
    }
    appUsageData[formattedDate].apps[windowName].time += timeSpent;

    if (!appUsageData[formattedDate][formattedHour].hasOwnProperty(windowName)) {
        appUsageData[formattedDate][formattedHour][windowName] = {
            time: 0,
            category: getCategory(windowName),
            domain: active_url,
            description:description
        };
    }
    appUsageData[formattedDate][formattedHour][windowName].time += timeSpent;
}


function getFormattedDate() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getFormattedHour() {
    const currentDate = new Date();
    const hour = String(currentDate.getHours()).padStart(2, '0');
    return `${hour}:00`;
}
function handleDismiss(currentAppIdentifier) {
    const currentTime = Date.now()

    if (dismissedApps[currentAppIdentifier]) {

        if (startDismisstime) {
            const totaldismissTime = currentTime - startDismisstime
            if (totaldismissTime > 60000 * 5) {
                dismissedApps = {}
                startDismisstime = 0
            }
        }
        return true
    }

    return false

}

async function handlePopup(appIdentifier, currentWindow ,isDismissed) {


    if (!isCoolDown) {
        console.log("popup handling")
        if (!isDismissed)
            sendPopupMessage(currentWindow)
    }
}

async function sendPopupMessage(currentWindow) {
    if (currentWindow.windowClass === "chrome.exe"  ||currentWindow.windowClass === "brave.exe") {
        const pid = await getChromePid(currentWindow);
        if (pid) {
            const chromeTabInfo = await getActiveChromeTab(pid);
            active_url = String(chromeTabInfo.active_app);
        }
        ipcRenderer.send('show-popup-message', active_url, pid);
    } else {
        ipcRenderer.send('show-popup-message', currentWindow.windowClass);
    }
}

async function getChromePid(currentwindow) {
    try {
        return currentwindow.windowPid;

    } catch (error) {
        console.error('Error fetching Chrome PID:', error);
    }
    return null;
}

function getCategory(app) {
    const title = app.toLowerCase();
    for (const [category, details] of Object.entries(APP_CATEGORIES)) {
        for (const app of details.apps) {
            if (title.includes(app.toLowerCase())) {
                return category;
            }
        }
    }

    for (const [category, details] of Object.entries(APP_CATEGORIES)) {
        for (const keyword of details.keywords) {
            if (title.includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }

    return "Miscellaneous";
}

function getCategoryColor(cat) {

    if (APP_CATEGORIES.hasOwnProperty(cat)) {
        return APP_CATEGORIES[cat].color
    }

    return '#7a7a7a';
}

function getCategoryAppsData(date) {
    const apps_data = {}
    if (appUsageData[date] && appUsageData[date].apps) {

        for (const [app, appData] of Object.entries(appUsageData[date].apps)) {
            const { category, time, domain } = appData;
            const color = getCategoryColor(category)
            if (!apps_data[category]) {
                apps_data[category] = []
            }

            apps_data[category].push({ app, time, color, domain })
        }
        const appData = mergeTimeByDomain(apps_data);
        return appData
    } else {
        return null
    }

}



function mergeTimeByDomain(data) {
    const result = {};


    for (const category in data) {
        const entries = data[category];
        const domainMap = new Map();


        entries.forEach(entry => {
            const domainKey = entry.domain || entry.app;

            if (domainMap.has(domainKey)) {
                const existing = domainMap.get(domainKey);
                existing.time += entry.time;
            } else {
                domainMap.set(domainKey, { ...entry });
            }
        });


        result[category] = Array.from(domainMap.values());
    }

    return result;
}

setInterval(updateAppUsage, 1000);
setInterval(() => {
    saveData().catch(err => console.error('Error in saveData interval:', err));
  }, 6000);


async function loadData() {
    try {
      appUsageData = await ipcRenderer.invoke('load-data');
      console.log("appUsageData",appUsageData)
      return appUsageData;
    } catch (error) {
      console.error('Error loading data via IPC:', error);
      return {};
    }
  }
  
  async function saveData() {
    try {
      await ipcRenderer.invoke('save-data', appUsageData);
    } catch (error) {
      console.error('Error saving data via IPC:', error);
    }
  }
  async function getAppUsageStats(date){
    if (Object.keys(appUsageData).length === 0) {
      await loadData();
    }
    
    if (date && appUsageData[date]) {
      return {
        [date]: appUsageData[date]
      };
    }
    
    return appUsageData;
  }

function getAppUsageRange(startDate, endDate) {
    const filteredData = {};
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (const [date, data] of Object.entries(appUsageData)) {
        const currentDate = new Date(date);
        if (currentDate >= start && currentDate <= end) {
            filteredData[date] = data;
        }
    }
    
    return filteredData;
}
contextBridge.exposeInMainWorld('electronAPI', {
    sendToMain: (channel, data) => {
      const validChannels = ['stay-focused', 'cooldown', 'dismiss']
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data)
      }
    }
  });
contextBridge.exposeInMainWorld('activeWindow', {
    getAppUsageStats: (date) => getAppUsageStats(date),
    getAppUsageRange: (startDate, endDate) => getAppUsageRange(startDate, endDate),
    getFormattedStats: (date) => getFormattedStats(date),
    getCategoryAppsData: (date) => getCategoryAppsData(date),
    getCategoryColor: (cat) => getCategoryColor(cat),
    send: (channel, data) => ipcRenderer.send(channel, data),
    updateFocusUI: (callback) => {
        ipcRenderer.on('start-focus', (event, isFocused, timeDisplay) => {
            callback('start', isFocused, timeDisplay);
        });
        ipcRenderer.on('end-focus', (event, isFocused) => {
            callback('end', isFocused);   
        });
    },
    // startFocusSession: startFocusSession,
    // endFocusSession: endFocusSession,
    // getTotalFocusTime: getTotalFocusTime,
    refreshData: () => loadData()
});

function getFormattedStats(date) {
    const stats = {};
    if (appUsageData[date] && appUsageData[date].apps) {
        for (const [app, appData] of Object.entries(appUsageData[date].apps)) {
            if (!stats.hasOwnProperty(appData.category)) {
                stats[appData.category] = 0;
            }
            stats[appData.category] += appData.time
        }
        return stats;
    }
    else {
        return null
    }

}


function getDistractedApps() {
  try {
    const filePath = path.join(__dirname, 'distracted.json');
      if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
      }
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
  } catch (error) {
      console.error('Error loading data:', error);
  }
}




function handlecooldown() {
    isCoolDown = true
    setTimeout(() => {
        isCoolDown = false
    }, 60000 * 5)
}
ipcRenderer.on('cooldown', (event) => {
    handlecooldown()
})

ipcRenderer.on('dismiss', (event, appName) => {
    if (appName) {
        startDismisstime = Date.now();
        let appCat = getCategory(appName)
        
        if(Distracted_List.includes(appCat)){
        dismissedApps[appCat] = true;
        console.log("dismissedapps", dismissedApps)
        }
    }
})

