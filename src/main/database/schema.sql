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

-- ============================================================================
-- SPAN-MODEL CATEGORIZATION (new architecture; coexists with legacy app_usage)
-- ============================================================================
-- CORE PRINCIPLE — two kinds of truth, never conflated:
--   `span`  records WHAT HAPPENED — an immutable event log. It stores the
--           structured activity key (app/domain/path/title), NOT a category.
--   `rule`  records WHAT WE CURRENTLY BELIEVE IT MEANS — mutable.
-- Category + productivity are resolved at QUERY TIME by joining spans against the
-- current rules (see src/main/classification/resolver.js). This is what makes
-- re-categorization retroactive for free: edit a rule and every past span's
-- category changes with zero UPDATE sweep. A span must NEVER store a resolved
-- category/mode — that would bake a possibly-wrong interpretation into the log.
--
-- Scale is single-user local SQLite (~50k spans/year), so the query-time join is
-- free; if it ever isn't, add a materialized cache DOWNSTREAM — never denormalize
-- the log.

-- Immutable event log. No category/mode column BY DESIGN.
-- `key_app_name` is the friendly display name (Windows FileDescription, e.g. "Visual
-- Studio Code" for code.exe) captured at write time. It is a FACT about what ran, not
-- an interpretation, so storing it does NOT violate the no-denormalized-category rule.
-- The dashboard uses it as the display key for app spans, so no name resolver is
-- needed at read time. Nullable — falls back to key_app when unavailable.
CREATE TABLE IF NOT EXISTS span (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_source TEXT NOT NULL CHECK (key_source IN ('app', 'web')),
    key_app TEXT NOT NULL,           -- always present (web activity ran in an app); the raw exe
    key_app_name TEXT,               -- friendly display name (FileDescription); falls back to key_app
    key_domain TEXT,                 -- lowercased, 'www.' stripped; NULL for app spans
    key_path TEXT,                   -- pathname (+ opt-in preserved query param); NULL for app spans
    title TEXT,                      -- weak matching signal only
    start DATETIME NOT NULL,
    end DATETIME NOT NULL,
    degraded_flag INTEGER NOT NULL DEFAULT 0, -- 1 when the key was captured degraded (no URL, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories: taxonomy. `default_productivity` is the judgment applied when no
-- per-user productivity_override exists. Kept separate from category identity so
-- productivity can be re-judged without redefining the taxonomy.
CREATE TABLE IF NOT EXISTS category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_productivity TEXT NOT NULL
        CHECK (default_productivity IN ('productive', 'neutral', 'distracting')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rules: pattern -> category. Specificity is DERIVED from matcher_type at resolve
-- time (not a stored, user-editable column). is_user_rule breaks specificity ties
-- in the user's favour. No `priority`/order column: resolution is most-specific-wins,
-- not first-match, so rule ORDER is deliberately meaningless.
CREATE TABLE IF NOT EXISTS rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matcher_type TEXT NOT NULL CHECK (matcher_type IN
        ('title_contains', 'app', 'domain', 'domain_path_prefix', 'domain_path_regex')),
    matcher_value TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    is_user_rule INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
);

-- Per-user productivity override for a category. Single-user local app, so at most
-- one row per category. Absence means "use category.default_productivity".
CREATE TABLE IF NOT EXISTS productivity_override (
    category_id INTEGER PRIMARY KEY,
    productivity TEXT NOT NULL
        CHECK (productivity IN ('productive', 'neutral', 'distracting')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
);

-- ============================================================================
-- PRESENCE MODEL (was the user here?) — see docs/PRESENCE_AND_IDLE_ENGINE.md
-- ============================================================================
-- A SECOND immutable event log, sibling of `span`. Where `span` records WHAT ran,
-- `presence_span` records WHETHER THE USER WAS PRESENT, as typed, gapless intervals.
-- The gapless invariant: for any period the app was running, presence spans tile the
-- timeline with no gaps and no overlaps — every second is exactly one type. Absence is
-- NEVER a hole in the data; it is an explicit span. No interpretation is stored here
-- (that lives in span_annotation, resolved at query time — same shape as span+rule).

-- Immutable presence log. `type` is the FACT observed; `active` means input was seen,
-- the four absence types record WHY the user was gone. Durations are ALWAYS end-start
-- from the stored edge timestamps, never accumulated tick counts (timers stop on sleep).
CREATE TABLE IF NOT EXISTS presence_span (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('active', 'idle', 'locked', 'suspended', 'unknown')),
    start DATETIME NOT NULL,   -- wall-clock ISO, for display
    end DATETIME NOT NULL,     -- wall-clock ISO; duration = end - start
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Liveness watermark: a single row updated by a heartbeat every few seconds. On startup,
-- if last_alive_at is meaningfully older than now, the app was NOT running for that gap
-- (crash, power cut, force-kill) — that window is backfilled as an `unknown` presence
-- span. This is what makes crash survival correct WITHOUT any shutdown event, and it
-- prevents the "coded 11h straight overnight" bug (extending the last open span to now).
CREATE TABLE IF NOT EXISTS app_liveness (
    id INTEGER PRIMARY KEY CHECK (id = 1),   -- single-row table
    last_alive_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Span annotation: the user's INTERPRETATION of an absence ("that idle block was a
-- meeting"). A new FACT, not a correction — the presence_span stays exactly as recorded
-- ("no input 10:00-10:23" is true forever). Dashboards JOIN this in at query time, the
-- same way rules resolve categories. Nothing in the log is ever rewritten.
CREATE TABLE IF NOT EXISTS span_annotation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presence_span_id INTEGER NOT NULL,
    user_label TEXT NOT NULL,        -- 'break' | 'working' | 'meeting' | free text
    answered_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (presence_span_id) REFERENCES presence_span(id) ON DELETE CASCADE
);

-- Seed span-model categories. Small, stable taxonomy with a default productivity per
-- category (the judgment axis, independently overridable via productivity_override).
INSERT OR IGNORE INTO category (name, default_productivity) VALUES
    ('Coding',        'productive'),
    ('Communication', 'neutral'),
    ('Browsing',      'neutral'),
    ('Utilities',     'neutral'),
    ('Entertainment', 'distracting'),
    ('Social',        'distracting'),
    ('Uncategorized', 'neutral');

-- Seed a HANDFUL of built-in rules (NOT the full library — that is a separate content
-- task). Enough that common apps/domains resolve so a fresh DB isn't all-unrated.
-- category_id is resolved by name so seed order is irrelevant. is_user_rule=0 (built-in);
-- user rules beat these at equal specificity. Specificity is derived from matcher_type,
-- so no priority/order column exists.
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'app', 'code.exe', id, 0 FROM category WHERE name='Coding';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'app', 'windowsterminal.exe', id, 0 FROM category WHERE name='Coding';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'stackoverflow.com', id, 0 FROM category WHERE name='Coding';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'github.com', id, 0 FROM category WHERE name='Coding';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'app', 'slack.exe', id, 0 FROM category WHERE name='Communication';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'app', 'ms-teams.exe', id, 0 FROM category WHERE name='Communication';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'mail.google.com', id, 0 FROM category WHERE name='Communication';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'youtube.com', id, 0 FROM category WHERE name='Entertainment';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'netflix.com', id, 0 FROM category WHERE name='Entertainment';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'app', 'spotify.exe', id, 0 FROM category WHERE name='Entertainment';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'reddit.com', id, 0 FROM category WHERE name='Social';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'x.com', id, 0 FROM category WHERE name='Social';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'domain', 'facebook.com', id, 0 FROM category WHERE name='Social';
INSERT OR IGNORE INTO rule (matcher_type, matcher_value, category_id, is_user_rule)
    SELECT 'app', 'explorer.exe', id, 0 FROM category WHERE name='Utilities';

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

-- Span-model indexes. Reads are time-ranged (dashboards ask "spans in [start,end]")
-- and grouped by key when surfacing uncategorized time.
CREATE INDEX IF NOT EXISTS idx_span_start ON span(start);
CREATE INDEX IF NOT EXISTS idx_span_key_app ON span(key_app);
CREATE INDEX IF NOT EXISTS idx_span_key_domain ON span(key_domain);
CREATE INDEX IF NOT EXISTS idx_rule_matcher_type ON rule(matcher_type);
CREATE INDEX IF NOT EXISTS idx_rule_category_id ON rule(category_id);

-- Presence-model indexes. Reads are time-ranged and grouped by type (dashboards ask
-- "how much locked/idle/unknown in [start,end]"); annotations are looked up by span.
CREATE INDEX IF NOT EXISTS idx_presence_span_start ON presence_span(start);
CREATE INDEX IF NOT EXISTS idx_presence_span_type ON presence_span(type);
CREATE INDEX IF NOT EXISTS idx_span_annotation_span_id ON span_annotation(presence_span_id);

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
    ('Learning', 'productive', '#14b8a6', 'GraduationCap', 'Deep work'),
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
    -- Learning (productive) -- pulled OUT of the old neutral Browsing bucket, so
    -- courses/tutorials/study count as focused productive time on their own.
    ('udemy.com', 'Learning', 'app', 10),
    ('vulms.vu.edu.pk', 'Learning', 'app', 10),
    ('coursera.org', 'Learning', 'app', 10),
    ('khanacademy.org', 'Learning', 'app', 10),
    ('edx.org', 'Learning', 'app', 10),
    ('tutorial', 'Learning', 'keyword', 5),
    ('course', 'Learning', 'keyword', 5),
    ('lecture', 'Learning', 'keyword', 5),
    ('study', 'Learning', 'keyword', 5),
    ('learning', 'Learning', 'keyword', 5),
    ('research', 'Learning', 'keyword', 5),
    -- Browsing (neutral) -- general-purpose browsing left after learning split out
    ('chatgpt.com', 'Browsing', 'app', 10),
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