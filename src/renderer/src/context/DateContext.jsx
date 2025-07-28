import React, { createContext, useState, useContext } from 'react'

const DateContext = createContext()

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const handleDateChange = (date) => {
    setSelectedDate(date)
  }

  const navigateDate = (direction, zoomLevel = 'hour') => {
    const currentDate = new Date(selectedDate)
    let newDate = new Date(currentDate)

    switch (zoomLevel) {
      case 'hour':
      case 'day':
        // Navigate by day
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        // Navigate by week (7 days)
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        // Navigate by month
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
      default:
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
    }

    setSelectedDate(newDate.toISOString().split('T')[0])
  }

  const goToPrevious = (zoomLevel) => navigateDate('previous', zoomLevel)
  const goToNext = (zoomLevel) => navigateDate('next', zoomLevel)
  const goToToday = () => setSelectedDate(new Date().toISOString().split('T')[0])

  const getFormattedDateRange = (zoomLevel) => {
    const date = new Date(selectedDate)

    switch (zoomLevel) {
      case 'hour':
      case 'day':
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      case 'week':
        const startOfWeek = new Date(date)
        startOfWeek.setDate(date.getDate() - date.getDay())
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)

        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      case 'month':
        return date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        })
      default:
        return date.toLocaleDateString()
    }
  }

  return (
    <DateContext.Provider
      value={{
        selectedDate,
        handleDateChange,
        goToPrevious,
        goToNext,
        goToToday,
        getFormattedDateRange
      }}
    >
      {children}
    </DateContext.Provider>
  )
}

export function useDate() {
  return useContext(DateContext)
}
