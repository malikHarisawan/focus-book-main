import React, { createContext, useState, useContext, useEffect, useRef } from 'react'
import { todayLocal, fmtLocal, parseLocal } from '../utils/dateUtils'

const DateContext = createContext()

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(todayLocal())

  // The local day we last considered "today". Used to detect a date rollover while
  // the app was open/hidden: if `todayLocal()` has advanced past this, the calendar
  // day changed. Kept in a ref so the visibility/interval handlers always compare
  // against the latest value without needing to re-subscribe.
  const lastKnownToday = useRef(todayLocal())

  // Auto-snap to the new day when the calendar rolls over while the app is running or
  // hidden (e.g. left open overnight, or minimized to tray and reopened the next day).
  // Only snap if the user was still viewing what WAS today — if they deliberately
  // navigated to a past date, leave them there.
  useEffect(() => {
    const syncToToday = () => {
      const now = todayLocal()
      if (now === lastKnownToday.current) return // same day, nothing to do
      const wasViewingToday = selectedDate === lastKnownToday.current
      lastKnownToday.current = now
      if (wasViewingToday) {
        setSelectedDate(now)
      }
    }

    // Re-check whenever the window is shown/focused (tray restore, alt-tab back).
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncToToday()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', syncToToday)
    // Catch midnight rollover even while the window stays visible (app left open
    // overnight). A 60s poll is cheap and needs no wake-up alignment.
    const interval = setInterval(syncToToday, 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', syncToToday)
      clearInterval(interval)
    }
  }, [selectedDate])

  const handleDateChange = (date) => {
    setSelectedDate(date)
  }

  const navigateDate = (direction, zoomLevel = 'hour') => {
    const currentDate = parseLocal(selectedDate)
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

    setSelectedDate(fmtLocal(newDate))
  }

  const goToPrevious = (zoomLevel) => navigateDate('previous', zoomLevel)
  const goToNext = (zoomLevel) => navigateDate('next', zoomLevel)
  const goToToday = () => setSelectedDate(todayLocal())

  const getFormattedDateRange = (zoomLevel) => {
    const date = parseLocal(selectedDate)

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
