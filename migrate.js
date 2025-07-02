#!/usr/bin/env node

const { app } = require('electron')
const path = require('path')
require('dotenv').config()

// Import our database modules
const { dbConnection } = require('./src/main/database/connection')
const migrationService = require('./src/main/database/migrationService')

console.log('FocusBook JSON to PostgreSQL Migration Script')
console.log('==============================================')

async function runMigration() {
  try {
    console.log('Connecting to PostgreSQL database...')
    await dbConnection.connect()
    console.log('✓ Database connection established')

    console.log('\nStarting migration process...')
    const result = await migrationService.runFullMigration()

    if (result.success) {
      console.log('✓ Migration completed successfully!')
      console.log(`📊 Records migrated: ${result.recordCount}`)

      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  Warnings/Errors during migration:')
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`)
        })
      }
    } else {
      console.error('❌ Migration failed!')
      console.error(`Error: ${result.message}`)

      if (result.errors && result.errors.length > 0) {
        console.log('\nDetailed errors:')
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`)
        })
      }
    }
  } catch (error) {
    console.error('❌ Migration script failed:', error.message)
    console.error(error.stack)
  } finally {
    try {
      await dbConnection.disconnect()
      console.log('\n✓ Database connection closed')
    } catch (error) {
      console.error('Error closing database connection:', error.message)
    }

    process.exit(0)
  }
}

// Handle command line arguments
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node migrate.js [options]

Options:
  --help, -h    Show this help message
  --force, -f   Force migration even if already completed
  
Environment Variables:
  DB_HOST       PostgreSQL host (default: localhost)
  DB_PORT       PostgreSQL port (default: 5432)
  DB_NAME       Database name (default: focusbook)
  DB_USER       Database user (default: postgres)
  DB_PASSWORD   Database password (default: password)

Examples:
  node migrate.js                    # Run migration
  node migrate.js --force            # Force re-migration
  DB_HOST=myhost node migrate.js     # Use custom database host
`)
  process.exit(0)
}

if (args.includes('--force') || args.includes('-f')) {
  console.log('⚠️  Force migration mode enabled - will re-migrate even if already completed')
  // Override migration status check
  migrationService.getMigrationStatus().isCompleted = false
}

// Mock electron app for userData path
if (!app.isReady()) {
  const os = require('os')
  const mockApp = {
    getPath: (name) => {
      if (name === 'userData') {
        // Use a reasonable default userData path
        return path.join(os.homedir(), '.focusbook')
      }
      return os.tmpdir()
    },
    isReady: () => true
  }

  // Override the app object in migrationService
  Object.defineProperty(
    require.cache[require.resolve('./src/main/database/migrationService')].exports,
    'getUserDataDir',
    {
      value: () => path.join(os.homedir(), '.focusbook', 'Data'),
      writable: true
    }
  )
}

// Run the migration
console.log(`Database Configuration:
  Host: ${process.env.DB_HOST || 'localhost'}
  Port: ${process.env.DB_PORT || '5432'}
  Database: ${process.env.DB_NAME || 'focusbook'}
  User: ${process.env.DB_USER || 'postgres'}
`)

console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to start...')
setTimeout(runMigration, 3000)
