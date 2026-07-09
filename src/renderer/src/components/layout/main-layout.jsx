import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { TitleBar } from './TitleBar'
import { useTheme } from '../../context/ThemeContext'
import { useSidebar } from '../../context/SidebarContext'
import { Menu, ChevronLeft } from 'lucide-react'
import { Button } from '../ui/button'

export function MainLayout({ children }) {
  const { isCollapsed, toggleSidebar } = useSidebar()
  const { resolvedTheme } = useTheme()
  const [productivityScore, setProductivityScore] = useState(85)
  const [dailyGoalProgress, setDailyGoalProgress] = useState(68)
  const [weeklyGoalProgress, setWeeklyGoalProgress] = useState(72)
  const [isLoading, setIsLoading] = useState(false)
  const canvasRef = useRef(null)

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

  // Animated cyan/blue particle background (dark mode only)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || resolvedTheme !== 'dark') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles = []
    const particleCount = 120

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 2.5 + 0.8
        this.speedX = (Math.random() - 0.5) * 0.4
        this.speedY = (Math.random() - 0.5) * 0.4
        // Cyan → blue → purple tinted particles
        const palette = [
          [34, 211, 238], // cyan-400
          [56, 189, 248], // sky-400
          [80, 81, 249] // brand purple
        ]
        const [r, g, b] = palette[Math.floor(Math.random() * palette.length)]
        this.r = r
        this.g = g
        this.b = b
        this.alpha = Math.random() * 0.45 + 0.35
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY
        if (this.x > canvas.width) this.x = 0
        if (this.x < 0) this.x = canvas.width
        if (this.y > canvas.height) this.y = 0
        if (this.y < 0) this.y = canvas.height
      }

      draw() {
        ctx.fillStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${this.alpha})`
        // Soft glow so dots read like the older version
        ctx.shadowBlur = 6
        ctx.shadowColor = `rgba(${this.r}, ${this.g}, ${this.b}, 0.6)`
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    for (let i = 0; i < particleCount; i++) particles.push(new Particle())

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const particle of particles) {
        particle.update()
        particle.draw()
      }
      animationId = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [resolvedTheme])

  return (
    <div className="min-h-screen flex flex-col relative transition-colors duration-300 overflow-hidden bg-[#F4F7FE] text-[#2B3674] dark:text-white dark:bg-gradient-to-br dark:from-black dark:via-[#05070D] dark:to-[#0B1220]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Animated particle field (dark mode only) */}
        {resolvedTheme === 'dark' && (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-70" />
        )}

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
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#F4F7FE]/95 dark:bg-[#05070D]/95 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-[#E2E8F0] dark:border-[#1E293B] rounded-full"></div>
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
            flex flex-col flex-shrink-0
            transition-all duration-300 ease-in-out
            ${isCollapsed ? 'w-20' : 'w-60 xl:w-64'}
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

          <main className="flex-1 overflow-y-auto custom-scrollbar p-2 min-w-0">
            <div className="container mx-auto max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
