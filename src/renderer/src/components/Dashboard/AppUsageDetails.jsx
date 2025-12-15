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
        return 'bg-[#5051F9]/10 text-[#5051F9] border-[#5051F9]/30'
      case 'Neutral':
        return 'bg-[#1EA7FF]/10 text-[#1EA7FF] border-[#1EA7FF]/30'
      case 'Un-Productive':
      case 'Distracting':
        return 'bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]/30'
      default:
        return 'bg-[#768396]/10 text-[#768396] border-[#768396]/30'
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
    <Card className="bg-white dark:bg-[#212329] border-[#E8EDF1] dark:border-[#282932] backdrop-blur-sm mt-3">
      <CardHeader className="border-b border-[#E8EDF1] dark:border-[#282932] pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#5051F9]" />
            <CardTitle className="text-[#232360] dark:text-white text-base">App Usage Details</CardTitle>
            <Badge
              variant="outline"
              className="text-xs bg-[#5051F9]/10 text-[#5051F9] border-[#5051F9]/30"
            >
              {getRangeDescription()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#768396] dark:text-[#898999]">
              {selectedApps.length} app{selectedApps.length !== 1 ? 's' : ''}
            </span>
            {selectedApps.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-[#5051F9] hover:text-[#4142E0] hover:bg-[#5051F9]/10"
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
              className="text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white hover:bg-[#F4F7FE] dark:hover:bg-[#282932]"
              title="Close details panel"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
          <div className="bg-[#F4F7FE] dark:bg-[#1E1F25] rounded-b-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-11 text-xs text-[#768396] dark:text-[#898999] p-2.5 border-b border-[#E8EDF1] dark:border-[#282932] bg-[#F4F7FE] dark:bg-[#282932]">
              <button
                onClick={() => handleSort('name')}
                className="col-span-4 flex items-center gap-1 hover:text-[#5051F9] transition-colors text-left font-medium"
              >
                Application
                {getSortIcon('name')}
              </button>
              <button
                onClick={() => handleSort('category')}
                className="col-span-2 flex items-center gap-1 hover:text-[#5051F9] transition-colors text-left font-medium"
              >
                Category
                {getSortIcon('category')}
              </button>
              <button
                onClick={() => handleSort('time')}
                className="col-span-2 flex items-center gap-1 hover:text-[#5051F9] transition-colors text-left font-medium"
              >
                Time Spent
                {getSortIcon('time')}
              </button>
              <div className="col-span-2">Productivity</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* App List */}
            <div className="divide-y divide-[#E8EDF1] dark:divide-[#282932] max-h-80 overflow-y-auto custom-scrollbar">
              {sortedApps.map((app, index) => (
                <div
                  key={`${app.name}-${index}`}
                  className="grid grid-cols-11 py-2.5 px-2.5 text-sm hover:bg-white dark:hover:bg-[#212329] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-[#5051F9]/20 to-[#1EA7FF]/20 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-medium text-[#5051F9]">
                        {app.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-[#232360] dark:text-white font-medium truncate text-sm">
                        {app.name || 'Unknown App'}
                      </div>
                      {app.domain && (
                        <div className="text-xs text-[#768396] dark:text-[#898999] truncate">{app.domain}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-[#232360] dark:text-white flex items-center gap-1">
                    <span className="text-sm">{getCategoryIcon(app.category)}</span>
                    {app.category || 'Unknown'}
                  </div>

                  <div className="col-span-2 text-[#5051F9] font-medium">
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
                            className="h-6 w-6 text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-white dark:bg-[#212329] border-[#E8EDF1] dark:border-[#282932] text-[#232360] dark:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-[#E8EDF1] dark:bg-[#282932]" />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center">
                              <Tag className="h-4 w-4 mr-2" />
                              <span>Change Category</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="bg-white dark:bg-[#212329] border-[#E8EDF1] dark:border-[#282932]">
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
              <div className="p-2.5 border-t border-[#E8EDF1] dark:border-[#282932] bg-[#F4F7FE] dark:bg-[#282932]">
                <div className="flex items-center justify-between text-xs text-[#768396] dark:text-[#898999]">
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
