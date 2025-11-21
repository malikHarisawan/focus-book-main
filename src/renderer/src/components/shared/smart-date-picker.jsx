import React, { useState } from 'react'
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
  const [showDateInput, setShowDateInput] = useState(false)

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
    setShowDateInput(false)
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
            ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-700'
            : 'text-slate-600 hover:text-cyan-600 hover:bg-gray-100'
        }`}
        title={`Previous ${getNavigationLabel()}`}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Date Display/Picker */}
      <div className="relative">
        {showDateInput ? (
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={handleDirectDateChange}
              onBlur={() => setShowDateInput(false)}
              autoFocus
              className={`border rounded px-3 py-2 text-sm outline-none ${
                theme === 'dark'
                  ? 'bg-slate-800 text-cyan-400 border-cyan-500/50 focus:border-cyan-400'
                  : 'bg-white text-cyan-600 border-cyan-500/50 focus:border-cyan-600'
              }`}
              style={{
                colorScheme: theme === 'dark' ? 'dark' : 'light'
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowDateInput(true)}
            className={`flex items-center gap-2 border rounded px-3 py-2 text-sm transition-all duration-200 min-w-0 ${
              theme === 'dark'
                ? 'bg-slate-800/50 text-cyan-400 border-cyan-500/50 hover:bg-slate-800 hover:border-cyan-400'
                : 'bg-gray-50 text-cyan-600 border-cyan-500/30 hover:bg-white hover:border-cyan-600'
            }`}
            title="Click to select specific date"
          >
            <span className="truncate">{getFormattedDateRange(zoomLevel)}</span>
            <Calendar size={14} className="flex-shrink-0" />
          </button>
        )}
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        className={`flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ${
          theme === 'dark'
            ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-700'
            : 'text-slate-600 hover:text-cyan-600 hover:bg-gray-100'
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
              ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-700'
              : 'text-slate-600 hover:text-cyan-600 hover:bg-gray-100'
          }`}
          title="Go to today"
        >
          <Home size={14} />
        </button>
      )}

      {/* Current period indicator */}
      <div className={`text-xs hidden sm:block ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
        {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)} view
      </div>
    </div>
  )
}

export default SmartDatePicker
