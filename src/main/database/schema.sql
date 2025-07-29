-- FocusBook SQLite Database Schema


-- App metadata table for migration tracking and app settings
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table to store productivity categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('productive', 'distracted', 'neutral')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom category mappings table
CREATE TABLE IF NOT EXISTS custom_category_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_identifier TEXT NOT NULL UNIQUE, -- app name or domain
    custom_category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Main app usage table
CREATE TABLE IF NOT EXISTS app_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- SQLite doesn't have DATE type, use TEXT with ISO format
    hour INTEGER CHECK (hour >= 0 AND hour <= 23), -- NULL for daily aggregates
    app_name TEXT NOT NULL,
    time_spent INTEGER NOT NULL DEFAULT 0, -- time in milliseconds
    category TEXT NOT NULL,
    description TEXT,
    domain TEXT, -- for browser tabs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Timestamps table for detailed session tracking
CREATE TABLE IF NOT EXISTS timestamps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_usage_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    duration INTEGER NOT NULL, -- duration in milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_usage_id) REFERENCES app_usage(id) ON DELETE CASCADE
);

-- Focus sessions table for focus session tracking
CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('focus', 'shortBreak', 'longBreak')),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    planned_duration INTEGER NOT NULL, -- duration in milliseconds
    actual_duration INTEGER, -- duration in milliseconds
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'cancelled')) DEFAULT 'active',
    notes TEXT,
    productivity INTEGER CHECK (productivity >= 1 AND productivity <= 5),
    date TEXT NOT NULL, -- SQLite doesn't have DATE type, use TEXT with ISO format
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Focus session interruptions table
CREATE TABLE IF NOT EXISTS focus_session_interruptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    focus_session_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    app_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (focus_session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date);
CREATE INDEX IF NOT EXISTS idx_app_usage_date_hour ON app_usage(date, hour);
CREATE INDEX IF NOT EXISTS idx_app_usage_app_name ON app_usage(app_name);
CREATE INDEX IF NOT EXISTS idx_app_usage_category ON app_usage(category);
CREATE INDEX IF NOT EXISTS idx_app_usage_domain ON app_usage(domain);
CREATE INDEX IF NOT EXISTS idx_timestamps_app_usage_id ON timestamps(app_usage_id);
CREATE INDEX IF NOT EXISTS idx_timestamps_start_time ON timestamps(start_time);
CREATE INDEX IF NOT EXISTS idx_custom_mappings_app_identifier ON custom_category_mappings(app_identifier);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_date ON focus_sessions(date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_time ON focus_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_type ON focus_sessions(type);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_status ON focus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_focus_interruptions_session_id ON focus_session_interruptions(focus_session_id);

-- Insert default categories (SQLite uses INSERT OR IGNORE instead of ON CONFLICT)
INSERT OR IGNORE INTO categories (name, type) VALUES 
    ('Code', 'productive'),
    ('Browsing', 'neutral'),
    ('Communication', 'neutral'),
    ('Utilities', 'neutral'),
    ('Entertainment', 'distracted'),
    ('Miscellaneous', 'neutral');

-- SQLite triggers for updating updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_app_usage_updated_at 
    AFTER UPDATE ON app_usage 
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE app_usage SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_custom_category_mappings_updated_at 
    AFTER UPDATE ON custom_category_mappings 
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE custom_category_mappings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_focus_sessions_updated_at 
    AFTER UPDATE ON focus_sessions 
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE focus_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;