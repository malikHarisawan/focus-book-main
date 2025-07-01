import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const ProductiveAreaChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 p-4 rounded-md h-[250px] flex items-center justify-center">
        <span className="text-gray-500">No data available</span>
      </div>
    )
  }
  const formatTooltipValue = (value) => {
    if (value === 0) return
    const hours = Math.floor(value / 3600)
    const minutes = Math.floor((value % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <p className="text-gray-200 font-medium">{label}</p>
          <div className="mt-2">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 my-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
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

  return (
    <div className="bg-gray-800 p-4 rounded-md">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUnproductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" stroke="#ffffff" />
          {/* <YAxis stroke="#ffffff" /> */}
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="productive"
            name="Productive"
            stroke="#82ca9d"
            fill="url(#colorProductive)"
          />
          <Area
            type="monotone"
            dataKey="unproductive"
            name="Unproductive"
            stroke="#ff6b6b"
            fill="url(#colorUnproductive)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ProductiveAreaChart
