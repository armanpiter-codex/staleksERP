-- PostgreSQL initialization script
-- Runs once when the container is first created (before Alembic migrations)

-- Enable extensions needed by the app
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- For gen_random_uuid()

-- Note: Tables are created by Alembic migrations, not here.
-- This file only handles PostgreSQL-level setup.
