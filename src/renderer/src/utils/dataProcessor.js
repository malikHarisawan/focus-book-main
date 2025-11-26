// Note: This will be replaced by database-driven productivity mapping
// Kept as fallback for when database categories aren't loaded yet
const DEFAULT_FOCUS_CATEGORIES = ['Code', 'Documenting', 'Learning']
const DEFAULT_NEUTRAL_CATEGORIES = ['Utility', 'Miscellaneous', 'Personal', 'Utilities']
const DEFAULT_UNPRODUCTIVE = ['Entertainment', 'Messaging', 'Communication', 'Browsing']

// Global variable to store database category mappings
let categoryProductivityMap = null

// Function to load category productivity mapping from main process
async function loadCategoryProductivityMapping() {
  try {
    // Request categories from the main process via activeWindow API
    const categories = await window.activeWindow.loadCategories()
    if (categories && Array.isArray(categories)) {
      categoryProductivityMap = {}
      categories.forEach(category => {
        if (category.name && category.productivity_type) {
          categoryProductivityMap[category.name] = category.productivity_type
        }
      })
      console.log('Dashboard: Category productivity mapping loaded:', categoryProductivityMap)
    }
  } catch (error) {
    console.error('Dashboard: Error loading category productivity mapping:', error)
  }
}

// Initialize the mapping when the module loads
loadCategoryProductivityMapping()

// Export function to refresh category mappings if needed
export const refreshCategoryMapping = () => {
  return loadCategoryProductivityMapping()
}
export const formatTime = (milliseconds) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours * 60 + minutes}`
}

const getProductivity = (category) => {
  // First try to use database mapping if available
  if (categoryProductivityMap && categoryProductivityMap[category]) {
    const productivityType = categoryProductivityMap[category]
    switch (productivityType) {
      case 'productive':
        return 'Productive'
      case 'distracted':
        return 'Un-Productive'
      case 'neutral':
        return 'Neutral'
      default:
        return 'Neutral'
    }
  }

  // Fallback to static arrays if database mapping not loaded
  if (DEFAULT_FOCUS_CATEGORIES.includes(category)) {
    return 'Productive'
  } else if (DEFAULT_UNPRODUCTIVE.includes(category)) {
    return 'Un-Productive'
  } else {
    return 'Neutral'
  }
}

// Export getProductivityType for external use
export const getProductivityType = (category) => {
  // First try to use database mapping if available
  if (categoryProductivityMap && categoryProductivityMap[category]) {
    return categoryProductivityMap[category]
  }

  // Fallback to static arrays if database mapping not loaded
  if (DEFAULT_FOCUS_CATEGORIES.includes(category)) {
    return 'productive'
  } else if (DEFAULT_UNPRODUCTIVE.includes(category)) {
    return 'distracted'
  } else {
    return 'neutral'
  }
}

// Extract domain name from URL or app identifier
export const extractDomainName = (domain, fallbackName = '') => {
  if (!domain) return fallbackName

  try {
    // Handle special browser protocols
    if (domain.startsWith('chrome://') || domain.startsWith('edge://') || domain.startsWith('brave://')) {
      return domain.split('://')[1].split('/')[0] || domain
    }

    // Remove protocol
    let d = domain.replace(/^https?:\/\//i, '').replace(/^ftp:\/\//i, '')

    // Remove www prefix
    d = d.replace(/^www\./i, '')

    // Remove path, query, and hash
    d = d.split('/')[0].split('?')[0].split('#')[0]

    // Remove port if present
    d = d.split(':')[0]

    return d || fallbackName
  } catch (e) {
    return fallbackName
  }
}

export function formatAppsData(rawData, date) {
  const appMap = new Map()

  const apps = rawData[date]?.apps || {}
  for (const [key, value] of Object.entries(apps)) {
    // Standardize app name resolution - same as Dashboard logic
    const name = (value.domain || value.description || key).toLowerCase()
    const displayName = value.domain || value.description || key
    const prevTime = appMap.get(name)?.timeSpentSeconds || 0

    appMap.set(name, {
      key: key,
      name: displayName, // Use original case for display
      category: value.category,
      timeSpentSeconds: prevTime + value.time
    })
  }

  function formatAppsTime(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h > 0 ? h + 'h ' : ''}${m}m`
  }

  const result = []
  let id = 1
  for (const app of appMap.values()) {
    result.push({
      id: id++,
      key: app.key,
      name: app.name,
      category: app.category,
      timeSpent: formatAppsTime(Math.floor(app.timeSpentSeconds / 1000)),
      timeSpentSeconds: Math.floor(app.timeSpentSeconds / 1000),
      productivity: getProductivity(app.category),
      trend: 'up' // static for now; could be dynamic with historical data
    })
  }

  return result
}

export const processUsageChartData = (jsonData, date, viewType = 'day') => {
  if (viewType === 'day') {
    if (!jsonData || !jsonData[date]) {
      return []
    }

    console.log('data in the utility function ', jsonData)
    const hourlyData = []

    for (let i = 9; i <= 21; i++) {
      hourlyData.push({
        name: i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`,
        Code: 0,
        Browsing: 0,
        Communication: 0,
        Utilities: 0,
        Entertainment: 0,
        Miscellaneous: 0
      })
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour >= 24) continue

      const index = hour - 9
      if (index < 0 || index >= hourlyData.length) continue

      for (const app of Object.values(hourData)) {
        if (app.category) {
          if (hourlyData[index][app.category] !== undefined) {
            hourlyData[index][app.category] += app.time / 1000
          } else {
            hourlyData[index][app.category] = app.time / 1000
          }
        }
      }
    }

    return hourlyData
  } else {
    // if (!jsonData || !jsonData[date]) {
    //   return [];
    // }

    const weekData = []
    const dateObj = new Date(date)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(dateObj)
      currentDate.setDate(dateObj.getDate() - dateObj.getDay() + i)

      const formattedDate = currentDate.toISOString().split('T')[0]

      const dayData = {
        name: dayNames[i],
        Code: 0,
        Browsing: 0,
        Communication: 0,
        Utilities: 0,
        Entertainment: 0,
        Miscellaneous: 0
      }

      if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
        for (const app of Object.values(jsonData[formattedDate].apps)) {
          if (app.category) {
            if (dayData[app.category] !== undefined) {
              dayData[app.category] += app.time / 1000
            } else {
              dayData[app.category] = app.time / 1000
            }
          }
        }
      }

      weekData.push(dayData)
    }
    console.log('week', weekData)
    return weekData
  }
}

export const processProductiveChartData = (jsonData, date, viewType = 'day') => {
  if (viewType === 'hour') {
    if (!jsonData || !jsonData[date]) {
      return []
    }
    const hourlyData = []

    for (let i = 9; i <= 21; i++) {
      hourlyData.push({
        day: i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`,
        productive: 0,
        unproductive: 0
      })
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue

      const index = hour - 9
      if (index < 0 || index >= hourlyData.length) continue

      for (const app of Object.values(hourData)) {
        if (!app.category || !app.time) continue

        const seconds = app.time / 1000
        const isProductive = getProductivity(app.category)

        if (isProductive == 'Productive') {
          hourlyData[index].productive += seconds
        } else {
          hourlyData[index].unproductive += seconds
        }
      }
    }

    return hourlyData
  } else if (viewType === 'day') {
    if (!jsonData || !jsonData[date]) {
      return []
    }
    const fullDayData = []

    for (let i = 0; i < 24; i++) {
      fullDayData.push({
        day: i === 0 ? '12AM' : i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`,
        productive: 0,
        unproductive: 0
      })
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue

      for (const app of Object.values(hourData)) {
        if (!app.category || !app.time) continue

        const seconds = app.time / 1000
        const isProductive = getProductivity(app.category)

        if (isProductive == 'Productive') {
          fullDayData[hour].productive += seconds
        } else {
          fullDayData[hour].unproductive += seconds
        }
      }
    }

    return fullDayData
  } else if (viewType === 'week') {
    const weekData = []
    const dateObj = new Date(date)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(dateObj)
      currentDate.setDate(dateObj.getDate() - dateObj.getDay() + i)
      const formattedDate = currentDate.toISOString().split('T')[0]

      const dayData = {
        day: dayNames[i],
        productive: 0,
        unproductive: 0
      }

      if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
        for (const app of Object.values(jsonData[formattedDate].apps)) {
          if (!app.category || !app.time) continue

          const seconds = app.time / 1000
          const isProductive = getProductivity(app.category)

          if (isProductive == 'Productive') {
            dayData.productive += seconds
          } else {
            dayData.unproductive += seconds
          }
        }
      }

      weekData.push(dayData)
    }

    return weekData
  } else if (viewType === 'month') {
    const monthData = []
    const dateObj = new Date(date)
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day)
      const formattedDate = currentDate.toISOString().split('T')[0]

      const dayData = {
        day: day.toString(),
        productive: 0,
        unproductive: 0
      }

      if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
        for (const app of Object.values(jsonData[formattedDate].apps)) {
          if (!app.category || !app.time) continue

          const seconds = app.time / 1000
          const isProductive = getProductivity(app.category)

          if (isProductive == 'Productive') {
            dayData.productive += seconds
          } else {
            dayData.unproductive += seconds
          }
        }
      }

      monthData.push(dayData)
    }

    return monthData
  }
}

export const processMostUsedApps = (jsonData, date) => {
  if (!jsonData || !jsonData[date]) {
    return []
  }

  const appTimeMap = {}

  // Use daily aggregated apps data if available (this should be the pre-aggregated total)
  // Only fall back to hourly aggregation if daily data is missing
  if (jsonData[date].apps && Object.keys(jsonData[date].apps).length > 0) {
    // Process daily aggregated apps data (this is already the total for the day)
    for (const [name, data] of Object.entries(jsonData[date].apps)) {
      const displayName = data.domain || data.description || name
      const key = displayName.toLowerCase() // Standardize key for grouping
      const productivity = getProductivity(data.category)

      if (appTimeMap[key]) {
        // Aggregate time for apps with same normalized name
        appTimeMap[key].time += data.time
      } else {
        appTimeMap[key] = {
          name: displayName, // Keep original case for display
          time: data.time,
          category: data.category,
          domain: data.domain,
          description: data.description,
          productivity: productivity
        }
      }
    }
  } else {
    // Fallback: Process hourly data if daily aggregated data is not available
    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      // Skip the 'apps' key and only process time-formatted keys
      if (hourKey === 'apps' || !hourKey.match(/^\d{2}:\d{2}$/)) {
        continue
      }

      for (const [name, data] of Object.entries(hourData)) {
        const displayName = data.domain || data.description || name
        const key = displayName.toLowerCase() // Standardize key for grouping
        const productivity = getProductivity(data.category)

        if (appTimeMap[key]) {
          appTimeMap[key].time += data.time
        } else {
          appTimeMap[key] = {
            name: displayName, // Keep original case for display
            time: data.time,
            category: data.category,
            domain: data.domain,
            description: data.description,
            productivity: productivity
          }
        }
      }
    }
  }

  const apps = Object.values(appTimeMap)

  console.log('apps ==>> ', apps)
  apps.sort((a, b) => b.time - a.time)

  const maxTime = apps[0]?.time || 1

  return apps.length > 5
    ? apps.slice(0, 5).map((app) => ({
        name: app.name, // Use the standardized display name
        time: formatTime(app.time),
        usagePercent: app.time / maxTime,
        icon: app.name.charAt(0).toUpperCase(),
        category: app.category,
        productivity: app.productivity
      }))
    : apps.map((app) => ({
        name: app.name, // Use the standardized display name
        time: formatTime(app.time),
        usagePercent: app.time / maxTime,
        icon: app.name.charAt(0).toUpperCase(),
        category: app.category,
        productivity: app.productivity
      }))
}

const isProductiveCategory = (category) => {
  if (categoryProductivityMap && categoryProductivityMap[category]) {
    return categoryProductivityMap[category] === 'productive'
  }
  // Fallback to static categories
  return DEFAULT_FOCUS_CATEGORIES.includes(category)
}

export const getTotalFocusTime = (jsonData, date, processedChartData, view) => {
  let totalTime = 0

  if (view === 'day') {
    if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
      return '0'
    }
    for (const app of Object.values(jsonData[date].apps)) {
      if (isProductiveCategory(app.category)) {
        totalTime += app.time
      }
    }
    return formatTime(totalTime)
  } else {
    for (const day of processedChartData) {
      for (const key in day) {
        if (key !== 'name') {
          console.log(day[key])
          totalTime += day[key]
        }
      }
    }
    const average = formatTime((totalTime * 1000) / processedChartData.length)
    console.log('average', processedChartData.length)
    return average
  }
}

export const getTotalScreenTime = (jsonData, date, processedChartData, view) => {
  let totalTime = 0

  if (view === 'day') {
    if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
      return '0h 0m'
    }
    for (const app of Object.values(jsonData[date].apps)) {
      totalTime += app.time
    }
    console.log('totaltime ', formatTime(totalTime))
    return formatTime(totalTime)
  } else {
    for (const day of processedChartData) {
      for (const key in day) {
        if (key !== 'name') {
          console.log(day[key])
          totalTime += day[key]
        }
      }
    }
    const average = formatTime((totalTime * 1000) / processedChartData.length)
    console.log('average', processedChartData.length)
    return average
  }
}

export const getCategoryBreakdown = (jsonData, date) => {
  if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
    return []
  }

  const categories = {
    Code: { time: 0, color: 'text-green-400' },
    Browsing: { time: 0, color: 'text-purple-400' },
    Communication: { time: 0, color: 'text-blue-500' },
    Utilities: { time: 0, color: 'text-sky-400' },
    Entertainment: { time: 0, color: 'text-rose-400' },
    Miscellaneous: { time: 0, color: 'text-gray-500' }
  }

  for (const app of Object.values(jsonData[date].apps)) {
    if (app.category && categories[app.category]) {
      categories[app.category].time += app.time
    }
  }

  return Object.entries(categories)
    .filter(([_, data]) => data.time > 60000)
    .sort((a, b) => b[1].time - a[1].time)
    .map(([name, data]) => ({
      name: name,
      time: formatTime(data.time),
      color: data.color
    }))
}

/**
 * Extract apps from selected time range with detailed usage information
 * @param {Object} rawData - Raw usage data
 * @param {string} selectedDate - Currently selected date
 * @param {Object} selectedRange - Selected range with startIndex and endIndex
 * @param {Array} chartData - Processed chart data for the current view
 * @param {string} zoomLevel - Current zoom level (hour, day, week, month)
 * @returns {Array} Array of apps with their usage details for the selected range
 */
export const getAppsForSelectedRange = (
  rawData,
  selectedDate,
  selectedRange,
  chartData,
  
  zoomLevel
) => {
  if (!rawData || !selectedDate || !selectedRange || !chartData || chartData.length === 0) {
    return []
  }

  const { startIndex, endIndex } = selectedRange
  const appUsageMap = new Map()

  try {
    if (zoomLevel === 'hour' || zoomLevel === 'day') {
      // For hour/day view, extract apps from specific hours
      if (!rawData[selectedDate]) return []

      const selectedHours = chartData.slice(startIndex, endIndex + 1)

      for (const hourData of selectedHours) {
        const hourKey = hourData.day

        // Convert display format back to hour format for lookup
        let hour24Format
        if (hourKey.includes('AM') || hourKey.includes('PM')) {
          const hourNum = parseInt(hourKey.replace(/[AP]M/, ''))
          if (hourKey.includes('AM')) {
            hour24Format = hourNum === 12 ? 0 : hourNum
          } else {
            hour24Format = hourNum === 12 ? 12 : hourNum + 12
          }
        } else {
          hour24Format = parseInt(hourKey)
        }

        const hourString = `${hour24Format}:00`
        const hourlyData = rawData[selectedDate][hourString]

        if (hourlyData) {
          for (const [appKey, appData] of Object.entries(hourlyData)) {
            const appName = appData.domain || appData.description || appKey
            const existingApp = appUsageMap.get(appName)

            if (existingApp) {
              existingApp.timeSpentSeconds += Math.floor(appData.time / 1000)
            } else {
              appUsageMap.set(appName, {
                name: appName,
                key: appKey,
                category: appData.category,
                domain: appData.domain,
                description: appData.description,
                timeSpentSeconds: Math.floor(appData.time / 1000),
                productivity: getProductivity(appData.category)
              })
            }
          }
        }
      }
    } else if (zoomLevel === 'week') {
      // For week view, extract apps from specific days
      const selectedDays = chartData.slice(startIndex, endIndex + 1)
      const dateObj = new Date(selectedDate)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      for (const dayData of selectedDays) {
        const dayIndex = dayNames.indexOf(dayData.day)
        if (dayIndex === -1) continue

        const currentDate = new Date(dateObj)
        currentDate.setDate(dateObj.getDate() - dateObj.getDay() + dayIndex)
        const formattedDate = currentDate.toISOString().split('T')[0]

        if (rawData[formattedDate] && rawData[formattedDate].apps) {
          for (const [appKey, appData] of Object.entries(rawData[formattedDate].apps)) {
            const appName = appData.domain || appData.description || appKey
            const existingApp = appUsageMap.get(appName)

            if (existingApp) {
              existingApp.timeSpentSeconds += Math.floor(appData.time / 1000)
            } else {
              appUsageMap.set(appName, {
                name: appName,
                key: appKey,
                category: appData.category,
                domain: appData.domain,
                description: appData.description,
                timeSpentSeconds: Math.floor(appData.time / 1000),
                productivity: getProductivity(appData.category)
              })
            }
          }
        }
      }
    } else if (zoomLevel === 'month') {
      // For month view, extract apps from specific days
      const selectedDays = chartData.slice(startIndex, endIndex + 1)
      const dateObj = new Date(selectedDate)
      const year = dateObj.getFullYear()
      const month = dateObj.getMonth()

      for (const dayData of selectedDays) {
        const dayNum = parseInt(dayData.day)
        if (isNaN(dayNum)) continue

        const currentDate = new Date(year, month, dayNum)
        const formattedDate = currentDate.toISOString().split('T')[0]

        if (rawData[formattedDate] && rawData[formattedDate].apps) {
          for (const [appKey, appData] of Object.entries(rawData[formattedDate].apps)) {
            const appName = appData.domain || appData.description || appKey
            const existingApp = appUsageMap.get(appName)

            if (existingApp) {
              existingApp.timeSpentSeconds += Math.floor(appData.time / 1000)
            } else {
              appUsageMap.set(appName, {
                name: appName,
                key: appKey,
                category: appData.category,
                domain: appData.domain,
                description: appData.description,
                timeSpentSeconds: Math.floor(appData.time / 1000),
                productivity: getProductivity(appData.category)
              })
            }
          }
        }
      }
    }

    // Convert to array and sort by time spent
    const result = Array.from(appUsageMap.values())
      .filter((app) => app.timeSpentSeconds > 0)
      .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)

    console.log('Extracted apps for selected range:', result)
    return result
  } catch (error) {
    console.error('Error extracting apps for selected range:', error)
    return []
  }
}
