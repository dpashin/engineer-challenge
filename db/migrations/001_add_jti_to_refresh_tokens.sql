-- Migration: Add jti column to refresh_tokens table
-- Run this on existing databases

-- Add jti column
ALTER TABLE refresh_tokens 
ADD COLUMN jti VARCHAR(255);

-- Populate existing rows with random jti values
UPDATE refresh_tokens 
SET jti = gen_random_uuid()::text
WHERE jti IS NULL;

-- Add NOT NULL constraint
ALTER TABLE refresh_tokens 
ALTER COLUMN jti SET NOT NULL;

-- Add check constraint
ALTER TABLE refresh_tokens 
ADD CONSTRAINT refresh_tokens_jti_not_empty CHECK (jti <> '');

-- Create unique index for replay attack prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_jti 
ON refresh_tokens (jti) 
WHERE revoked_at IS NULL;
