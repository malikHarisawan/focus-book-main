'use client'

import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Calendar,
  Command,
  Hexagon,
  ListTodo,
  Settings,
  Target,
  Timer
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '..//ui/card'
import { StatusItem } from '../Dashboard/status-item'

export function Sidebar({ productivityScore, dailyGoalProgress, weeklyGoalProgress }) {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm h-full w-fit">
      <CardContent className="p-2">
        <div className="flex items-center space-x-2 mb-6">
          <Hexagon className="h-6 w-6 text-cyan-500" />
          <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            FOCUS TRACKER
          </span>
        </div>

        <nav className="space-y-2">
          <NavItem href="/" icon={Command} label="Dashboard" active={pathname === '/'} />
          <NavItem
            href="/focus-timer"
            icon={Timer}
            label="Focus Timer"
            active={pathname === '/focus-timer'}
          />
          <NavItem
            href="/activity"
            icon={Activity}
            label="Activity"
            active={pathname === '/activity'}
          />
          <NavItem href="/tasks" icon={ListTodo} label="Tasks" active={pathname === '/tasks'} />
          <NavItem href="/goals" icon={Target} label="Goals" active={pathname === '/goals'} />
          <NavItem
            href="/analytics"
            icon={BarChart3}
            label="Analytics"
            active={pathname === '/analytics'}
          />
          <NavItem
            href="/schedule"
            icon={Calendar}
            label="Schedule"
            active={pathname === '/schedule'}
          />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={pathname === '/settings'}
          />
        </nav>

        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2 font-mono">PRODUCTIVITY STATUS</div>
          <div className="space-y-3">
            <StatusItem label="Today's Score" value={productivityScore} color="cyan" />
            <StatusItem label="Daily Goal" value={dailyGoalProgress} color="green" />
            <StatusItem label="Weekly Goal" value={weeklyGoalProgress} color="blue" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Component for nav items
function NavItem({ icon: Icon, label, active, href }) {
  return (
    <Button
      variant="ghost"
      asChild
      className={`w-full justify-start ${active ? 'bg-slate-800/70 text-cyan-400' : 'text-slate-400 hover:text-slate-100'}`}
    >
      <Link to={href}>
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
