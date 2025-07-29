import React, { useState } from 'react'
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Info
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useDataAggregation } from '../../hooks/useDataAggregation'

const DatabaseManager = () => {
  const [cleanupStatus, setCleanupStatus] = useState(null)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  
  const { 
    aggregatedData, 
    loading, 
    error, 
    cleanupDatabase, 
    refresh 
  } = useDataAggregation()

  const handleCleanup = async () => {
    setIsCleaningUp(true)
    setCleanupStatus(null)
    
    try {
      const result = await cleanupDatabase()
      
      if (result?.error) {
        setCleanupStatus({
          type: 'error',
          message: `Cleanup failed: ${result.error}`
        })
      } else {
        setCleanupStatus({
          type: 'success',
          message: `Database cleaned up successfully! Processed ${result.recordsProcessed || 0} records.`
        })
      }
    } catch (err) {
      setCleanupStatus({
        type: 'error',
        message: `Cleanup failed: ${err.message}`
      })
    } finally {
      setIsCleaningUp(false)
    }
  }

  const handleRefresh = async () => {
    setCleanupStatus(null)
    await refresh()
  }

  const getDatabaseStats = () => {
    if (!aggregatedData || aggregatedData.length === 0) {
      return {
        totalDays: 0,
        totalApps: 0,
        totalTime: 0
      }
    }

    let totalApps = 0
    let totalTime = 0

    aggregatedData.forEach(dayData => {
      if (dayData.applications) {
        totalApps += Object.keys(dayData.applications).length
      }
      totalTime += dayData.totalTimeSpent || 0
    })

    return {
      totalDays: aggregatedData.length,
      totalApps,
      totalTime: Math.floor(totalTime / 1000) // Convert to seconds
    }
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const stats = getDatabaseStats()

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-cyan-500" />
          <CardTitle className="text-slate-100">Database Management</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {/* Database Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/30 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Total Days</div>
            <div className="text-lg font-semibold text-slate-100">{stats.totalDays}</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Total Apps</div>
            <div className="text-lg font-semibold text-slate-100">{stats.totalApps}</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Total Time</div>
            <div className="text-lg font-semibold text-slate-100">{formatTime(stats.totalTime)}</div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {cleanupStatus && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${
            cleanupStatus.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {cleanupStatus.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <span className={`text-sm ${
              cleanupStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {cleanupStatus.message}
            </span>
          </div>
        )}

        {/* Information */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-400 mt-0.5" />
            <div className="text-xs text-blue-400">
              <div className="font-medium mb-1">Database Cleanup</div>
              <div>
                This will consolidate multiple entries for the same date into single records,
                combining time spent and maintaining detailed activity data. This improves
                performance and reduces storage usage.
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCleanup}
            disabled={isCleaningUp || loading}
            variant="outline"
            className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
          >
            {isCleaningUp ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {isCleaningUp ? 'Cleaning...' : 'Cleanup Database'}
          </Button>

          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="ghost"
            className="text-slate-400 hover:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Recent Data Preview */}
        {aggregatedData.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Recent Activity</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {aggregatedData.slice(0, 5).map((dayData, index) => (
                <div key={dayData.date || index} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{dayData.date}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(dayData.applications || {}).length} apps
                    </Badge>
                    <span className="text-slate-500">
                      {formatTime(Math.floor((dayData.totalTimeSpent || 0) / 1000))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default DatabaseManager
