# Database Migrations

This directory contains SQL migrations for the auth service database.

## Migration 001: Add JTI to Refresh Tokens

**File:** `001_add_jti_to_refresh_tokens.sql`

**Purpose:** Add replay attack protection to refresh tokens

**Changes:**
- Adds `jti` (JWT ID) column to `refresh_tokens` table
- Populates existing rows with random UUID values
- Creates unique index on `jti` for active tokens only (WHERE revoked_at IS NULL)

**Run this migration on existing databases:**
```bash
psql -d auth -f migrations/001_add_jti_to_refresh_tokens.sql
```

**Note:** For new installations, use `create_tables.sql` which already includes the `jti` column.
