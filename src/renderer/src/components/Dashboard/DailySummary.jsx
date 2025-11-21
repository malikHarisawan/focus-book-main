import React from 'react'
import { useTheme } from '../../context/ThemeContext'
import { Settings } from 'lucide-react'

export default function DailySummary({
  totalTime = 0,
  targetTime = 28800, // 8 hours in seconds
  focusTime = 0,
  meetingsTime = 0,
  breaksTime = 0,
  otherTime = 0,
  categoryBreakdown = []
}) {
  const { theme } = useTheme()

  // Calculate hours and minutes
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return { hours, minutes }
  }

  const workHours = formatTime(totalTime)
  const targetHours = formatTime(targetTime)
  const percentOfTarget = Math.round((totalTime / targetTime) * 100)

  // Format breakdown times
  const focusFormatted = formatTime(focusTime)
  const meetingsFormatted = formatTime(meetingsTime)
  const breaksFormatted = formatTime(breaksTime)
  const otherFormatted = formatTime(otherTime)

  // Calculate percentages for pie chart
  const total = focusTime + meetingsTime + breaksTime + otherTime || 1
  const focusPercent = (focusTime / total) * 100
  const meetingsPercent = (meetingsTime / total) * 100
  const breaksPercent = (breaksTime / total) * 100
  const otherPercent = (otherTime / total) * 100

  // Calculate donut chart segments
  const circumference = 2 * Math.PI * 56
  const focusOffset = 0
  const meetingsOffset = (focusPercent / 100) * circumference
  const breaksOffset = meetingsOffset + (meetingsPercent / 100) * circumference
  const otherOffset = breaksOffset + (breaksPercent / 100) * circumference

  // Get top 3 categories
  const topCategories = categoryBreakdown.slice(0, 3)

  return (
    <div className={`rounded-lg border p-6 ${
      theme === 'dark'
        ? 'bg-slate-900/60 border-slate-800/50'
        : 'bg-white border-gray-200 shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold ${
          theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
        }`}>
          Daily Summary - Today
        </h2>
        <button className={`p-1.5 rounded-lg transition-colors ${
          theme === 'dark'
            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
        }`}>
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Work Hours */}
          <div>
            <div className={`text-xs font-medium mb-1.5 uppercase tracking-wide ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Work Hours
            </div>
            <div className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {workHours.hours} hr {workHours.minutes} min
            </div>
          </div>

          {/* Breakdown Section */}
          <div>
            <div className={`text-xs font-medium mb-3 uppercase tracking-wide ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Breakdown
            </div>

            {/* Donut Chart */}
            <div className="flex items-center gap-8">
              {/* Chart */}
              <div className="relative w-40 h-40 flex-shrink-0">
                <svg className="transform -rotate-90 w-40 h-40">
                  {/* Focus segment */}
                  <circle
                    cx="80"
                    cy="80"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="24"
                    fill="transparent"
                    className="text-cyan-500"
                    strokeDasharray={`${(focusPercent / 100) * circumference} ${circumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  {/* Meetings segment */}
                  {meetingsTime > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="24"
                      fill="transparent"
                      className="text-purple-500"
                      strokeDasharray={`${(meetingsPercent / 100) * circumference} ${circumference}`}
                      strokeDashoffset={-meetingsOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Breaks segment */}
                  {breaksTime > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="24"
                      fill="transparent"
                      className="text-blue-500"
                      strokeDasharray={`${(breaksPercent / 100) * circumference} ${circumference}`}
                      strokeDashoffset={-breaksOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Other segment */}
                  {otherTime > 0 && (
                    <circle
                      cx="80"
                      cy="80"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="24"
                      fill="transparent"
                      className="text-slate-600"
                      strokeDasharray={`${(otherPercent / 100) * circumference} ${circumference}`}
                      strokeDashoffset={-otherOffset}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </div>

              {/* Legend */}
              <div className="space-y-2 flex-1">
                {/* Focus */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></div>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Focus
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {focusFormatted.hours} hr {focusFormatted.minutes} min
                  </span>
                </div>

                {/* Meetings */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-purple-500"></div>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Meetings
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {meetingsFormatted.hours} min
                  </span>
                </div>

                {/* Breaks */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Breaks
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {breaksFormatted.hours} hr {breaksFormatted.minutes} min
                  </span>
                </div>

                {/* Other */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-slate-600"></div>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Other
                    </span>
                    <button className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                      theme === 'dark'
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      ?
                    </button>
                  </div>
                  <span className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {otherFormatted.hours} hr {otherFormatted.minutes} min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Top Categories */}
        <div>
          <div className={`text-xs font-medium mb-3 uppercase tracking-wide ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Top Categories
          </div>

          <div className="space-y-3">
            {topCategories.length > 0 ? (
              topCategories.map((category, index) => {
                const totalSeconds = category.time || 0
                const categoryTime = formatTime(totalSeconds)
                const categoryPercent = category.percentage || 0

                // Color based on productivity type
                const getColor = () => {
                  if (category.productivity === 'productive') return 'bg-purple-500'
                  if (category.productivity === 'neutral') return 'bg-blue-500'
                  return 'bg-slate-500'
                }

                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-12 h-1 rounded-full ${getColor()}`}></div>
                        <span className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {category.name}
                        </span>
                      </div>
                      <span className={`text-xs font-medium ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        {categoryTime.hours} hr {categoryTime.minutes} min
                      </span>
                    </div>
                    <div className={`text-base font-bold ${
                      theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      {categoryPercent}%
                    </div>
                  </div>
                )
              })
            ) : (
              <div className={`text-xs ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>
                No category data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
