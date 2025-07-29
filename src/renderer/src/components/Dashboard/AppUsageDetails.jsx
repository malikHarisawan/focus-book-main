import React, { useState, useMemo } from 'react'
import {
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Tag,
  Check
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
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

const AppUsageDetails = ({
  selectedApps = [],
  selectedRange = null,
  zoomLevel = 'hour',
  isVisible = true,
  onCategoryChange = () => {},
  onClose = () => {}
}) => {
  const [sortBy, setSortBy] = useState('time')  
  const [sortOrder, setSortOrder] = useState('desc')   
  const [showAll, setShowAll] = useState(false)

   const sortedApps = useMemo(() => {
    if (!selectedApps || selectedApps.length === 0) return []

    let sorted = [...selectedApps]

    sorted.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'time':
          aValue = a.timeSpentSeconds || 0
          bValue = b.timeSpentSeconds || 0
          break
        case 'name':
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
          break
        case 'category':
          aValue = a.category?.toLowerCase() || ''
          bValue = b.category?.toLowerCase() || ''
          break
        default:
          aValue = a.timeSpentSeconds || 0
          bValue = b.timeSpentSeconds || 0
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return showAll ? sorted : sorted.slice(0, 10)
  }, [selectedApps, sortBy, sortOrder, showAll])

  // Format time helper
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  // Get productivity color
  const getProductivityColor = (productivity) => {
    switch (productivity) {
      case 'Productive':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'Neutral':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'Un-Productive':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  // Get range description
  const getRangeDescription = () => {
    if (!selectedRange) return 'No selection'

    const { startIndex, endIndex } = selectedRange
    const rangeSize = endIndex - startIndex + 1

    switch (zoomLevel) {
      case 'hour':
        return `${rangeSize} hour${rangeSize > 1 ? 's' : ''} selected`
      case 'day':
        return `${rangeSize} hour${rangeSize > 1 ? 's' : ''} selected`
      case 'week':
        return `${rangeSize} day${rangeSize > 1 ? 's' : ''} selected`
      case 'month':
        return `${rangeSize} day${rangeSize > 1 ? 's' : ''} selected`
      default:
        return `${rangeSize} period${rangeSize > 1 ? 's' : ''} selected`
    }
  }

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  // Get sort icon
  const getSortIcon = (column) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  // Handle single app category change
  const handleSingleCategoryChange = (appIndex, newCategory) => {
    const app = selectedApps[appIndex]
    if (app) {
      onCategoryChange([`${app.name}-${appIndex}`], newCategory)
    }
  }

  // Get category icons
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Browsing':
        return '🌐'
      case 'Code':
        return '💻'
      case 'Communication':
        return '📱'
      case 'Documenting':
        return '📝'
      case 'Entertainment':
        return '🎮'
      case 'Learning':
        return '📚'
      case 'Messaging':
        return '💬'
      case 'Miscellaneous':
        return '📦'
      case 'Personal':
        return '👤'
      case 'Productivity':
        return '💼'
      case 'Utility':
        return '🛠️'
      default:
        return '📊'
    }
  }

  // Available categories
  const categories = [
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
  ]

  if (!isVisible || !selectedApps || selectedApps.length === 0) {
    return null
  }

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm mt-4">
      <CardHeader className="border-b border-slate-700/50 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-500" />
            <CardTitle className="text-slate-100">App Usage Details</CardTitle>
            <Badge
              variant="outline"
              className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
            >
              {getRangeDescription()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              {selectedApps.length} app{selectedApps.length !== 1 ? 's' : ''}
            </span>
            {selectedApps.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-cyan-400 hover:text-cyan-300"
              >
                {showAll ? 'Show Less' : 'Show All'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="text-slate-400 hover:text-slate-300"
              title="Close details panel"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
          <div className="bg-slate-800/30 rounded-b-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-11 text-xs text-slate-400 p-3 border-b border-slate-700/50 bg-slate-800/50">
              <button
                onClick={() => handleSort('name')}
                className="col-span-4 flex items-center gap-1 hover:text-cyan-400 transition-colors text-left"
              >
                Application
                {getSortIcon('name')}
              </button>
              <button
                onClick={() => handleSort('category')}
                className="col-span-2 flex items-center gap-1 hover:text-cyan-400 transition-colors text-left"
              >
                Category
                {getSortIcon('category')}
              </button>
              <button
                onClick={() => handleSort('time')}
                className="col-span-2 flex items-center gap-1 hover:text-cyan-400 transition-colors text-left"
              >
                Time Spent
                {getSortIcon('time')}
              </button>
              <div className="col-span-2">Productivity</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* App List */}
            <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
              {sortedApps.map((app, index) => (
                <div
                  key={`${app.name}-${index}`}
                  className="grid grid-cols-11 py-3 px-3 text-sm hover:bg-slate-800/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-medium text-cyan-400">
                        {app.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-300 font-medium truncate">
                        {app.name || 'Unknown App'}
                      </div>
                      {app.domain && (
                        <div className="text-xs text-slate-500 truncate">{app.domain}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-slate-400 flex items-center gap-1">
                    <span className="text-sm">{getCategoryIcon(app.category)}</span>
                    {app.category || 'Unknown'}
                  </div>

                  <div className="col-span-2 text-cyan-400 font-medium">
                    {formatTime(app.timeSpentSeconds || 0)}
                  </div>

                  <div className="col-span-2">
                    <Badge
                      variant="outline"
                      className={`${getProductivityColor(app.productivity)} text-xs`}
                    >
                      {app.productivity || 'Unknown'}
                    </Badge>
                  </div>

                  <div className="col-span-1">
                    {selectedRange && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-slate-900 border-slate-700 text-slate-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center">
                              <Tag className="h-4 w-4 mr-2" />
                              <span>Change Category</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="bg-slate-900 border-slate-700">
                              {categories.map((category) => (
                                <DropdownMenuItem
                                  key={category}
                                  className="flex items-center"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSingleCategoryChange(index, category)
                                  }}
                                >
                                  <span className="mr-2">{getCategoryIcon(category)}</span>
                                  <span className="ml-1">{category}</span>
                                  {app.category === category && (
                                    <Check className="h-4 w-4 ml-auto" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {selectedApps.length > 0 && (
              <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total:{' '}
                    {selectedApps.reduce((sum, app) => sum + (app.timeSpentSeconds || 0), 0) > 0
                      ? formatTime(
                          selectedApps.reduce((sum, app) => sum + (app.timeSpentSeconds || 0), 0)
                        )
                      : '0m'}
                  </span>
                  <span>
                    Showing {Math.min(sortedApps.length, 10)} of {selectedApps.length} apps
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
    </Card>
  )
}

export default AppUsageDetails
