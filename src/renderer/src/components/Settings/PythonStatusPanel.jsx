import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

const PythonStatusPanel = () => {
  const [pythonStatus, setPythonStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  const fetchPythonStatus = async () => {
    try {
      setLoading(true)
      const status = await window.electronAPI.getPythonStatus()
      setPythonStatus(status)
    } catch (error) {
      console.error('Failed to fetch Python status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPythonRecovery = async () => {
    try {
      setResetting(true)
      const result = await window.electronAPI.resetPythonRecovery()
      if (result.success) {
        // Refresh status after reset
        await fetchPythonStatus()
      }
    } catch (error) {
      console.error('Failed to reset Python recovery:', error)
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    fetchPythonStatus()
    // Refresh status every 30 seconds
    const interval = setInterval(fetchPythonStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Python Environment Status</CardTitle>
          <CardDescription>Checking Python availability...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const getStatusBadge = (available, fallbackMode) => {
    if (available && !fallbackMode) {
      return <Badge className="bg-green-500">Available</Badge>
    } else if (fallbackMode) {
      return <Badge variant="destructive">Fallback Mode</Badge>
    } else {
      return <Badge variant="secondary">Not Available</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Python Environment Status</CardTitle>
        <CardDescription>
          Python is used for advanced browser tab detection and closing. When unavailable, the app uses fallback mechanisms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium">Python Available</div>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(pythonStatus?.pythonAvailable, pythonStatus?.fallbackMode)}
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium">Dependencies Checked</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={pythonStatus?.dependenciesChecked ? "default" : "secondary"}>
                {pythonStatus?.dependenciesChecked ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Current Mode</div>
          <div className="text-sm text-muted-foreground">
            {pythonStatus?.fallbackMode 
              ? "Running in fallback mode - basic browser detection only"
              : "Full Python integration - advanced browser tab detection available"
            }
          </div>
        </div>

        {pythonStatus?.errorStats && (
          <div>
            <div className="text-sm font-medium mb-2">Error Statistics</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Python Errors</div>
                <div className="font-mono">{pythonStatus.errorStats.pythonErrors}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Script Errors</div>
                <div className="font-mono">{pythonStatus.errorStats.scriptErrors}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Timeouts</div>
                <div className="font-mono">{pythonStatus.errorStats.timeouts}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchPythonStatus}
            disabled={loading}
          >
            Refresh Status
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetPythonRecovery}
            disabled={resetting}
          >
            {resetting ? "Resetting..." : "Reset Recovery System"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <div className="font-medium mb-1">What this means:</div>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Available:</strong> Python scripts work normally for advanced browser detection</li>
            <li><strong>Fallback Mode:</strong> Basic detection only - less precise but app still functions</li>
            <li><strong>Not Available:</strong> Python not found - using simplified detection methods</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default PythonStatusPanel