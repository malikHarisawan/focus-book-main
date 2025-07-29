import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const UsageChart = ({ data }) => {
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null)

  const formatTooltipValue = (value) => {
    if (value === 0) return
    const hours = Math.floor(value / 3600)
    const minutes = Math.floor((value % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const filteredPayload = payload.filter((entry) => entry.value > 100)
      return (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <p className="text-gray-200 font-medium">{label}</p>
          <div className="mt-2">
            {filteredPayload.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 my-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                <span className="text-gray-300">{entry.name}: </span>
                <span className="text-white">{formatTooltipValue(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  const CustomBar = (props) => {
    const { x, y, width, height, fill, index } = props
    const isHovered = hoveredBarIndex === index
    const hoverScale = 1.1
    const barHeight = isHovered ? height * hoverScale : height
    const barY = isHovered ? y - (barHeight - height) : y

    const barWidth = isHovered ? width * hoverScale : width
    const barX = isHovered ? x - (barWidth - width) : x
    return (
      <rect
        x={barX}
        y={barY}
        width={barWidth}
        height={barHeight}
        fill={fill}
        style={{ transition: 'all 0.2s ease' }}
        onMouseEnter={() => setHoveredBarIndex(index)}
        onMouseLeave={() => setHoveredBarIndex(null)}
      />
    )
  }

  const renderBars = (keys) => {
    return keys.map((key, i) => (
      <Bar
        key={key}
        dataKey={key}
        stackId="usage"
        fill={colors[key]}
        name={key}
        shape={<CustomBar />}
      />
    ))
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-md h-[250px] flex items-center justify-center">
        <span className="text-gray-500">No data available</span>
      </div>
    )
  }

  const keys = ['Code', 'Browsing', 'Communication', 'Utilities', 'Entertainment', 'Miscellaneous']
  const colors = {
    Code: '#5ac26d',
    Browsing: '#b381c9',
    Communication: '#3b82f6',
    Utilities: '#36a2eb',
    Entertainment: '#ff6384',
    Miscellaneous: '#7a7a7a'
  }

  return (
    <div className="bg-gray-800 p-4 rounded-md">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#ffffff" />
          <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
          {renderBars(keys)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default UsageChart
