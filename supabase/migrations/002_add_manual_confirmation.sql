-- Migration: Add MANUAL_CONFIRMATION payment channel for UPI manual mode
-- FINAL_MASTER_PROMPT.md §2: No Razorpay, no paid gateway. UPI manual confirmation only.

-- Add MANUAL_CONFIRMATION to payment_channel enum
DO $$ BEGIN
  ALTER TYPE payment_channel ADD VALUE IF NOT EXISTS 'MANUAL_CONFIRMATION';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
