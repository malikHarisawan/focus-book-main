import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for data aggregation functionality
 * Provides methods to fetch and manage aggregated app usage data
 */
export const useDataAggregation = () => {
  const [aggregatedData, setAggregatedData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Get aggregated data for a specific date
  const getDataByDate = useCallback(async (date) => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI?.getAggregatedDataByDate(date)
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      return result
    } catch (err) {
      setError(err.message)
      console.error('Error fetching data by date:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Get all aggregated data
  const getAllData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI?.getAllAggregatedData()
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      setAggregatedData(result || [])
      return result
    } catch (err) {
      setError(err.message)
      console.error('Error fetching all aggregated data:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Get formatted usage data for dashboard
  const getFormattedData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI?.getFormattedUsageData(startDate, endDate)
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      return result || []
    } catch (err) {
      setError(err.message)
      console.error('Error fetching formatted data:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Get productivity summary for a date
  const getProductivitySummary = useCallback(async (date) => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI?.getProductivitySummary(date)
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      return result
    } catch (err) {
      setError(err.message)
      console.error('Error fetching productivity summary:', err)
      return {
        totalTime: 0,
        productive: 0,
        neutral: 0,
        unproductive: 0,
        categories: {}
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Clean up database (consolidate duplicate entries)
  const cleanupDatabase = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI?.cleanupDatabase()
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      // Refresh data after cleanup
      await getAllData()
      
      return result
    } catch (err) {
      setError(err.message)
      console.error('Error cleaning up database:', err)
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }, [getAllData])

  // Load data on hook initialization
  useEffect(() => {
    getAllData()
  }, [getAllData])

  return {
    // Data
    aggregatedData,
    loading,
    error,
    
    // Methods
    getDataByDate,
    getAllData,
    getFormattedData,
    getProductivitySummary,
    cleanupDatabase,
    
    // Utilities
    clearError: () => setError(null),
    refresh: getAllData
  }
}

// Helper functions for data formatting
export const formatAggregatedDataForChart = (data) => {
  if (!data || !Array.isArray(data)) return []
  
  return data.map(dayData => ({
    date: dayData.date,
    totalTime: Math.floor(dayData.totalTimeSpent / 1000), // Convert to seconds
    apps: Object.entries(dayData.applications || {}).map(([name, app]) => ({
      name,
      time: Math.floor(app.timeSpent / 1000),
      category: app.category,
      domain: app.domain
    })),
    categories: Object.entries(dayData.categories || {}).map(([name, time]) => ({
      name,
      time: Math.floor(time / 1000)
    }))
  }))
}

export const formatTimeSpent = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

export const getCategoryProductivity = (category) => {
  switch (category) {
    case 'Code':
    case 'Productivity':
    case 'Learning':
    case 'Documenting':
      return 'Productive'
    case 'Entertainment':
    case 'Browsing':
    case 'Personal':
      return 'Un-Productive'
    default:
      return 'Neutral'
  }
}
