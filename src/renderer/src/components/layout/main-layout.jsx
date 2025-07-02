import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

export function MainLayout({ children }) {
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
    <div className="dark min-h-screen bg-gradient-to-br from-black to-slate-900 text-slate-100 relative overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
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

      <div className="container mx-auto p-4 relative z-10">
        {/* Main content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-3 lg:col-span-2">
            <Sidebar
              productivityScore={productivityScore}
              dailyGoalProgress={dailyGoalProgress}
              weeklyGoalProgress={weeklyGoalProgress}
            />
          </div>

          {/* Page content */}
          <div className="col-span-12 md:col-span-9 lg:col-span-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
