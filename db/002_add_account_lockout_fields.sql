-- Migration: Add account lockout fields to users table
-- Description: Adds support for account lockout after failed login attempts
-- Date: 2026-03-10

-- Add locked_until column for temporary account lockouts
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add updated_at column for tracking record updates
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index on locked_until for efficient lockout checks
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);

-- Add comment for documentation
COMMENT ON COLUMN users.locked_until IS 'Temporary lockout timestamp after too many failed login attempts';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp of the user record';
