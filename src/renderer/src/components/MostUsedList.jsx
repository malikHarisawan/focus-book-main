import React from 'react'
import { ChevronRight } from 'lucide-react'

const MostUsedList = ({ apps = [] }) => {
  if (!apps || apps.length === 0) {
    return (
      <div className="mt-4">
        <h3 className="text-md font-semibold mb-2">Most Used</h3>
        <div className="text-gray-500 p-4 text-center">No app usage data available</div>
      </div>
    )
  }

  const getCategoryColor = (category) => {
    const colors = {
      Code: '#5ac26d',
      Browsing: '#b381c9',
      Communication: '#ff6384',
      Utilities: '#36a2eb',
      Entertainment: '#3b82f6',
      Miscellaneous: '#7a7a7a'
    }
    return colors[category] || '#7a7a7a'
  }

  return (
    <div className="mt-4">
      <h3 className="text-md font-semibold mb-2">Most Used</h3>
      <div className="space-y-2">
        {apps.map((app, index) => (
          <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded">
            <div className="flex items-center space-x-2">
              <div
                className="w-8 h-8 flex items-center justify-center rounded"
                style={{ backgroundColor: getCategoryColor(app.category) }}
              >
                {/* <span className="text-white">{app.icon}</span> */}
              </div>
              <span className="truncate max-w-[180px]">{app.name}</span>
            </div>

            <div className="flex-1 mx-4 relative h-2 bg-gray-700 rounded">
              <div
                className="absolute left-0 top-0 h-full rounded"
                style={{
                  width: `${app.usagePercent * 100}%`,
                  backgroundColor: getCategoryColor(app.category)
                }}
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-gray-300 text-sm whitespace-nowrap">{app.time}</span>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MostUsedList
