import React, { useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Home } from 'lucide-react'
import { useDate } from '../../context/DateContext'
import { useTheme } from '../../context/ThemeContext'

const SmartDatePicker = ({ zoomLevel = 'hour', onDateChange, className = '' }) => {
  const { theme } = useTheme()
  const {
    selectedDate,
    handleDateChange,
    goToPrevious,
    goToNext,
    goToToday,
    getFormattedDateRange
  } = useDate()
  const dateInputRef = useRef(null)

  const handlePrevious = () => {
    goToPrevious(zoomLevel)
    onDateChange?.()
  }

  const handleNext = () => {
    goToNext(zoomLevel)
    onDateChange?.()
  }

  const handleToday = () => {
    goToToday()
    onDateChange?.()
  }

  const handleDirectDateChange = (e) => {
    handleDateChange(e.target.value)
    onDateChange?.()
  }

  const openDatePicker = () => {
    dateInputRef.current?.showPicker()
  }

  const getNavigationLabel = () => {
    switch (zoomLevel) {
      case 'hour':
      case 'day':
        return 'day'
      case 'week':
        return 'week'
      case 'month':
        return 'month'
      default:
        return 'period'
    }
  }

  const isToday = () => {
    const today = new Date().toISOString().split('T')[0]
    if (zoomLevel === 'week') {
      const currentDate = new Date(selectedDate)
      const todayDate = new Date(today)
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return todayDate >= startOfWeek && todayDate <= endOfWeek
    } else if (zoomLevel === 'month') {
      const currentDate = new Date(selectedDate)
      const todayDate = new Date(today)
      return (
        currentDate.getMonth() === todayDate.getMonth() &&
        currentDate.getFullYear() === todayDate.getFullYear()
      )
    }
    return selectedDate === today
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        className={`flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ${
          theme === 'dark'
            ? 'text-meta-gray-400 hover:text-meta-blue-400 hover:bg-meta-gray-700'
            : 'text-meta-gray-500 hover:text-meta-blue-600 hover:bg-meta-gray-100'
        }`}
        title={`Previous ${getNavigationLabel()}`}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Date Display/Picker */}
      <div className="relative">
        {/* Hidden date input */}
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={handleDirectDateChange}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
        />
        {/* Visible button */}
        <button
          onClick={openDatePicker}
          className={`flex items-center gap-2 border rounded px-3 py-2 text-sm transition-all duration-200 min-w-0 ${
            theme === 'dark'
              ? 'bg-meta-gray-700 text-dark-text-primary border-meta-gray-600 hover:bg-meta-gray-600 hover:border-meta-blue-400'
              : 'bg-meta-gray-50 text-meta-gray-700 border-meta-gray-300 hover:bg-white hover:border-meta-blue-500'
          }`}
          title="Click to select specific date"
        >
          <span className="truncate">{getFormattedDateRange(zoomLevel)}</span>
          <Calendar size={14} className="flex-shrink-0" />
        </button>
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        className={`flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ${
          theme === 'dark'
            ? 'text-meta-gray-400 hover:text-meta-blue-400 hover:bg-meta-gray-700'
            : 'text-meta-gray-500 hover:text-meta-blue-600 hover:bg-meta-gray-100'
        }`}
        title={`Next ${getNavigationLabel()}`}
      >
        <ChevronRight size={16} />
      </button>

      {/* Today Button */}
      {!isToday() && (
        <button
          onClick={handleToday}
          className={`flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ${
            theme === 'dark'
              ? 'text-meta-gray-400 hover:text-meta-blue-400 hover:bg-meta-gray-700'
              : 'text-meta-gray-500 hover:text-meta-blue-600 hover:bg-meta-gray-100'
          }`}
          title="Go to today"
        >
          <Home size={14} />
        </button>
      )}

      {/* Current period indicator */}
      <div className={`text-xs hidden sm:block ${theme === 'dark' ? 'text-meta-gray-500' : 'text-meta-gray-500'}`}>
        {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)} view
      </div>
    </div>
  )
}

export default SmartDatePicker
