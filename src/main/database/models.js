const mongoose = require('mongoose')

// Timestamp schema for tracking app usage sessions
const timestampSchema = new mongoose.Schema(
  {
    start: {
      type: Date,
      required: true,
      default: Date.now
    },
    duration: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
)

// App usage schema - main data tracking
const appUsageSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    hour: {
      type: Number,
      min: 0,
      max: 23,
      sparse: true // Allow null values for daily aggregates
    },
    appName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
      index: true
    },
    timeSpent: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    domain: {
      type: String,
      trim: true,
      maxlength: 255
    },
    timestamps: [timestampSchema]
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'appUsage'
  }
)

// Compound indexes for optimized queries
appUsageSchema.index({ date: -1, hour: 1 })
appUsageSchema.index({ date: -1, appName: 1 })
appUsageSchema.index({ date: -1, category: 1 })
appUsageSchema.index({ appName: 1, date: -1 })

// Virtual for formatted date
appUsageSchema.virtual('formattedDate').get(function () {
  return this.date.toISOString().split('T')[0]
})

// Virtual for formatted hour
appUsageSchema.virtual('formattedHour').get(function () {
  return this.hour !== null ? `${this.hour.toString().padStart(2, '0')}:00` : null
})

// Method to add time to existing usage
appUsageSchema.methods.addTime = function (additionalTime) {
  this.timeSpent += additionalTime
  return this.save()
}

// Static method to find usage by date range
appUsageSchema.statics.findByDateRange = function (startDate, endDate) {
  const query = {}
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
  } else if (startDate) {
    query.date = { $gte: new Date(startDate) }
  } else if (endDate) {
    query.date = { $lte: new Date(endDate) }
  }

  return this.find(query).sort({ date: -1, hour: -1 }).lean()
}

// Categories schema
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['productive', 'distracted', 'neutral'],
      index: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'categories'
  }
)

// Custom category mappings schema
const customCategoryMappingSchema = new mongoose.Schema(
  {
    appIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 255,
      index: true
    },
    customCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'customCategoryMappings'
  }
)

// Focus sessions schema
const focusSessionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['focus', 'shortBreak', 'longBreak'],
      index: true
    },
    startTime: {
      type: Date,
      required: true,
      index: true
    },
    endTime: {
      type: Date,
      index: true
    },
    plannedDuration: {
      type: Number,
      required: true,
      min: 0
    },
    actualDuration: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active',
      index: true
    },
    interruptions: [{
      timestamp: { type: Date, default: Date.now },
      reason: { type: String, maxlength: 255 },
      appName: { type: String, maxlength: 255 }
    }],
    notes: {
      type: String,
      maxlength: 1000
    },
    productivity: {
      type: Number,
      min: 1,
      max: 5
    },
    date: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'focusSessions'
  }
)

// Focus session methods
focusSessionSchema.methods.complete = function(actualDuration) {
  this.status = 'completed'
  this.endTime = new Date()
  this.actualDuration = actualDuration || this.plannedDuration
  return this.save()
}

focusSessionSchema.methods.cancel = function() {
  this.status = 'cancelled'
  this.endTime = new Date()
  this.actualDuration = Date.now() - this.startTime.getTime()
  return this.save()
}

focusSessionSchema.methods.addInterruption = function(reason, appName) {
  this.interruptions.push({
    timestamp: new Date(),
    reason: reason,
    appName: appName
  })
  return this.save()
}

// Static methods for focus sessions
focusSessionSchema.statics.findByDateRange = function(startDate, endDate) {
  const query = {}
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
  } else if (startDate) {
    query.date = { $gte: new Date(startDate) }
  } else if (endDate) {
    query.date = { $lte: new Date(endDate) }
  }
  
  return this.find(query).sort({ startTime: -1 }).lean()
}

focusSessionSchema.statics.getTodaysStats = function() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return this.aggregate([
    {
      $match: {
        date: { $gte: today, $lt: tomorrow },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        totalSessions: { $sum: 1 },
        totalDuration: { $sum: '$actualDuration' },
        avgDuration: { $avg: '$actualDuration' }
      }
    }
  ])
}

// Virtual for session duration in minutes
focusSessionSchema.virtual('durationInMinutes').get(function() {
  return Math.round((this.actualDuration || this.plannedDuration) / 60000)
})

// Pre-save middleware for validation
appUsageSchema.pre('save', function (next) {
  // Validate that if hour is provided, it's a daily record or hour-specific record
  if (this.hour !== null && this.hour !== undefined) {
    if (this.hour < 0 || this.hour > 23) {
      return next(new Error('Hour must be between 0 and 23'))
    }
  }

  // Ensure timeSpent is not negative
  if (this.timeSpent < 0) {
    this.timeSpent = 0
  }

  next()
})

// Pre-save middleware for category validation
categorySchema.pre('save', function (next) {
  // Capitalize first letter of category name
  this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1)
  next()
})

// Create models
const AppUsage = mongoose.model('AppUsage', appUsageSchema)
const Category = mongoose.model('Category', categorySchema)
const CustomCategoryMapping = mongoose.model('CustomCategoryMapping', customCategoryMappingSchema)
const FocusSession = mongoose.model('FocusSession', focusSessionSchema)

module.exports = {
  AppUsage,
  Category,
  CustomCategoryMapping,
  FocusSession,
  // Export schemas for testing
  appUsageSchema,
  categorySchema,
  customCategoryMappingSchema,
  focusSessionSchema
}
