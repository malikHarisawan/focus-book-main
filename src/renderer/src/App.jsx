import React, { useEffect, useState } from 'react'
import ProductivityOverview from './components/Dashboard/productivity-overview'
import Settings from './components/Settings/page'
import Activities from './components/Activity/page'
import FocusPage from './components/Focus/page'
import ChatPage from './components/Chat/page'
import UpdateNotification from './components/UpdateNotification'
import WelcomeModal from './components/Onboarding/WelcomeModal'
import { DateProvider } from './context/DateContext'
import { ThemeProvider } from './context/ThemeContext'
import { SidebarProvider } from './context/SidebarContext'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/main-layout'

function App() {
  // First-run onboarding gate. `null` = still loading the flag (render nothing
  // extra), false = show the welcome modal, true = already onboarded.
  const [onboarded, setOnboarded] = useState(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const state = await window.electronAPI?.getUiState?.()
        if (active) setOnboarded(Boolean(state?.onboardingCompleted))
      } catch (error) {
        console.error('Failed to load UI state:', error)
        if (active) setOnboarded(true) // fail open — never block the app
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const completeOnboarding = async () => {
    setOnboarded(true) // optimistic — don't wait on disk to dismiss
    try {
      await window.electronAPI?.setUiState?.({ onboardingCompleted: true })
    } catch (error) {
      console.error('Failed to persist onboarding completion:', error)
    }
  }

  return (
    <ThemeProvider>
      <SidebarProvider>
        <DateProvider>
          <Router>
            <MainLayout>
            <Routes>
              <Route path="/" element={<ProductivityOverview />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/activity" element={<Activities />} />
              <Route path="/focus" element={<FocusPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Routes>
          </MainLayout>
          <UpdateNotification />
          {onboarded === false && <WelcomeModal onComplete={completeOnboarding} />}
        </Router>
      </DateProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
