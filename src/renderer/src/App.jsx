import React, { useEffect, useState } from 'react'
import ProductivityOverview from './components/Dashboard/productivity-overview'
import Settings from './components/Settings/page'
import Apps from './components/Activity/page'
import FocusPage from './components/Focus/page'
// AI service disabled — Chat/Insights page is not routed. Restore this import and
// the /chat route below to re-enable.
// import ChatPage from './components/Chat/page'
import UpdateNotification from './components/UpdateNotification'
// Away-return prompt disabled — away-time is no longer surfaced anywhere in the app.
// A single absence span can be many hours long (e.g. an overnight idle/locked block),
// and labelling one "working" credited 15–17h of focus in a day and wrecked the totals.
// Until away-spans are duration-capped, we neither prompt for nor record away-time.
// Restore this import and <AwayReturnPrompt /> below to re-enable.
// import AwayReturnPrompt from './components/AwayReturnPrompt'
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
              <Route path="/apps" element={<Apps />} />
              {/* Back-compat: old /activity links still resolve to the Apps page. */}
              <Route path="/activity" element={<Apps />} />
              <Route path="/focus" element={<FocusPage />} />
              {/* AI service disabled — /chat route removed. Restore to re-enable. */}
              {/* <Route path="/chat" element={<ChatPage />} /> */}
            </Routes>
          </MainLayout>
          <UpdateNotification />
          {/* Away-return prompt disabled (see import note above). */}
          {/* <AwayReturnPrompt /> */}
          {onboarded === false && <WelcomeModal onComplete={completeOnboarding} />}
        </Router>
      </DateProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
