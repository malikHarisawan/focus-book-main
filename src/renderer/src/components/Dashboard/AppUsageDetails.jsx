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

  // Get productivity color — uses the design category tokens.
  const getProductivityColor = (productivity) => {
    switch (productivity) {
      case 'Productive':
        return 'bg-cat-deep/10 text-cat-deep border-cat-deep/30'
      case 'Neutral':
        return 'bg-cat-comms/10 text-cat-comms border-cat-comms/30'
      case 'Distracting':
        return 'bg-cat-distract/10 text-cat-distract border-cat-distract/30'
      default:
        return 'bg-fb-muted/10 text-fb-muted border-fb-muted/30'
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

  // Handle single app category change — pass the full app object so the parent
  // can persist against the real app identifier (domain or name).
  const handleSingleCategoryChange = (appIndex, newCategory) => {
    const app = selectedApps[appIndex]
    if (app) {
      onCategoryChange(app, newCategory)
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
    <Card className="bg-fb-surface border-fb-border mt-3">
      <CardHeader className="border-b border-fb-border pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-fb-accent" />
            <CardTitle className="text-fb-text text-base">App Usage Details</CardTitle>
            <Badge
              variant="outline"
              className="text-xs bg-fb-accentsoft text-fb-accent border-fb-accent/30"
            >
              {getRangeDescription()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-fb-muted">
              {selectedApps.length} app{selectedApps.length !== 1 ? 's' : ''}
            </span>
            {selectedApps.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-fb-accent hover:brightness-110 hover:bg-fb-accentsoft"
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
              className="text-fb-muted hover:text-fb-text hover:bg-fb-surface2"
              title="Close details panel"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
          <div className="bg-fb-surface2 rounded-b-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-11 text-xs text-fb-muted p-2.5 border-b border-fb-border bg-fb-surface2">
              <button
                onClick={() => handleSort('name')}
                className="col-span-4 flex items-center gap-1 hover:text-fb-accent transition-colors text-left font-medium"
              >
                Application
                {getSortIcon('name')}
              </button>
              <button
                onClick={() => handleSort('category')}
                className="col-span-2 flex items-center gap-1 hover:text-fb-accent transition-colors text-left font-medium"
              >
                Category
                {getSortIcon('category')}
              </button>
              <button
                onClick={() => handleSort('time')}
                className="col-span-2 flex items-center gap-1 hover:text-fb-accent transition-colors text-left font-medium"
              >
                Time Spent
                {getSortIcon('time')}
              </button>
              <div className="col-span-2">Productivity</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* App List */}
            <div className="divide-y divide-fb-border max-h-80 overflow-y-auto custom-scrollbar">
              {sortedApps.map((app, index) => (
                <div
                  key={`${app.name}-${index}`}
                  className="grid grid-cols-11 py-2.5 px-2.5 text-sm hover:bg-fb-surface2 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="w-7 h-7 bg-fb-accentsoft rounded-lg flex items-center justify-center">
                      <span className="text-xs font-medium text-fb-accent">
                        {app.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-fb-text font-medium truncate text-sm">
                        {app.name || 'Unknown App'}
                      </div>
                      {app.domain && (
                        <div className="text-xs text-fb-muted truncate">{app.domain}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-fb-text flex items-center gap-1">
                    <span className="text-sm">{getCategoryIcon(app.category)}</span>
                    {app.category || 'Unknown'}
                  </div>

                  <div className="col-span-2 text-fb-accent font-medium">
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
                            className="h-6 w-6 text-fb-muted hover:text-fb-text"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-fb-surface border-fb-border text-fb-text"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-fb-border" />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center">
                              <Tag className="h-4 w-4 mr-2" />
                              <span>Change Category</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="bg-fb-surface border-fb-border">
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
              <div className="p-2.5 border-t border-fb-border bg-fb-surface2">
                <div className="flex items-center justify-between text-xs text-fb-muted">
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
