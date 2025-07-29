# FocusBook Database Architecture

This directory contains the complete database architecture for FocusBook, implementing a flexible and scalable data storage system using SQLite for local relational storage.

## Architecture Overview

FocusBook uses a hybrid database architecture designed to support multiple storage backends while providing a unified interface for the application logic.

### Current Configuration

- **Primary Storage**: SQLite (local relational database)
- **Location**: `{userData}/focusbook.db`
- **Format**: Relational tables with SQL syntax
- **Benefits**: ACID compliance, better performance, full relational capabilities, better analytics

## File Structure

### Core Database Files

#### `databaseAdapter.js`

Abstract base class defining the interface for all database implementations. Provides:

- Common connection management
- Health check capabilities
- Error handling patterns
- Standardized API contract

#### `sqliteConnection.js`

SQLite implementation of the database adapter. Features:

- Local relational database storage
- ACID compliance and data integrity
- SQL query syntax with better performance
- Automatic field name mapping for NeDB compatibility
- Tables: `app_usage`, `categories`, `custom_category_mappings`, `focus_sessions`, `timestamps`

#### `hybridConnection.js`

Central database connection manager that:

- Orchestrates different storage backends
- Manages service provider instances
- Handles connection lifecycle
- Provides unified access to all database services

#### `migrationScript.js`

Data migration utility that:

- Migrates existing NeDB data to SQLite
- Handles data transformation and validation
- Preserves data integrity during migration
- Creates backups of original NeDB data

### Service Layer

#### `localAppUsageService.js`

Handles application usage tracking and analytics using SQLite:

- Records app usage by time periods (hourly granularity)
- Manages productivity categorization
- Generates usage statistics and reports
- Tracks domains for browser-based activity
- Seamless integration with SQLite relational tables

#### `localCategoriesService.js`

Manages productivity categories and custom mappings:

- Default category system (Productive/Neutral/Distracting)
- User-defined custom app categorizations
- Category-based productivity scoring
- Settings and preferences management
- Improved query performance with SQLite

#### `localFocusSessionService.js`

Focus session lifecycle and analytics management:

- Session state management (active, paused, completed)
- Pomodoro technique integration
- Interruption tracking with relational integrity
- Performance metrics and trends
- Enhanced analytics capabilities with SQL queries

#### `focusSessionService.js`

Main interface for focus session operations:

- Abstracts underlying storage implementation
- Provides clean API for main process
- Error handling and logging
- Consistency with hybrid connection pattern
- Full compatibility with SQLite backend

### Enhanced Features

#### `popupManager.js` (Main Process)

Smart distraction intervention system:

- Adaptive popup timing based on user behavior
- Progressive dismissal durations
- Focus session respect and quiet hours
- Analytics and effectiveness tracking

## Database Tables

### App Usage (`app_usage`)

```sql
CREATE TABLE app_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- ISO date string
  hour INTEGER,                          -- Hour of day (0-23)
  app_name TEXT NOT NULL,               -- Application name
  time_spent INTEGER DEFAULT 0,         -- Time in milliseconds
  category TEXT NOT NULL,               -- Productivity category
  domain TEXT,                          -- For browser apps
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Categories (`categories`)

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,            -- Category name
  type TEXT NOT NULL,                   -- 'productive', 'neutral', 'distracted'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Custom Category Mappings (`custom_category_mappings`)

```sql
CREATE TABLE custom_category_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_identifier TEXT NOT NULL UNIQUE,  -- App name or identifier
  custom_category TEXT NOT NULL,        -- User-assigned category
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Focus Sessions (`focus_sessions`)

```sql
CREATE TABLE focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                   -- 'focus', 'shortBreak', 'longBreak'
  start_time DATETIME NOT NULL,         -- Session start time
  end_time DATETIME,                    -- Session end time
  planned_duration INTEGER NOT NULL,    -- Planned duration in ms
  actual_duration INTEGER,              -- Actual duration in ms
  status TEXT NOT NULL DEFAULT 'active', -- Session status
  notes TEXT,                           -- User notes
  productivity INTEGER,                 -- User rating (1-5)
  date TEXT NOT NULL,                   -- ISO date string for indexing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Timestamps (`timestamps`)

```sql
CREATE TABLE timestamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_usage_id INTEGER NOT NULL,       -- Foreign key to app_usage
  start_time DATETIME NOT NULL,        -- Timestamp start
  duration INTEGER NOT NULL,           -- Duration in milliseconds
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_usage_id) REFERENCES app_usage(id) ON DELETE CASCADE
);
```

### Focus Session Interruptions (`focus_session_interruptions`)

```sql
CREATE TABLE focus_session_interruptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  focus_session_id INTEGER NOT NULL,   -- Foreign key to focus_sessions
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,                         -- Interruption reason
  app_name TEXT,                       -- App that caused interruption
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (focus_session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
);
```

## Key Features

### Performance Optimizations

- **Indexing**: Automatic indexes on frequently queried fields
- **Batch Operations**: Efficient bulk data operations
- **Connection Pooling**: Managed database connections
- **Caching**: In-memory caching for frequently accessed data

### Data Integrity

- **Atomic Operations**: ACID-compliant transactions
- **Validation**: Data validation at service layer
- **Backups**: Automatic backup system for critical data
- **Error Recovery**: Robust error handling and recovery

### Extensibility

- **Plugin Architecture**: Easy addition of new storage backends
- **Service Pattern**: Modular service-based architecture
- **Interface Abstraction**: Clean separation of concerns
- **Migration Support**: Database schema migration capabilities

## Usage Examples

### Initializing the Database

```javascript
const { hybridConnection } = require('./database/hybridConnection')

// Initialize database connection (now uses SQLite)
await hybridConnection.connect()

// Get service instances (same API, now backed by SQLite)
const appUsageService = hybridConnection.getAppUsageService()
const focusSessionService = hybridConnection.getFocusSessionService()
```

### Recording App Usage

```javascript
// Same API as before, but now uses SQLite tables
await appUsageService.saveAppUsage(
  new Date(), // date
  14, // hour
  'vscode.exe', // appName
  300000, // timeSpent (5 minutes)
  'Code', // category
  null, // domain
  'productive' // productivity
)
```

### Managing Focus Sessions

```javascript
// Same API, now with better performance and relational integrity
const session = await focusSessionService.startSession({
  type: 'focus',
  duration: 25 * 60 * 1000, // 25 minutes
  startTime: Date.now()
})

// Add interruption (now stored in separate table)
await focusSessionService.addInterruption(session._id, 'Application switch', 'chrome.exe')

// Complete session
await focusSessionService.endSession(session._id, 'completed')
```

### Migrating from NeDB

```javascript
// Run the migration script to transfer existing data
const DataMigrator = require('./database/migrationScript')
const migrator = new DataMigrator()

// This will backup existing NeDB data and migrate to SQLite
const success = await migrator.migrate()
console.log('Migration successful:', success)
```

## Best Practices

### Development Guidelines

1. **Always use service layer**: Never access database directly from UI
2. **Error handling**: Wrap database operations in try-catch blocks
3. **Validation**: Validate data at service boundaries
4. **Documentation**: Document all database schema changes

### Performance Tips

1. **Use indexes**: Ensure queries use appropriate indexes
2. **Batch operations**: Group multiple operations when possible
3. **Avoid N+1 queries**: Use efficient query patterns
4. **Monitor performance**: Track query execution times

### Data Management

1. **Regular cleanup**: Implement data retention policies
2. **Backup strategy**: Regular automated backups
3. **Schema evolution**: Plan for database migrations
4. **Monitoring**: Track database health and performance

## Migration from NeDB

The FocusBook database has been upgraded from NeDB to SQLite for better performance and data integrity.

### Benefits of SQLite Migration

- **Better Performance**: Faster queries, especially for analytics and aggregations
- **ACID Compliance**: Guaranteed data integrity and transaction safety
- **Relational Structure**: Proper foreign key relationships and data normalization
- **SQL Capabilities**: Full SQL query support for advanced analytics
- **Scalability**: Better performance as data grows

### Migration Process

The migration is handled automatically by the `migrationScript.js` which:

1. Creates backup of existing NeDB data
2. Initializes SQLite database with proper schema
3. Transfers all data with proper transformation
4. Validates migration success
5. Preserves all existing functionality

### Backward Compatibility

The service layer maintains full API compatibility - no changes needed to existing code that uses the database services.

## Future Enhancements

### Planned Features

- Cloud sync capabilities (with SQLite as local cache)
- Real-time collaboration features
- Advanced analytics leveraging SQL capabilities
- Cross-device synchronization
- Export/import functionality (SQL/CSV support)
- Full-text search capabilities

### Scalability Considerations

- Connection pooling for high-concurrency scenarios
- Query optimization and indexing strategies
- Backup and recovery procedures
- Performance monitoring and analytics

---

_This documentation is maintained by the FocusBook development team. The SQLite migration provides a solid foundation for future enhancements while maintaining full backward compatibility._
