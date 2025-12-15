import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

// Color schemes - Exact Figma color palette
export const colorSchemes = {
  primary: {
    purple: {
      light: '#5051F9', // Primary purple-blue
      dark: '#5051F9',  // Same for dark mode
      name: 'Purple Blue'
    },
    blue: {
      light: '#1EA7FF', // Cyan Blue
      dark: '#1EA7FF',  // Same for dark mode
      name: 'Cyan Blue'
    }
  },
  secondary: {
    cyan: {
      light: '#1EA7FF', // Cyan Blue
      dark: '#1EA7FF',  // Same for dark mode
      name: 'Cyan'
    },
    orange: {
      light: '#FF6B6B', // Salmon red
      dark: '#FF6B6B',  // Same for dark mode
      name: 'Coral'
    }
  }
}

// Helper function to get system preference
const getSystemTheme = () => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

// Helper function to apply theme to document
const applyTheme = (resolvedTheme) => {
  if (resolvedTheme === 'light') {
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }
}

// Helper function to apply accent colors as CSS variables
const applyAccentColors = (primaryColor, secondaryColor, resolvedTheme) => {
  const root = document.documentElement
  const mode = resolvedTheme === 'light' ? 'light' : 'dark'
  
  // Primary accent
  const primaryScheme = colorSchemes.primary[primaryColor] || colorSchemes.primary.purple
  root.style.setProperty('--accent-primary', primaryScheme[mode])
  
  // Secondary accent
  const secondaryScheme = colorSchemes.secondary[secondaryColor] || colorSchemes.secondary.cyan
  root.style.setProperty('--accent-secondary', secondaryScheme[mode])
}

export const ThemeProvider = ({ children }) => {
  // Theme can be 'light', 'dark', or 'system'
  const [theme, setTheme] = useState('system')
  const [resolvedTheme, setResolvedTheme] = useState('dark')
  const [primaryColor, setPrimaryColor] = useState('purple')
  const [secondaryColor, setSecondaryColor] = useState('cyan')

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('focusbook-theme') || 'system'
    const savedPrimaryColor = localStorage.getItem('focusbook-primary-color') || 'purple'
    const savedSecondaryColor = localStorage.getItem('focusbook-secondary-color') || 'cyan'
    
    setTheme(savedTheme)
    setPrimaryColor(savedPrimaryColor)
    setSecondaryColor(savedSecondaryColor)

    // Calculate resolved theme
    const resolved = savedTheme === 'system' ? getSystemTheme() : savedTheme
    setResolvedTheme(resolved)
    applyTheme(resolved)
    applyAccentColors(savedPrimaryColor, savedSecondaryColor, resolved)
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    if (!window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e) => {
      // Only update if user has selected 'system' mode
      if (theme === 'system') {
        const newResolvedTheme = e.matches ? 'dark' : 'light'
        setResolvedTheme(newResolvedTheme)
        applyTheme(newResolvedTheme)
        applyAccentColors(primaryColor, secondaryColor, newResolvedTheme)
      }
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      // Legacy browsers
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [theme, primaryColor, secondaryColor])

  // Update resolved theme when theme preference changes
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    applyTheme(resolved)
    applyAccentColors(primaryColor, secondaryColor, resolved)
  }, [theme, primaryColor, secondaryColor])

  const setThemeMode = (newTheme) => {
    // newTheme can be 'light', 'dark', or 'system'
    setTheme(newTheme)
    localStorage.setItem('focusbook-theme', newTheme)

    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)
    applyTheme(resolved)
    applyAccentColors(primaryColor, secondaryColor, resolved)
  }

  const setPrimaryAccent = (color) => {
    setPrimaryColor(color)
    localStorage.setItem('focusbook-primary-color', color)
    applyAccentColors(color, secondaryColor, resolvedTheme)
  }

  const setSecondaryAccent = (color) => {
    setSecondaryColor(color)
    localStorage.setItem('focusbook-secondary-color', color)
    applyAccentColors(primaryColor, color, resolvedTheme)
  }

  const toggleTheme = () => {
    // Cycle through: dark -> light -> system -> dark
    const newTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    setThemeMode(newTheme)
  }

  const setLightTheme = () => setThemeMode('light')
  const setDarkTheme = () => setThemeMode('dark')
  const setSystemTheme = () => setThemeMode('system')

  return (
    <ThemeContext.Provider value={{
      theme,
      resolvedTheme,
      toggleTheme,
      setLightTheme,
      setDarkTheme,
      setSystemTheme,
      setThemeMode,
      primaryColor,
      secondaryColor,
      setPrimaryAccent,
      setSecondaryAccent,
      colorSchemes
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
