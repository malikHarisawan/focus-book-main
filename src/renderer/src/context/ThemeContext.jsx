import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('focusbook-theme') || 'dark'
    setTheme(savedTheme)

    // Apply theme class to document
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('focusbook-theme', newTheme)

    // Update document classes
    if (newTheme === 'light') {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    }
  }

  const setLightTheme = () => {
    setTheme('light')
    localStorage.setItem('focusbook-theme', 'light')
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  }

  const setDarkTheme = () => {
    setTheme('dark')
    localStorage.setItem('focusbook-theme', 'dark')
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setLightTheme, setDarkTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
