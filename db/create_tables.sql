-- PostgreSQL 17 script for auth service tables
-- Run this against the 'auth' database

-- Connect to the 'auth' database (required when running from docker-entrypoint-initdb.d)
\c auth

-- Enable UUID extension for secure token generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table: stores user accounts with hashed passwords
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- Password policy tracking
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,

    -- Rate limiting: failed login attempts counter
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    last_failed_login_at TIMESTAMP WITH TIME ZONE,

    -- Lockout tracking for password reset abuse prevention
    reset_request_blocked_until TIMESTAMP WITH TIME ZONE,
    failed_reset_attempts INTEGER NOT NULL DEFAULT 0,
    last_failed_reset_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints for soft-delete pattern
    CONSTRAINT users_email_not_empty CHECK (email <> ''),
    CONSTRAINT users_password_hash_not_empty CHECK (password_hash <> '')
);

-- Index for email lookups during authentication
CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;

-- Index for active users
CREATE INDEX idx_users_active ON users (is_active) WHERE deleted_at IS NULL;

-- Password reset tokens table: stores password reset tokens with security requirements
-- Note: Table named password_reset_tokens to match application code
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint: token must have either expiration, usage, or invalidation
    CONSTRAINT password_reset_tokens_token_hash_not_empty CHECK (token_hash <> '')
);

-- Index for token lookup and cleanup
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id) WHERE used_at IS NULL AND revoked_at IS NULL;

-- ============================================
-- Refresh Tokens table (for session management)
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- Token hash (store hash, not raw token)
    token_hash VARCHAR(255) NOT NULL,

    -- JWT ID (unique token identifier for replay attack prevention)
    jti VARCHAR(255) NOT NULL,

    -- Session metadata
    ip_address INET,
    user_agent TEXT,

    -- Token lifecycle
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT refresh_tokens_token_hash_not_empty CHECK (token_hash <> ''),
    CONSTRAINT refresh_tokens_jti_not_empty CHECK (jti <> '')
);

-- Index for active refresh tokens
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);
CREATE UNIQUE INDEX idx_refresh_tokens_jti ON refresh_tokens (jti) WHERE revoked_at IS NULL;

-- ============================================
-- Grant permissions to auth user
-- ============================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auth;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO auth;
