'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Calendar,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Globe,
  FileText,
  Video,
  BookOpen,
  MessageSquare,
  Package,
  User,
  Briefcase,
  Terminal,
  CodeIcon,
  Tag,
  Check
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '../ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

import { useToast } from '../../hooks/use-toast'
import useCategoryChangeToast from './category-change-toast'
import CategoryBadge from './category-badge'
import BulkCategoryDialog from './bulk-categories-dialog'
import { formatAppsData, getProductivityType, refreshCategoryMapping } from '../../utils/dataProcessor'
import { useDate } from '../../context/DateContext'
import { useTheme } from '../../context/ThemeContext'

export default function AppUsageTable() {
  const { resolvedTheme } = useTheme()

  // Theme-aware colors for timeline grid
  const gridBorderColors = {
    major: resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.3)',
    minor: resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.1)',
  }

  const [filter, setFilter] = useState('All')
  const [sortBy, setSortBy] = useState('timeSpent')
  const [sortOrder, setSortOrder] = useState('desc')
  const [apps, setApps] = useState([])
  const { selectedDate, handleDateChange } = useDate()
  const { toast } = useToast()
  const { showCategoryChangeToast } = useCategoryChangeToast()

  useEffect(() => {
    loadApps()
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for category updates (in case of multiple windows or external updates)
    const removeCategoryListener = window.activeWindow.onCategoryUpdated((data) => {
      console.log('Activity page received category update:', data)
      loadApps()
    })
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (removeCategoryListener) {
        removeCategoryListener()
      }
    }
  }, [selectedDate])

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadApps()
    }
  }
  // Add the bulk categorize handler function inside the AppUsageTable component
  async function loadApps() {
    const jsonData = await window.activeWindow.getAppUsageStats()
    const appsData = formatAppsData(jsonData, selectedDate)
    setApps(appsData)
  }
  const handleBulkCategorize = async (appIds, category) => {
    // Calculate the new productivity status based on the category
    const productivityType = getProductivityType(category)
    const newProductivity = getProductivityDisplay(productivityType)

    // Update local state with both category and productivity
    setApps(apps.map((app) => (appIds.includes(app.id) ? { ...app, category, productivity: newProductivity } : app)))

    // Show toast for bulk categorization
    const count = appIds.length
    toast({
      title: 'Categories Updated',
      description: `${count} ${count === 1 ? 'application' : 'applications'} categorized as "${category}"`,
      duration: 3000
    })

    // Save all the category changes permanently
    try {
      const appsToUpdate = apps.filter((app) => appIds.includes(app.id))
      for (const app of appsToUpdate) {
        const appIdentifier = app.domain || app.name
        await window.activeWindow.updateAppCategory(appIdentifier, category)
      }

      // Refresh the category mapping to ensure consistency across the app
      await refreshCategoryMapping()
    } catch (error) {
      console.error('Failed to save bulk category changes:', error)
      toast({
        title: 'Error',
        description: 'Some category changes may not have been saved permanently',
        variant: 'destructive'
      })
    }
  }

  // Helper function to get productivity display value from productivity type
  const getProductivityDisplay = (productivityType) => {
    switch (productivityType) {
      case 'productive':
        return 'Productive'
      case 'distracted':
        return 'Distracting'
      case 'neutral':
        return 'Neutral'
      default:
        return 'Neutral'
    }
  }

  // Update the handleCategoryChange function to show a toast notification
  const handleCategoryChange = async (appId, newCategory) => {
    const appToUpdate = apps.find((app) => app.id === appId)
    if (appToUpdate) {
      // Calculate the new productivity status based on the category
      const productivityType = getProductivityType(newCategory)
      const newProductivity = getProductivityDisplay(productivityType)

      // Update local state with both category and productivity
      setApps(apps.map((app) => (app.id === appId ? { ...app, category: newCategory, productivity: newProductivity } : app)))
      showCategoryChangeToast(appToUpdate.name, newCategory)

      try {
        const appIdentifier = appToUpdate.domain || appToUpdate.name
        const key = appToUpdate.key
        await window.activeWindow.updateAppCategory(appIdentifier, newCategory, selectedDate, key)

        // Refresh the category mapping to ensure consistency across the app
        await refreshCategoryMapping()
      } catch (error) {
        console.error('Failed to save category change permanently:', error)
        toast({
          title: 'Error',
          description: 'Failed to save category change permanently',
          variant: 'destructive'
        })
      }
    }
  }

  // Filter and sort data
  const filteredData = apps
    .filter((app) => {
      if (filter === 'All') return true
      return app.productivity === filter
    })
    .sort((a, b) => {
      if (sortBy === 'timeSpent') {
        return sortOrder === 'desc'
          ? b.timeSpentSeconds - a.timeSpentSeconds
          : a.timeSpentSeconds - b.timeSpentSeconds
      }
      if (sortBy === 'name') {
        return sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
      }
      return 0
    })

  const filteredtimeData = filteredData.filter((app) => app.timeSpent > 1)
  const totalTimeSeconds = apps.reduce((total, app) => total + app.timeSpentSeconds, 0)
  const totalHours = Math.floor(totalTimeSeconds / 3600)
  const totalMinutes = Math.floor((totalTimeSeconds % 3600) / 60)
  const totalTimeFormatted = `${totalHours}h ${totalMinutes}m`

  // Calculate productivity percentages
  const productiveTime = apps
    .filter((app) => app.productivity === 'Productive')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const neutralTime = apps
    .filter((app) => app.productivity === 'Neutral')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const distractingTime = apps
    .filter((app) => app.productivity === 'Distracting')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const productivePercentage = Math.round((productiveTime / totalTimeSeconds) * 100)
  const neutralPercentage = Math.round((neutralTime / totalTimeSeconds) * 100)
  const distractingPercentage = Math.round((distractingTime / totalTimeSeconds) * 100)

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Browsing':
        return <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      case 'Code':
        return <CodeIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
      case 'Documenting':
        return <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'Entertainment':
        return <Video className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'Learning':
        return <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      case 'Messaging':
      case 'Communication':
        return <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      case 'Miscellaneous':
        return <Package className="h-4 w-4 text-slate-600 dark:text-slate-400" />
      case 'Personal':
        return <User className="h-4 w-4 text-pink-600 dark:text-pink-400" />
      case 'Productivity':
        return <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      case 'Utility':
        return <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      default:
        return <Package className="h-4 w-4 text-slate-600 dark:text-slate-400" />
    }
  }
  const handleDate = (e) => {
    handleDateChange(e.target.value)
  }
  return (
    <Card className="bg-background/50 border-border/50 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-base">Application Usage</CardTitle>
          <div className="flex items-center space-x-1.5">
            <div className="relative inline-flex items-center bg-muted/50 text-primary border border-primary/50 text-xs px-2 py-1 rounded-md">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDate}
                className="bg-transparent text-primary outline-none text-xs"
              />

              <Calendar className="absolute right-2 w-4 h-4 text-primary pointer-events-none" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border bg-muted/50"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  {filter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-background border-border text-foreground cursor-default"
              >
                <DropdownMenuItem onClick={() => setFilter('All')}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('Productive')}>
                  Productive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('Neutral')}>Neutral</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('Distracting')}>
                  Distracting
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <BulkCategoryDialog apps={apps} onCategorize={handleBulkCategorize} />

            <Button
              onClick={loadApps}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="table" className="w-full">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <TabsList className="bg-muted/50 p-0.5">
              <TabsTrigger
                value="table"
                className="data-[state=active]:bg-muted data-[state=active]:text-primary"
              >
                Table
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                Total time: <span className="text-primary font-mono">{totalTimeFormatted}</span>
              </div>
            </div>
          </div>

          <TabsContent value="table" className="mt-0">
            <div className="rounded-md border border-border/50 overflow-hidden mx-6 mb-6">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-muted/80 border-border/50">
                    <TableHead className="text-muted-foreground w-[300px]">
                      <Button
                        variant="ghost"
                        className="p-0 font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort('name')}
                      >
                        Application
                        {sortBy === 'name' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground">
                      <Button
                        variant="ghost"
                        className="p-0 font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort('timeSpent')}
                      >
                        Time Spent
                        {sortBy === 'timeSpent' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Productivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData
                    .filter((app) => app.timeSpentSeconds > 60)
                    .map((app) => (
                      <TableRow key={app.id} className="hover:bg-muted/50 border-border/30">
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center">
                            <span className="mr-2 text-lg">{app.icon}</span>
                            {app.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <CategoryBadge category={app.category} />
                          </div>
                        </TableCell>
                        <TableCell className="text-primary font-mono">{app.timeSpent}</TableCell>
                        <TableCell>
                          <ProductivityBadge productivity={app.productivity} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{app.lastUsed}</TableCell>
                        <TableCell className="text-muted-foreground">{app.sessions}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu className="hover:cursor-pointer">
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-50 shadow-xl"
                            >
                              <DropdownMenuLabel className="text-gray-900 dark:text-slate-200">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-gray-300 dark:bg-slate-700" />
                              <DropdownMenuItem className="hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                                View Details
                              </DropdownMenuItem>

                              {/* Add category submenu */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="flex items-center hover:bg-gray-100 dark:hover:bg-slate-800">
                                  <Tag className="h-4 w-4 mr-2" />
                                  <span>Change Category</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-50 shadow-xl">
                                  {[
                                    'Browsing',
                                    'Code',
                                    'Communication',
                                    'Documenting',
                                    'Entertainment',
                                    'Learning',
                                    'Messaging',
                                    'Miscellaneous',
                                    'Personal',
                                    'Productivity',
                                    'Utility'
                                  ].map((category) => (
                                    <DropdownMenuItem
                                      key={category}
                                      className="flex items-center hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                                      onClick={() => handleCategoryChange(app.id, category)}
                                    >
                                      {getCategoryIcon(category)}
                                      <span className="ml-2">{category}</span>
                                      {app.category === category && (
                                        <Check className="h-4 w-4 ml-auto" />
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              <DropdownMenuSeparator className="bg-gray-300 dark:bg-slate-700" />
                              <DropdownMenuItem className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer">
                                Ignore App
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Replace the existing ProductivityBadge component with this:
function ProductivityBadge({ productivity }) {
  const getProductivityColor = () => {
    switch (productivity) {
      case 'Productive':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'Neutral':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'Distracting':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      default:
        return 'bg-muted/10 text-muted-foreground border-border/30'
    }
  }

  return (
    <Badge variant="outline" className={`${getProductivityColor()} text-xs`}>
      {productivity}
    </Badge>
  )
}

function AppTimelineChart({ date }) {
  const [timelineData, setTimelineData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadTimelineData() {
      try {
        setIsLoading(true)
        // Get app usage data for the selected date
        const jsonData = await window.activeWindow.getAppUsageStats(date)
        // Extract timeline data
        const extractedData = extractTimelineData(jsonData, date)
        setTimelineData(extractedData)
      } catch (error) {
        console.error('Error loading timeline data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTimelineData()
  }, [date])

  // Sort timeline data to show most used apps at the top
  const sortedTimelineData = useMemo(() => {
    return [...timelineData].sort((a, b) => {
      // Calculate total time for each app
      const totalTimeA = a.segments.reduce((sum, segment) => sum + segment.duration, 0)
      const totalTimeB = b.segments.reduce((sum, segment) => sum + segment.duration, 0)
      return totalTimeB - totalTimeA
    })
  }, [timelineData])

  return (
    <div className="h-full w-full flex flex-col p-6">
      <div className="text-sm text-muted-foreground mb-4">
        Application usage timeline for {date === getFormattedDate() ? 'Today' : date}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading timeline data...</div>
        </div>
      ) : sortedTimelineData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">No timeline data available for this date</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {' '}
          {/* Time labels - 24 hour markers with labels every 4 hours */}
          <div className="relative flex text-xs text-foreground0 mb-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const hour = i * 4
              const hourLabel =
                hour === 0 || hour === 24
                  ? '12 AM'
                  : hour === 12
                    ? '12 PM'
                    : hour > 12
                      ? `${hour - 12} PM`
                      : `${hour} AM`

              return (
                <div
                  key={i}
                  className="text-center"
                  style={{
                    position: 'absolute',
                    left: `${(hour / 24) * 100}%`,
                    width: '40px',
                    marginLeft: '-20px' // Center the label
                  }}
                >
                  {hourLabel}
                </div>
              )
            })}
          </div>
          {/* Timeline grid */}
          <div className="flex-1 border-t border-l border-border/30 relative overflow-y-auto custom-scrollbar">
            {' '}
            {/* Vertical grid lines - 24 hour markers with emphasis on 4-hour marks */}
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className="h-full border-r"
                  style={{
                    width: `${100 / 24}%`,
                    borderColor:
                      i % 4 === 0 ? gridBorderColors.major : gridBorderColors.minor
                  }}
                ></div>
              ))}
            </div>
            {/* App timelines */}
            <div className="absolute top-4 left-0 right-0 space-y-6 pb-4">
              {sortedTimelineData.slice(0, 10).map((app, index) => (
                <AppTimelineRow
                  key={index}
                  name={app.name}
                  icon={app.icon}
                  segments={app.segments}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppTimelineRow({ name, icon, segments }) {
  return (
    <div className="flex items-center">
      <div className="w-40 flex items-center">
        <span className="mr-2">{icon}</span>
        <span className="text-sm text-foreground truncate" title={name}>
          {name}
        </span>
      </div>
      <div className="flex-1 h-4 relative">
        {segments.map((segment, i) => {
          // Convert 24-hour time to percentage (0-24 hours to 0-100%)
          const startPercent = (segment.start / 24) * 100
          const widthPercent = (segment.duration / 24) * 100

          let bgColor = 'bg-green-500'
          if (segment.color === 'amber') bgColor = 'bg-amber-500'
          if (segment.color === 'red') bgColor = 'bg-red-500'
          if (segment.color === 'blue') bgColor = 'bg-blue-500'
          if (segment.color === 'purple') bgColor = 'bg-purple-500'
          if (segment.color === 'gray') bgColor = 'bg-slate-500'

          // Calculate the start and end times for the tooltip
          const startHour = Math.floor(segment.start)
          const startMinute = Math.floor((segment.start - startHour) * 60)
          const endHour = Math.floor(segment.start + segment.duration)
          const endMinute = Math.floor((segment.start + segment.duration - endHour) * 60)

          const tooltipTime = `${startHour}:${startMinute.toString().padStart(2, '0')} - ${endHour}:${endMinute.toString().padStart(2, '0')}`
          const tooltipDuration = `${Math.floor(segment.duration * 60)} minutes`

          return (
            <div
              key={i}
              className={`absolute h-3 rounded-sm ${bgColor} hover:brightness-110 cursor-pointer transition-all`}
              style={{
                left: `${startPercent}%`,
                width: `${widthPercent}%`,
                top: '2px'
              }}
              title={`${name} | ${tooltipTime} | ${tooltipDuration}`}
            ></div>
          )
        })}
      </div>
    </div>
  )
}
function StatCard({ title, value, percentage, color }) {
  const getColor = () => {
    switch (color) {
      case 'green':
        return 'from-green-500 to-emerald-500'
      case 'blue':
        return 'from-blue-500 to-cyan-500'
      case 'red':
        return 'from-red-500 to-pink-500'
      default:
        return 'from-muted to-muted/80'
    }
  }

  return (
    <div className="bg-muted/50 rounded-lg border border-border/50 p-4">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className="text-xl font-mono text-foreground mb-2">{value}</div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-muted-foreground">{percentage}% of total</div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getColor()} rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}

function AppCategoryDistribution() {
  // This would be a real chart in a production app
  return (
    <div className="h-full w-full flex p-6">
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-56 h-56">
          {/* Development - 35% */}
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full"></div>
          <div
            className="absolute inset-0 bg-cyan-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 65%, 65% 65%)' }}
          ></div>

          {/* Office - 15% */}
          <div
            className="absolute inset-0 bg-blue-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 65% 65%, 100% 65%, 100% 100%, 80% 100%)' }}
          ></div>

          {/* Communication - 20% */}
          <div
            className="absolute inset-0 bg-purple-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 80% 100%, 30% 100%)' }}
          ></div>

          {/* Entertainment - 20% */}
          <div
            className="absolute inset-0 bg-red-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 30% 100%, 0% 100%, 0% 50%)' }}
          ></div>

          {/* Social Media - 10% */}
          <div
            className="absolute inset-0 bg-amber-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 0% 50%, 0% 0%, 50% 0%)' }}
          ></div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 rounded-full w-28 h-28 flex flex-col items-center justify-center">
              <div className="text-xs text-muted-foreground">Categories</div>
              <div className="text-lg font-mono text-primary">5</div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-64 flex flex-col justify-center space-y-3">
        <div className="flex items-center text-sm">
          <div className="h-3 w-3 rounded-sm bg-cyan-500 mr-2"></div>
          <div className="text-foreground flex-1">Development</div>
          <div className="text-primary font-mono">35%</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="h-3 w-3 rounded-sm bg-blue-500 mr-2"></div>
          <div className="text-foreground flex-1">Office</div>
          <div className="text-primary font-mono">15%</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="h-3 w-3 rounded-sm bg-purple-500 mr-2"></div>
          <div className="text-foreground flex-1">Communication</div>
          <div className="text-primary font-mono">20%</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="h-3 w-3 rounded-sm bg-red-500 mr-2"></div>
          <div className="text-foreground flex-1">Entertainment</div>
          <div className="text-primary font-mono">20%</div>
        </div>
        <div className="flex items-center text-sm">
          <div className="h-3 w-3 rounded-sm bg-amber-500 mr-2"></div>
          <div className="text-foreground flex-1">Social Media</div>
          <div className="text-primary font-mono">10%</div>
        </div>
      </div>
    </div>
  )
}
// Format date to YYYY-MM-DD for consistency with your data structure
function getFormattedDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format duration in milliseconds to human-readable format
function formatDuration(durationMs) {
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}
function extractTimelineData(jsonData, date) {
  // Use a Map to group apps by name or domain identity
  const appMap = new Map()

  if (jsonData && jsonData[date] && jsonData[date].apps) {
    for (const [appName, appData] of Object.entries(jsonData[date].apps)) {
      if (appData.timestamps && appData.timestamps.length > 0) {
        // Create a unique identifier for the app (domain or description)
        const appIdentifier = appData.category || appData.description || appName

        // If this app hasn't been added yet, create a new entry
        if (!appMap.has(appIdentifier)) {
          appMap.set(appIdentifier, {
            name: appIdentifier,
            icon: getAppIcon(appName, appData.category),
            category: appData.category,
            segments: []
          })
        }

        // Add segments to the existing app entry
        const appEntry = appMap.get(appIdentifier)
        appData.timestamps.forEach((timestamp) => {
          const startTime = new Date(timestamp.start)
          const durationHours = timestamp.duration / (1000 * 60 * 60)
          const startHour = startTime.getHours() + startTime.getMinutes() / 60
          const color = getCategoryTimelineColor(appData.category)

          appEntry.segments.push({
            start: startHour,
            duration: durationHours,
            color: color
          })
        })
      }
    }
  }
  const result = Array.from(appMap.values())
  console.log('timeline array ==>', result)
  return Array.from(appMap.values())
}
// Helper function to get color based on category
function getCategoryTimelineColor(category) {
  switch (category) {
    case 'Code':
      return 'green'
    case 'Entertainment':
      return 'red'
    case 'Communication':
      return 'blue'
    case 'Browsing':
      return 'amber'
    case 'Utilities':
      return 'purple'
    default:
      return 'gray'
  }
}

// Helper function to get icon for app
function getAppIcon(appName, category) {
  if (appName.includes('Code') || appName.includes('Visual Studio')) return '💻'
  if (appName.includes('Chrome') || appName.includes('Brave') || appName.includes('Edge'))
    return '🌐'
  if (appName.includes('Teams') || appName.includes('Slack')) return '💬'
  if (appName.includes('Spotify')) return '🎵'
  if (appName.includes('YouTube')) return '📺'
  if (appName.includes('Twitter') || appName.includes('X')) return '🐦'
  if (appName.includes('LinkedIn')) return '👔'

  // Default icons based on category
  switch (category) {
    case 'Code':
      return '💻'
    case 'Entertainment':
      return '🎮'
    case 'Communication':
      return '📱'
    case 'Browsing':
      return '🌐'
    case 'Utilities':
      return '🛠️'
    default:
      return '📊'
  }
}
