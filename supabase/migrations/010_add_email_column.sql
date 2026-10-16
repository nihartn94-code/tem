-- Migration 002: Add email support to users table
-- This allows email-based authentication alongside phone OTP

-- Make phone_number nullable (email users won't have a phone)
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;

-- Add email column
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Add unique index on email (partial - only for non-null emails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Update RLS policy to allow email-based lookups
-- (The existing policy already works with auth.uid())
