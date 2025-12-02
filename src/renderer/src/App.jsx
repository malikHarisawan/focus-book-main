import React from 'react'
import ProductivityOverview from './components/Dashboard/productivity-overview'
import Settings from './components/Settings/page'
import Activities from './components/Activity/page'
import FocusPage from './components/Focus/page'
import ChatPage from './components/Chat/page'
import UpdateNotification from './components/UpdateNotification'
import { DateProvider } from './context/DateContext'
import { ThemeProvider } from './context/ThemeContext'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/main-layout'
function App() {
  return (
    <ThemeProvider>
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
        </Router>
      </DateProvider>
    </ThemeProvider>
  )
}

export default App
