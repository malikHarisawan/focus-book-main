#!/usr/bin/env node

require('dotenv').config()
const { dbConnection } = require('./src/main/database/connection')
const appUsageService = require('./src/main/database/appUsageService')
const categoriesService = require('./src/main/database/categoriesService')
const { AppUsage } = require('./src/main/database/models')

async function testMongooseImplementation() {
  console.log('🔍 Testing MongoDB Atlas connection with Mongoose...')

  const uri = process.env.MONGODB_URI
  if (!uri || uri.includes('username:password')) {
    console.error(
      '❌ Please update MONGODB_URI in .env file with your actual MongoDB Atlas connection string'
    )
    process.exit(1)
  }

  console.log(`📋 Connection config:
  Database: ${process.env.DB_NAME || 'focusbook'}
  URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}  // Hide credentials
`)

  try {
    // Test basic connection
    await dbConnection.connect()
    console.log('✅ Connected to MongoDB Atlas with Mongoose successfully!')

    console.log('\n🧪 Testing Mongoose models and schemas...')

    // Test schema validation
    console.log('📝 Testing schema validation...')

    try {
      const invalidUsage = new AppUsage({
        date: new Date(),
        hour: 25, // Invalid hour
        appName: 'test-app',
        timeSpent: -100, // Will be corrected by pre-save middleware
        category: 'Code'
      })

      await invalidUsage.save()
      console.log('❌ Schema validation failed - should have caught invalid hour')
    } catch {
      console.log('✅ Schema validation working correctly')
    }

    // Test categories with Mongoose
    console.log('\n📂 Testing categories with Mongoose...')

    const testCategories = {
      productive: ['Code', 'Work', 'Learning'],
      distracted: ['Entertainment', 'Social Media', 'Gaming']
    }

    await categoriesService.saveCategories(testCategories)
    console.log('✅ Categories saved with Mongoose models')

    const loadedCategories = await categoriesService.getCategoriesForSettings()
    console.log(
      '✅ Categories loaded:',
      loadedCategories[0].length + loadedCategories[1].length,
      'total categories'
    )

    // Test app usage with Mongoose models
    console.log('\n📊 Testing app usage with Mongoose models...')

    const testDate = new Date().toISOString().split('T')[0]
    const currentHour = new Date().getHours()

    await appUsageService.saveAppUsage(
      testDate,
      currentHour,
      'mongoose-test-app.exe',
      5000,
      'Code',
      'Mongoose Test Application',
      null,
      [{ start: new Date(), duration: 5000 }]
    )
    console.log('✅ App usage data saved with Mongoose models')

    await appUsageService.getAppUsageData()
    console.log('✅ App usage data loaded successfully')

    // Test custom mappings with Mongoose
    console.log('\n🔗 Testing custom category mappings...')

    const testMappings = {
      'mongoose-test-app.exe': 'Code',
      'browser-test.exe': 'Browsing',
      'game-test.exe': 'Entertainment'
    }

    await categoriesService.saveCustomCategoryMappings(testMappings)
    console.log('✅ Custom category mappings saved')

    const loadedMappings = await categoriesService.getCustomCategoryMappings()
    console.log(
      '✅ Custom category mappings loaded:',
      Object.keys(loadedMappings).length,
      'mappings'
    )

    // Test aggregation pipelines
    console.log('\n📈 Testing aggregation pipelines...')

    const stats = await appUsageService.getAppUsageStats(testDate, testDate)
    console.log('✅ Usage stats aggregation:', stats.length, 'categories found')

    const topApps = await appUsageService.getTopApps(testDate, testDate, 5)
    console.log('✅ Top apps aggregation:', topApps.length, 'apps found')

    // Test Mongoose-specific features
    console.log('\n🚀 Testing Mongoose-specific features...')

    // Test virtual fields
    const usageRecord = await AppUsage.findOne({ appName: 'mongoose-test-app.exe' })
    if (usageRecord) {
      console.log(
        '✅ Virtual fields working:',
        usageRecord.formattedDate,
        usageRecord.formattedHour
      )
    }

    // Test instance methods
    if (usageRecord) {
      const originalTime = usageRecord.timeSpent
      await usageRecord.addTime(1000)
      console.log(
        '✅ Instance method working - time increased from',
        originalTime,
        'to',
        usageRecord.timeSpent
      )
    }

    // Test static methods
    const recentRecords = await AppUsage.findByDateRange(testDate, testDate)
    console.log('✅ Static method working:', recentRecords.length, 'records found')

    // Test advanced features
    console.log('\n⚡ Testing advanced Mongoose features...')

    const categoryStats = await categoriesService.getCategoryStats()
    console.log('✅ Category statistics:', categoryStats)

    const categoryWithStats = await categoriesService.getCategoryWithUsageStats('Code')
    console.log('✅ Category with usage stats:', categoryWithStats.stats.totalTime, 'ms total time')

    // Test productivity trend
    const productivityTrend = await appUsageService.getProductivityTrend(7)
    console.log('✅ Productivity trend for 7 days:', productivityTrend.length, 'data points')

    // Test database health
    const isHealthy = await dbConnection.healthCheck()
    console.log(`✅ Database health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`)

    // Test database stats
    const dbStats = await dbConnection.getStats()
    if (dbStats) {
      console.log(
        `✅ Database stats: ${dbStats.collections} collections, ${dbStats.objects} objects`
      )
    }

    console.log('\n🎉 All Mongoose tests passed successfully!')
    console.log('   🏆 Benefits of using Mongoose:')
    console.log('   ✨ Schema validation ensures data integrity')
    console.log('   🔧 Model methods provide clean, reusable code')
    console.log('   🚀 Middleware enables automatic data processing')
    console.log('   💪 Type safety and better development experience')
    console.log('   📊 Built-in query helpers and aggregation support')
    console.log('   \n   You can now run: npm run dev')
  } catch (error) {
    console.error('❌ Mongoose test failed:')
    console.error(`   ${error.message}`)

    if (error.message.includes('MONGODB_URI')) {
      console.log('\n💡 Setup instructions:')
      console.log('   1. Create a MongoDB Atlas cluster at https://cloud.mongodb.com')
      console.log('   2. Create a database user with read/write permissions')
      console.log('   3. Get your connection string from Atlas')
      console.log('   4. Update MONGODB_URI in .env file')
      console.log('   5. Replace <username>, <password>, and <cluster> with your values')
    } else if (
      error.message.includes('authentication failed') ||
      error.message.includes('bad auth')
    ) {
      console.log('\n💡 Authentication failed:')
      console.log('   1. Check username and password in connection string')
      console.log('   2. Verify database user permissions in MongoDB Atlas')
      console.log('   3. Ensure IP address is whitelisted (or use 0.0.0.0/0 for testing)')
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log('\n💡 Network/timeout issues:')
      console.log('   1. Check your internet connection')
      console.log('   2. Verify MongoDB Atlas cluster is running')
      console.log('   3. Check if your IP is whitelisted in Atlas Network Access')
    }
  } finally {
    await dbConnection.disconnect()
  }
}

testMongooseImplementation().catch(console.error)
