# FocusBook Database Architecture

This directory contains the complete database architecture for FocusBook, implementing a flexible and scalable data storage system using NeDB for local file-based storage.

## Architecture Overview

FocusBook uses a hybrid database architecture designed to support multiple storage backends while providing a unified interface for the application logic.

### Current Configuration
- **Primary Storage**: NeDB (local file-based database)
- **Location**: `{userData}/LocalData/`
- **Format**: JSON-based documents with MongoDB-like syntax
- **Benefits**: No external dependencies, embedded database, offline-first

## File Structure

### Core Database Files

#### `databaseAdapter.js`
Abstract base class defining the interface for all database implementations. Provides:
- Common connection management
- Health check capabilities
- Error handling patterns
- Standardized API contract

#### `nedbConnection.js`
NeDB implementation of the database adapter. Features:
- Local file-based storage
- Automatic indexing for performance
- MongoDB-like query syntax
- Atomic operations and data integrity
- Collections: `appUsage`, `categories`, `customCategoryMappings`, `focusSessions`

#### `hybridConnection.js`
Central database connection manager that:
- Orchestrates different storage backends
- Manages service provider instances
- Handles connection lifecycle
- Provides unified access to all database services

### Service Layer

#### `localAppUsageService.js`
Handles application usage tracking and analytics:
- Records app usage by time periods (hourly granularity)
- Manages productivity categorization
- Generates usage statistics and reports
- Tracks domains for browser-based activity

#### `localCategoriesService.js`
Manages productivity categories and custom mappings:
- Default category system (Productive/Neutral/Distracting)
- User-defined custom app categorizations
- Category-based productivity scoring
- Settings and preferences management

#### `localFocusSessionService.js`
Focus session lifecycle and analytics management:
- Session state management (active, paused, completed)
- Pomodoro technique integration
- Interruption tracking and analysis
- Performance metrics and trends

#### `focusSessionService.js`
Main interface for focus session operations:
- Abstracts underlying storage implementation
- Provides clean API for main process
- Error handling and logging
- Consistency with hybrid connection pattern

### Enhanced Features

#### `popupManager.js` (Main Process)
Smart distraction intervention system:
- Adaptive popup timing based on user behavior
- Progressive dismissal durations
- Focus session respect and quiet hours
- Analytics and effectiveness tracking

## Data Collections

### App Usage (`appUsage`)
```javascript
{
  date: Date,           // Usage date
  hour: Number,         // Hour of day (0-23)
  appName: String,      // Application name
  timeSpent: Number,    // Time in milliseconds
  category: String,     // Productivity category
  domain: String,       // For browser apps
  timestamps: [...]     // Detailed session timestamps
}
```

### Categories (`categories`)
```javascript
{
  name: String,         // Category name
  type: String          // 'productive', 'neutral', 'distracted'
}
```

### Custom Category Mappings (`customCategoryMappings`)
```javascript
{
  appIdentifier: String,   // App name or identifier
  customCategory: String   // User-assigned category
}
```

### Focus Sessions (`focusSessions`)
```javascript
{
  type: String,              // 'focus', 'shortBreak', 'longBreak'
  startTime: Date,           // Session start time
  endTime: Date,             // Session end time
  plannedDuration: Number,   // Planned duration in ms
  actualDuration: Number,    // Actual duration in ms
  status: String,            // 'active', 'paused', 'completed', 'cancelled'
  interruptions: [...],      // Array of interruption events
  productivity: Number,      // User rating (1-5)
  notes: String,             // User notes
  date: Date                 // Session date for indexing
}
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

// Initialize database connection
await hybridConnection.connect()

// Get service instances
const appUsageService = hybridConnection.getAppUsageService()
const focusSessionService = hybridConnection.getFocusSessionService()
```

### Recording App Usage
```javascript
await appUsageService.saveAppUsage(
  new Date(),      // date
  14,              // hour
  'vscode.exe',    // appName
  300000,          // timeSpent (5 minutes)
  'Code',          // category
  null,            // domain
  'productive'     // productivity
)
```

### Managing Focus Sessions
```javascript
// Start a focus session
const session = await focusSessionService.startSession({
  type: 'focus',
  duration: 25 * 60 * 1000, // 25 minutes
  startTime: Date.now()
})

// Add interruption
await focusSessionService.addInterruption(
  session._id,
  'Application switch',
  'chrome.exe'
)

// Complete session
await focusSessionService.endSession(session._id, 'completed')
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

## Future Enhancements

### Planned Features
- Cloud sync capabilities (MongoDB Atlas integration)
- Real-time collaboration features
- Advanced analytics and AI insights
- Cross-device synchronization
- Export/import functionality

### Scalability Considerations
- Horizontal scaling support
- Caching layer implementation
- Performance optimization
- Multi-tenant architecture support

---

*This documentation is maintained by the FocusBook development team. For questions or contributions, please refer to the main project repository.*