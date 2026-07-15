-- FocusBook SQLite Database Schema


-- App metadata table for migration tracking and app settings
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table to store productivity categories.
-- `color` and `icon` are optional presentation attributes so the renderer can
-- drive its palette/iconography from the DB instead of hardcoded per-component
-- maps (added columns are also backfilled by runSchemaMigrations for old DBs).
-- `default_mode` is the fallback work-mode (Level 2) for apps in this category
-- when no rule/override pins a more specific mode; see the `modes` table below.
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('productive', 'distracted', 'neutral')),
    color TEXT,
    icon TEXT,
    default_mode TEXT, -- references modes.name; nullable so old rows/UI keep working
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Work-modes (Level 2 classification): a finer verdict that sits ON TOP of the
-- existing categories.type (Level 1: productive/neutral/distracted) without
-- replacing it. `rollup` is the source of truth for mode -> Level-1 verdict, so
-- the AreaChart's productive/neutral/distracting series is reproduced exactly by
-- summing the modes that roll up into each bucket. color/icon drive the DB-driven
-- palette for the new mode donut/drill-down, mirroring the categories table.
CREATE TABLE IF NOT EXISTS modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
        CHECK (name IN ('Deep work', 'Creative', 'Collaboration', 'Break', 'Distraction')),
    rollup TEXT NOT NULL CHECK (rollup IN ('productive', 'distracted', 'neutral')),
    color TEXT,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Category rules: the data-driven replacement for the hardcoded APP_CATEGORIES
-- catalog in src/preload/categories.js. Each rule maps a text pattern to a
-- category. `match_type` is 'app' (substring match against the exe/app key, the
-- reliable signal) or 'keyword' (substring match against the window title/url).
-- getCategory evaluates: user override -> 'app' rules -> 'keyword' rules ->
-- Miscellaneous. `priority` lets specific rules win (higher first); ties broken
-- by app-before-keyword then insertion order.
-- `mode` (nullable) lets a rule pin a Level-2 work-mode directly (e.g. any window
-- whose title contains 'figma' -> Creative) independent of the category it maps to.
-- When null, the mode falls back to categories.default_mode for the matched category.
CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category TEXT NOT NULL, -- references categories.name (not FK-enforced; free text like custom_category_mappings)
    match_type TEXT NOT NULL CHECK (match_type IN ('app', 'keyword')) DEFAULT 'keyword',
    priority INTEGER NOT NULL DEFAULT 0,
    mode TEXT, -- optional Level-2 mode override; references modes.name (not FK-enforced)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pattern, match_type)
);

-- Custom category mappings table
CREATE TABLE IF NOT EXISTS custom_category_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_identifier TEXT NOT NULL UNIQUE, -- app name or domain
    custom_category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-app work-mode (Level 2) overrides. Mirrors custom_category_mappings but for
-- MODE instead of category: when the user pins a specific work-mode to an app/domain
-- (e.g. "always count figma.exe as Creative"), getMode returns it before consulting
-- the rule/scorer/default layers. Keyed by the same identifier getMode looks up
-- (appKey / domain / exe). Unlike a category retag, a mode override does not rewrite
-- history rows because mode is derived, not stored-per-rule.
CREATE TABLE IF NOT EXISTS mode_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_identifier TEXT NOT NULL UNIQUE, -- app name or domain (matches getMode's key)
    mode TEXT NOT NULL,                  -- references modes.name (not FK-enforced)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Exclusion list table: apps/domains the user has opted out of tracking.
-- Column names (identifier, type) match the collection fields used by
-- LocalCategoriesService, which addresses this table via the collection
-- name "exclusionList" (getTableName falls through to the literal name).
CREATE TABLE IF NOT EXISTS exclusionList (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL, -- app name or domain
    type TEXT NOT NULL CHECK (type IN ('app', 'domain')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (identifier, type)
);

-- Main app usage table
CREATE TABLE IF NOT EXISTS app_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- SQLite doesn't have DATE type, use TEXT with ISO format
    hour INTEGER CHECK (hour >= 0 AND hour <= 23), -- NULL for daily aggregates
    app_name TEXT NOT NULL,
    time_spent INTEGER NOT NULL DEFAULT 0, -- time in milliseconds
    category TEXT NOT NULL,
    mode TEXT, -- Level-2 work-mode (references modes.name); nullable for old rows
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
    paused_at DATETIME, -- timestamp when session was paused
    paused_duration INTEGER DEFAULT 0, -- total time paused in milliseconds
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (focus_session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date);
CREATE INDEX IF NOT EXISTS idx_app_usage_date_hour ON app_usage(date, hour);
CREATE INDEX IF NOT EXISTS idx_app_usage_app_name ON app_usage(app_name);
CREATE INDEX IF NOT EXISTS idx_app_usage_category ON app_usage(category);
CREATE INDEX IF NOT EXISTS idx_app_usage_mode ON app_usage(mode);
CREATE INDEX IF NOT EXISTS idx_app_usage_domain ON app_usage(domain);
CREATE INDEX IF NOT EXISTS idx_timestamps_app_usage_id ON timestamps(app_usage_id);
CREATE INDEX IF NOT EXISTS idx_timestamps_start_time ON timestamps(start_time);
CREATE INDEX IF NOT EXISTS idx_custom_mappings_app_identifier ON custom_category_mappings(app_identifier);
CREATE INDEX IF NOT EXISTS idx_mode_overrides_app_identifier ON mode_overrides(app_identifier);
CREATE INDEX IF NOT EXISTS idx_exclusion_list_identifier ON exclusionList(identifier);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_date ON focus_sessions(date);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_time ON focus_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_type ON focus_sessions(type);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_status ON focus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_focus_interruptions_session_id ON focus_session_interruptions(focus_session_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_match_type ON category_rules(match_type);

-- Seed the five work-modes (Level 2). rollup maps each mode back to the existing
-- Level-1 verdict so the AreaChart's productive/neutral/distracting bands are the
-- exact sum of the modes underneath them. color/icon drive the mode donut/drill-down.
INSERT OR IGNORE INTO modes (name, rollup, color, icon) VALUES
    ('Deep work',     'productive',  '#00d8ff', 'Brain'),
    ('Creative',      'productive',  '#a855f7', 'Palette'),
    ('Collaboration', 'productive',  '#5ac26d', 'Users'),
    ('Break',         'neutral',     '#f59e0b', 'Coffee'),
    ('Distraction',   'distracted',  '#ff6384', 'AlertTriangle');

-- Insert default categories (SQLite uses INSERT OR IGNORE instead of ON CONFLICT).
-- color is the hex used by the legacy APP_CATEGORIES map; icon is a lucide-react
-- icon name the renderer can resolve. Social Media is new and distracting.
-- default_mode is the Level-2 fallback when no rule/override pins a mode: Code and
-- learning-oriented Browsing default to Deep work, Communication to Collaboration,
-- Entertainment/Social Media to Distraction, and low-signal buckets to Break.
INSERT OR IGNORE INTO categories (name, type, color, icon, default_mode) VALUES
    ('Code', 'productive', '#00d8ff', 'Code', 'Deep work'),
    ('Browsing', 'neutral', '#b381c9', 'Globe', 'Deep work'),
    ('Communication', 'neutral', '#5ac26d', 'MessageSquare', 'Collaboration'),
    ('Utilities', 'neutral', '#36a2eb', 'Wrench', 'Break'),
    ('Entertainment', 'distracted', '#ff6384', 'Video', 'Distraction'),
    ('Social Media', 'distracted', '#f97316', 'Users', 'Distraction'),
    ('Miscellaneous', 'neutral', '#7a7a7a', 'Package', 'Break');

-- Seed category rules from the previously-hardcoded APP_CATEGORIES catalog so
-- classification is data-driven with no loss of the built-in defaults. 'app'
-- rules match the exe/app key; 'keyword' rules match the window title/url.
-- Social-media patterns are pulled OUT of the old neutral Browsing bucket and
-- given their own distracting category (this is the Twitter fix).
INSERT OR IGNORE INTO category_rules (pattern, category, match_type, priority) VALUES
    -- Code
    ('Code.exe', 'Code', 'app', 10),
    ('WindowsTerminal.exe', 'Code', 'app', 10),
    ('denenv.exe', 'Code', 'app', 10),
    ('stackoverflow.com', 'Code', 'app', 10),
    ('github', 'Code', 'keyword', 0),
    ('gitlab', 'Code', 'keyword', 0),
    ('programming', 'Code', 'keyword', 0),
    ('development', 'Code', 'keyword', 0),
    ('debug', 'Code', 'keyword', 0),
    -- Social Media (distracting) -- moved out of Browsing
    ('twitter', 'Social Media', 'keyword', 5),
    ('x.com', 'Social Media', 'keyword', 5),
    ('facebook', 'Social Media', 'keyword', 5),
    ('instagram', 'Social Media', 'keyword', 5),
    ('reddit', 'Social Media', 'keyword', 5),
    ('tiktok', 'Social Media', 'keyword', 5),
    ('snapchat', 'Social Media', 'keyword', 5),
    -- Communication
    ('Skype.exe', 'Communication', 'app', 10),
    ('ms-teams.exe', 'Communication', 'app', 10),
    ('mail.google.com', 'Communication', 'app', 10),
    ('email', 'Communication', 'keyword', 0),
    ('gmail', 'Communication', 'keyword', 0),
    ('outlook', 'Communication', 'keyword', 0),
    ('slack', 'Communication', 'keyword', 0),
    -- Browsing / learning (neutral)
    ('udemy.com', 'Browsing', 'app', 10),
    ('vulms.vu.edu.pk', 'Browsing', 'app', 10),
    ('chatgpt.com', 'Browsing', 'app', 10),
    ('tutorial', 'Browsing', 'keyword', 0),
    ('course', 'Browsing', 'keyword', 0),
    ('research', 'Browsing', 'keyword', 0),
    ('study', 'Browsing', 'keyword', 0),
    ('learning', 'Browsing', 'keyword', 0),
    ('lecture', 'Browsing', 'keyword', 0),
    ('linkedin', 'Browsing', 'keyword', 0),
    -- Utilities
    ('Notepad.exe', 'Utilities', 'app', 10),
    ('explorer.exe', 'Utilities', 'app', 10),
    ('TaskManager.exe', 'Utilities', 'app', 10),
    ('Application Frame Host', 'Utilities', 'app', 10),
    ('settings', 'Utilities', 'keyword', 0),
    ('calculator', 'Utilities', 'keyword', 0),
    -- Entertainment (distracting)
    ('Spotify.exe', 'Entertainment', 'app', 10),
    ('vlc.exe', 'Entertainment', 'app', 10),
    ('youtube', 'Entertainment', 'keyword', 0),
    ('netflix', 'Entertainment', 'keyword', 0),
    ('music', 'Entertainment', 'keyword', 0),
    ('movie', 'Entertainment', 'keyword', 0),
    ('game', 'Entertainment', 'keyword', 0),
    ('twitch', 'Entertainment', 'keyword', 0);

-- SQLite triggers for updating updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_app_usage_updated_at 
    AFTER UPDATE ON app_usage 
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE app_usage SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_modes_updated_at
    AFTER UPDATE ON modes
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE modes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_custom_category_mappings_updated_at
    AFTER UPDATE ON custom_category_mappings
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE custom_category_mappings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mode_overrides_updated_at
    AFTER UPDATE ON mode_overrides
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE mode_overrides SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_exclusion_list_updated_at
    AFTER UPDATE ON exclusionList
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE exclusionList SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_focus_sessions_updated_at
    AFTER UPDATE ON focus_sessions 
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE focus_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_focus_session_interruptions_updated_at 
    AFTER UPDATE ON focus_session_interruptions 
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE focus_session_interruptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;