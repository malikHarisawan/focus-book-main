import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { TitleBar } from './TitleBar'
import { useTheme } from '../../context/ThemeContext'
import { useSidebar } from '../../context/SidebarContext'
import { Menu, ChevronLeft } from 'lucide-react'
import { Button } from '../ui/button'

export function MainLayout({ children }) {
  const { isCollapsed, toggleSidebar } = useSidebar()
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
    <div className="min-h-screen flex flex-col relative transition-colors duration-300 overflow-hidden bg-[#F4F7FE] text-[#2B3674] dark:bg-[#1E1F25] dark:text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Subtle Grid Pattern */}
        <div className="subtle-grid absolute inset-0 opacity-30 dark:opacity-20" />

        {/* Gradient Overlay for depth */}
        <div className="gradient-overlay absolute inset-0" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 h-screen flex flex-col">
        {/* Custom Title Bar - Sticky at top */}
        <div className="sticky top-0 z-50">
          <TitleBar />
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#F4F7FE]/95 dark:bg-[#0B1437]/95 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-[#E2E8F0] dark:border-[#1B254B] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-[#4318FF] dark:border-t-[#7551FF] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              <div className="mt-4 text-[#A3AED0] font-normal text-sm tracking-wide">
                Loading productivity data...
              </div>
            </div>
          </div>
        )}

        {/* Main content area - fills remaining height */}
        <div className="flex-1 flex min-h-0">
        
          <div className={`
            hidden lg:flex lg:flex-col
            transition-all duration-300 ease-in-out
            ${isCollapsed ? 'lg:w-16' : 'lg:w-60 xl:w-64'}
            overflow-y-auto custom-scrollbar
          `}>
            <div className="sticky top-0 p-3">
              <Sidebar
                collapsed={isCollapsed}
                productivityScore={85}
                dailyGoalProgress={68}
                weeklyGoalProgress={72}
              />
            </div>
          </div>

          <main className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <div className="container mx-auto max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
