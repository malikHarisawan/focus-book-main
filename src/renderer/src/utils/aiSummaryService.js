/**
 * AI Summary Service
 * Handles AI-powered productivity summary generation with caching
 */

import { getProductivity } from './dataProcessor'

const CACHE_PREFIX = 'focusbook-summary-'
const CACHE_TTL_MINUTES = 30

/**
 * Get cache key for a specific date
 */
function getCacheKey(date) {
  return `${CACHE_PREFIX}${date}`
}

/**
 * Check if cached summary exists and is still valid
 */
export function getCachedSummary(date) {
  try {
    const cacheKey = getCacheKey(date)
    const cached = localStorage.getItem(cacheKey)
    
    if (!cached) {
      return null
    }

    const { data, expiresAt } = JSON.parse(cached)
    const now = new Date().getTime()

    // Check if cache has expired
    if (now > expiresAt) {
      localStorage.removeItem(cacheKey)
      return null
    }

    return data
  } catch (error) {
    console.error('Error reading cached summary:', error)
    return null
  }
}

/**
 * Save summary to cache with expiration
 */
export function cacheSummary(date, summaryData) {
  try {
    const cacheKey = getCacheKey(date)
    const now = new Date().getTime()
    const expiresAt = now + (CACHE_TTL_MINUTES * 60 * 1000) // 30 minutes in milliseconds

    const cacheData = {
      data: summaryData,
      timestamp: now,
      expiresAt: expiresAt
    }

    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (error) {
    console.error('Error caching summary:', error)
  }
}

/**
 * Clear cache for a specific date
 */
export function clearSummaryCache(date) {
  try {
    const cacheKey = getCacheKey(date)
    localStorage.removeItem(cacheKey)
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

/**
 * Format activity data into a structured format for AI
 */
function formatActivityDataForAI(apps) {
  return apps.map(app => ({
    name: app.name,
    category: app.category,
    timeSpentSeconds: app.timeSpentSeconds,
    timeSpent: app.timeSpent,
    productivity: app.productivity
  }))
}

/**
 * Calculate basic statistics from activity data
 */
function calculateStats(apps) {
  const totalSeconds = apps.reduce((sum, app) => sum + app.timeSpentSeconds, 0)
  
  // Productivity level is DB-driven. Prefer the level already computed upstream
  // (app.productivity); fall back to the shared getProductivity(category) lookup.
  // No hardcoded category-name lists — they used to disagree with the rest of the
  // app (e.g. Browsing was Neutral here but Distracting elsewhere).
  const levelOf = (app) => app.productivity || getProductivity(app.category)

  const productive = apps.filter((app) => levelOf(app) === 'Productive')
  const neutral = apps.filter((app) => levelOf(app) === 'Neutral')
  const distracting = apps.filter((app) => levelOf(app) === 'Distracting')

  const productiveSeconds = productive.reduce((sum, app) => sum + app.timeSpentSeconds, 0)
  const neutralSeconds = neutral.reduce((sum, app) => sum + app.timeSpentSeconds, 0)
  const distractingSeconds = distracting.reduce((sum, app) => sum + app.timeSpentSeconds, 0)

  return {
    totalSeconds,
    productive: {
      apps: productive,
      seconds: productiveSeconds,
      percentage: totalSeconds > 0 ? Math.round((productiveSeconds / totalSeconds) * 100) : 0
    },
    neutral: {
      apps: neutral,
      seconds: neutralSeconds,
      percentage: totalSeconds > 0 ? Math.round((neutralSeconds / totalSeconds) * 100) : 0
    },
    distracting: {
      apps: distracting,
      seconds: distractingSeconds,
      percentage: totalSeconds > 0 ? Math.round((distractingSeconds / totalSeconds) * 100) : 0
    }
  }
}

/**
 * Format seconds into human-readable time
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

/**
 * Create structured prompt for AI summary
 */
function createSummaryPrompt(date, apps, stats) {
  const formattedData = formatActivityDataForAI(apps)
  
  return `Analyze the productivity data for ${date} and provide a detailed summary.

Activity Data:
${JSON.stringify(formattedData, null, 2)}

Statistics:
- Total Time: ${formatTime(stats.totalSeconds)}
- Productive: ${formatTime(stats.productive.seconds)} (${stats.productive.percentage}%)
- Neutral: ${formatTime(stats.neutral.seconds)} (${stats.neutral.percentage}%)
- Distracting: ${formatTime(stats.distracting.seconds)} (${stats.distracting.percentage}%)

Please provide a comprehensive summary in the following JSON format:
{
  "overview": "Brief 2-3 sentence overview of the day's productivity",
  "totalTime": "${formatTime(stats.totalSeconds)}",
  "productivePercentage": ${stats.productive.percentage},
  "topActivity": {
    "name": "name of most used application",
    "time": "time spent",
    "percentage": percentage_of_total
  },
  "categories": [
    {
      "type": "Productive",
      "time": "${formatTime(stats.productive.seconds)}",
      "percentage": ${stats.productive.percentage},
      "apps": [
        {"name": "App Name", "time": "time", "percentage": percentage_of_category}
      ]
    },
    {
      "type": "Neutral",
      "time": "${formatTime(stats.neutral.seconds)}",
      "percentage": ${stats.neutral.percentage},
      "apps": []
    },
    {
      "type": "Distracting",
      "time": "${formatTime(stats.distracting.seconds)}",
      "percentage": ${stats.distracting.percentage},
      "apps": []
    }
  ],
  "insights": [
    "Insight 1 about productivity patterns",
    "Insight 2 about focus areas",
    "Insight 3 with recommendations"
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ]
}

Respond ONLY with valid JSON, no additional text.`
}

/**
 * Parse AI response and validate structure
 */
function parseSummaryResponse(response) {
  try {
    // Extract JSON from response if it's wrapped in markdown code blocks
    let jsonStr = response
    
    // Remove markdown code blocks if present
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim()
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim()
    }

    const parsed = JSON.parse(jsonStr)

    // Validate required fields
    if (!parsed.overview || !parsed.categories) {
      throw new Error('Invalid summary structure')
    }

    return parsed
  } catch (error) {
    console.error('Error parsing AI summary response:', error)
    throw new Error('Failed to parse AI summary response')
  }
}

/**
 * Create fallback summary when AI is unavailable
 */
function createFallbackSummary(date, apps, stats) {
  // Sort apps by time spent
  const sortedApps = [...apps].sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
  const topApp = sortedApps[0]

  const fallbackData = {
    overview: `On ${date}, you spent ${formatTime(stats.totalSeconds)} across ${apps.length} applications. ${stats.productive.percentage}% of your time was productive.`,
    totalTime: formatTime(stats.totalSeconds),
    productivePercentage: stats.productive.percentage,
    topActivity: topApp ? {
      name: topApp.name,
      time: topApp.timeSpent,
      percentage: stats.totalSeconds > 0 ? Math.round((topApp.timeSpentSeconds / stats.totalSeconds) * 100) : 0
    } : null,
    categories: [
      {
        type: 'Productive',
        time: formatTime(stats.productive.seconds),
        percentage: stats.productive.percentage,
        apps: stats.productive.apps
          .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
          .map(app => ({
            name: app.name,
            time: app.timeSpent,
            percentage: stats.productive.seconds > 0 ? 
              Math.round((app.timeSpentSeconds / stats.productive.seconds) * 100) : 0
          }))
      },
      {
        type: 'Neutral',
        time: formatTime(stats.neutral.seconds),
        percentage: stats.neutral.percentage,
        apps: stats.neutral.apps
          .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
          .map(app => ({
            name: app.name,
            time: app.timeSpent,
            percentage: stats.neutral.seconds > 0 ? 
              Math.round((app.timeSpentSeconds / stats.neutral.seconds) * 100) : 0
          }))
      },
      {
        type: 'Distracting',
        time: formatTime(stats.distracting.seconds),
        percentage: stats.distracting.percentage,
        apps: stats.distracting.apps
          .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
          .map(app => ({
            name: app.name,
            time: app.timeSpent,
            percentage: stats.distracting.seconds > 0 ? 
              Math.round((app.timeSpentSeconds / stats.distracting.seconds) * 100) : 0
          }))
      }
    ],
    insights: [
      'AI summary is currently unavailable',
      'Showing basic statistics from your activity data'
    ],
    recommendations: [],
    isFallback: true
  }

  return fallbackData
}

/**
 * Generate productivity summary using AI or fallback
 */
export async function generateSummary(date, apps, forceRefresh = false) {
  try {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = getCachedSummary(date)
      if (cached) {
        console.log('Using cached summary for', date)
        return { success: true, data: cached, fromCache: true }
      }
    }

    // Calculate statistics
    const stats = calculateStats(apps)

    // Check if we have any data
    if (apps.length === 0 || stats.totalSeconds === 0) {
      return {
        success: true,
        data: {
          overview: `No activity recorded for ${date}.`,
          totalTime: '0s',
          productivePercentage: 0,
          topActivity: null,
          categories: [
            { type: 'Productive', time: '0s', percentage: 0, apps: [] },
            { type: 'Neutral', time: '0s', percentage: 0, apps: [] },
            { type: 'Distracting', time: '0s', percentage: 0, apps: [] }
          ],
          insights: ['No activity data available for this date'],
          recommendations: [],
          isEmpty: true
        },
        fromCache: false
      }
    }

    // Check if AI service is available
    const serviceStatus = await window.electronAPI.getAiServiceStatus()
    
    if (!serviceStatus.isRunning) {
      console.warn('AI service not running, using fallback summary')
      const fallbackData = createFallbackSummary(date, apps, stats)
      cacheSummary(date, fallbackData)
      return { success: true, data: fallbackData, fromCache: false, isFallback: true }
    }

    // Generate AI summary
    console.log('Generating AI summary for', date)
    const prompt = createSummaryPrompt(date, apps, stats)
    const aiResponse = await window.electronAPI.aiChat(prompt)

    if (aiResponse.error) {
      throw new Error(aiResponse.error)
    }

    // Parse and validate AI response
    const summaryData = parseSummaryResponse(aiResponse.reply)

    // Cache the result
    cacheSummary(date, summaryData)

    return { success: true, data: summaryData, fromCache: false }

  } catch (error) {
    console.error('Error generating AI summary:', error)
    
    // Return fallback summary on error
    const stats = calculateStats(apps)
    const fallbackData = createFallbackSummary(date, apps, stats)
    
    // Don't cache fallback on error (might be temporary)
    return { 
      success: false, 
      data: fallbackData, 
      error: error.message,
      isFallback: true 
    }
  }
}

/**
 * Invalidate all summary caches (useful after bulk category changes)
 */
export function clearAllSummaryCaches() {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('Error clearing all caches:', error)
  }
}
