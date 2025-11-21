#!/usr/bin/env node

require('dotenv').config()
const { Pool } = require('pg')

async function testConnection() {
  console.log('🔍 Testing PostgreSQL connection...')

  const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'focusbook',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    connectionTimeoutMillis: 5000
  }

  console.log(`📋 Connection config:
  Host: ${config.host}
  Port: ${config.port}
  Database: ${config.database}
  User: ${config.user}
`)

  const pool = new Pool(config)

  try {
    const client = await pool.connect()
    console.log('✅ Connected to PostgreSQL successfully!')

    const result = await client.query('SELECT NOW()')
    console.log(`⏰ Server time: ${result.rows[0].now}`)

    // Test if focusbook database exists
    const dbCheck = await client.query('SELECT current_database()')
    console.log(`📊 Connected to database: ${dbCheck.rows[0].current_database}`)

    client.release()

    // Test table creation
    const testClient = await pool.connect()
    await testClient.query('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY)')
    await testClient.query('DROP TABLE IF EXISTS test_table')
    console.log('✅ Database permissions verified - can create/drop tables')
    testClient.release()

    console.log('\n🎉 Database test completed successfully!')
    console.log('   You can now run: npm run dev')
  } catch (error) {
    console.error('❌ Database connection failed:')
    console.error(`   ${error.message}`)

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting steps:')
      console.log('   1. Ensure PostgreSQL is running')
      console.log('   2. Check if the service is started:')
      console.log('      Windows: net start postgresql-x64-14')
      console.log('      Linux: sudo systemctl start postgresql')
      console.log('   3. Verify connection settings in .env file')
    } else if (error.code === '3D000') {
      console.log('\n💡 Database does not exist. Create it with:')
      console.log(`   createdb -U ${config.user} ${config.database}`)
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication failed. Check:')
      console.log('   1. Username and password in .env file')
      console.log('   2. PostgreSQL user permissions')
    }
  } finally {
    await pool.end()
  }
}

testConnection().catch(console.error)
