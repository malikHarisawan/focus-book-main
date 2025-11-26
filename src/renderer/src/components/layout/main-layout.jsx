import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { TitleBar } from './TitleBar'
import { useTheme } from '../../context/ThemeContext'

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
    <div className="min-h-screen flex flex-col relative transition-colors duration-300 overflow-hidden bg-white text-slate-900 dark:bg-black dark:text-white">
      {/* Retro-Futuristic Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Animated Grid Pattern */}
        <div className="retro-grid absolute inset-0 opacity-30 dark:opacity-100" />

        {/* Scan Lines */}
        <div className="scan-lines absolute inset-0" />

        {/* Vignette Effect */}
        <div className="absolute inset-0 dark:vignette" />

        {/* Gradient Overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-purple-50/30 via-transparent to-neon-cyan-50/30 dark:from-neon-purple-900/10 dark:via-transparent dark:to-neon-cyan-900/10" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* Custom Title Bar - Sticky at top */}
        <div className="sticky top-0 z-50">
          <TitleBar />
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/90 dark:bg-black/90 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-neon-cyan-500/30 rounded-full animate-ping neon-border"></div>
                <div className="absolute inset-2 border-4 border-t-neon-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-4 border-4 border-r-neon-pink-500 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin-slow"></div>
                <div className="absolute inset-6 border-4 border-b-neon-purple-500 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin-slower"></div>
                <div className="absolute inset-8 border-4 border-l-neon-green-500 border-t-transparent border-r-transparent border-b-transparent rounded-full animate-spin"></div>
              </div>
              <div className="mt-4 text-neon-cyan-500 font-heading text-sm tracking-widest terminal-flicker neon-glow uppercase">
                LOADING PRODUCTIVITY DATA
              </div>
            </div>
          </div>
        )}

        {/* Main content area - fills remaining height */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar - Fixed width, sticky, and independently scrollable */}
          <div className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 p-4">
              <Sidebar
                productivityScore={85} // Example data
                dailyGoalProgress={68}
                weeklyGoalProgress={72}
              />
            </div>
          </div>

          {/* Page content - Flexible width and independently scrollable */}
          <main className="flex-1 overflow-y-auto custom-scrollbar p-4">
            <div className="container mx-auto max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
