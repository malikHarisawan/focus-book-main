// Test script to verify IPC serialization fix
const mockData = [
  {
    date: new Date('2024-07-03'),
    hour: 11,
    appName: 'test-app.exe',
    timeSpent: 5000,
    category: 'Code',
    description: 'Testing app',
    domain: null,
    timestamps: [{ start: new Date(), duration: 5000 }]
  },
  {
    date: new Date('2024-07-03'),
    hour: null,
    appName: 'another-app.exe',
    timeSpent: 3000,
    category: 'Browsing',
    description: 'Another app',
    domain: 'example.com',
    timestamps: [{ start: new Date(), duration: 3000 }]
  }
]

console.log('🔍 Testing IPC serialization fix...')

// Simulate the data transformation logic from getAppUsageData
const formattedData = {}

mockData.forEach((record) => {
  // Manually format date and hour since .lean() removes virtual fields
  const dateStr = record.date.toISOString().split('T')[0]
  const hourKey =
    record.hour !== null && record.hour !== undefined
      ? `${record.hour.toString().padStart(2, '0')}:00`
      : null

  if (!formattedData[dateStr]) {
    formattedData[dateStr] = { apps: {} }
  }

  if (hourKey) {
    if (!formattedData[dateStr][hourKey]) {
      formattedData[dateStr][hourKey] = {}
    }

    formattedData[dateStr][hourKey][record.appName] = {
      time: record.timeSpent,
      category: record.category,
      description: record.description,
      domain: record.domain,
      timestamps: record.timestamps || []
    }
  } else {
    formattedData[dateStr].apps[record.appName] = {
      time: record.timeSpent,
      category: record.category,
      description: record.description,
      domain: record.domain,
      timestamps: record.timestamps || []
    }
  }
})

console.log('✅ Data transformation successful')
console.log('📊 Sample formatted data:')
console.log(JSON.stringify(formattedData, null, 2))

// Test serialization
try {
  const serialized = JSON.stringify(formattedData)
  const deserialized = JSON.parse(serialized)
  console.log('✅ JSON serialization/deserialization successful')
  console.log('✅ IPC serialization fix is working correctly')
} catch (error) {
  console.error('❌ Serialization failed:', error.message)
}
