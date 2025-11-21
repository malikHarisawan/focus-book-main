import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { TitleBar } from './TitleBar'
import { useTheme } from '../../context/ThemeContext'

export function MainLayout({ children }) {
  const { theme } = useTheme()
  const [productivityScore, setProductivityScore] = useState(85)
  const [dailyGoalProgress, setDailyGoalProgress] = useState(68)
  const [weeklyGoalProgress, setWeeklyGoalProgress] = useState(72)
  const [isLoading, setIsLoading] = useState(false)

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Simulate changing data
  useEffect(() => {
    const interval = setInterval(() => {
      setProductivityScore(Math.floor(Math.random() * 10) + 80)
      setDailyGoalProgress(Math.floor(Math.random() * 5) + 65)
      setWeeklyGoalProgress(Math.floor(Math.random() * 8) + 68)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`min-h-screen flex flex-col relative transition-colors duration-300 ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-black to-slate-900 text-slate-100'
        : 'bg-gradient-to-br from-gray-50 to-blue-50 text-slate-900'
    }`}>
      {/* Custom Title Bar */}
      <TitleBar />
      {/* Loading overlay */}
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center z-50 ${
          theme === 'dark' ? 'bg-black/80' : 'bg-white/80'
        }`}>
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
              <div className="absolute inset-2 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-4 border-4 border-r-purple-500 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin-slow"></div>
              <div className="absolute inset-6 border-4 border-b-blue-500 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin-slower"></div>
              <div className="absolute inset-8 border-4 border-l-green-500 border-t-transparent border-r-transparent border-b-transparent rounded-full animate-spin"></div>
            </div>
            <div className="mt-4 text-cyan-500 font-mono text-sm tracking-wider">
              LOADING PRODUCTIVITY DATA
            </div>
          </div>
        </div>
      )}

      {/* Main content area with flex-1 to fill remaining space */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 max-w-[1920px]">
          {/* Main content */}
          <div className="grid grid-cols-12 gap-6 lg:gap-8">
            {/* Sidebar - Fixed width for consistency */}
            <div className="col-span-12 lg:col-span-3 xl:col-span-2">
              <div className="lg:sticky lg:top-6">
                <Sidebar
                  productivityScore={productivityScore}
                  dailyGoalProgress={dailyGoalProgress}
                  weeklyGoalProgress={weeklyGoalProgress}
                />
              </div>
            </div>

            {/* Page content - Flexible width */}
            <div className="col-span-12 lg:col-span-9 xl:col-span-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
