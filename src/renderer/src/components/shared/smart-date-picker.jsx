import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Home } from 'lucide-react'
import { useDate } from '../../context/DateContext'

const SmartDatePicker = ({ zoomLevel = 'hour', onDateChange, className = '' }) => {
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
        className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded transition-all duration-200"
        title={`Previous ${getNavigationLabel()}`}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Date Display/Picker */}
      <div className="relative">
        {showDateInput ? (
          <input
            type="date"
            value={selectedDate}
            onChange={handleDirectDateChange}
            onBlur={() => setShowDateInput(false)}
            autoFocus
            className="bg-slate-800 text-cyan-400 border border-cyan-500/50 rounded px-3 py-2 text-sm outline-none focus:border-cyan-400"
          />
        ) : (
          <button
            onClick={() => setShowDateInput(true)}
            className="flex items-center gap-2 bg-slate-800/50 text-cyan-400 border border-cyan-500/50 rounded px-3 py-2 text-sm hover:bg-slate-800 hover:border-cyan-400 transition-all duration-200 min-w-0"
            title="Click to select specific date"
          >
            <Calendar size={14} className="flex-shrink-0" />
            <span className="truncate">{getFormattedDateRange(zoomLevel)}</span>
          </button>
        )}
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded transition-all duration-200"
        title={`Next ${getNavigationLabel()}`}
      >
        <ChevronRight size={16} />
      </button>

      {/* Today Button */}
      {!isToday() && (
        <button
          onClick={handleToday}
          className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded transition-all duration-200"
          title="Go to today"
        >
          <Home size={14} />
        </button>
      )}

      {/* Current period indicator */}
      <div className="text-xs text-slate-500 hidden sm:block">
        {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)} view
      </div>
    </div>
  )
}

export default SmartDatePicker
