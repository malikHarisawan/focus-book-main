-- FocusBook PostgreSQL Database Schema
-- This schema replaces the JSON file storage system

-- App metadata table for migration tracking and app settings
CREATE TABLE IF NOT EXISTS app_metadata (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table to store productivity categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('productive', 'distracted', 'neutral')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom category mappings table
CREATE TABLE IF NOT EXISTS custom_category_mappings (
    id SERIAL PRIMARY KEY,
    app_identifier VARCHAR(255) NOT NULL UNIQUE, -- app name or domain
    custom_category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main app usage table
CREATE TABLE IF NOT EXISTS app_usage (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    hour INTEGER CHECK (hour >= 0 AND hour <= 23), -- NULL for daily aggregates
    app_name VARCHAR(255) NOT NULL,
    time_spent INTEGER NOT NULL DEFAULT 0, -- time in milliseconds
    category VARCHAR(100) NOT NULL,
    description TEXT,
    domain VARCHAR(255), -- for browser tabs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timestamps table for detailed session tracking
CREATE TABLE IF NOT EXISTS timestamps (
    id SERIAL PRIMARY KEY,
    app_usage_id INTEGER NOT NULL REFERENCES app_usage(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL, -- duration in milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Insert default categories
INSERT INTO categories (name, type) VALUES 
    ('Code', 'productive'),
    ('Browsing', 'neutral'),
    ('Communication', 'neutral'),
    ('Utilities', 'neutral'),
    ('Entertainment', 'distracted'),
    ('Miscellaneous', 'neutral')
ON CONFLICT (name) DO NOTHING;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_usage_updated_at 
    BEFORE UPDATE ON app_usage 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_category_mappings_updated_at 
    BEFORE UPDATE ON custom_category_mappings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();