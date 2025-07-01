import React from 'react'
import ProductivityOverview from './components/Dashboard/productivity-overview'
import Settings from './components/Settings/page'
import Activities from './components/Activity/page'
import { DateProvider } from './context/DateContext'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/main-layout'
function App() {
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <DateProvider>
        <Router>
          <MainLayout>
            <Routes>
              <Route path="/" element={<ProductivityOverview />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/activity" element={<Activities />} />
            </Routes>
          </MainLayout>
        </Router>
      </DateProvider>
    </div>
  )
}

export default App
