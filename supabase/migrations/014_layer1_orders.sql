-- ============================================================
-- Migration 014: Layer-1 (MFG→Company) order flow
-- Master doc §6.1: pool locks → production → dispatch → delivery →
-- batch gate. Until now the locked pool dead-ended (no order creation
-- path for the manufacturer layer). The pool-dispatch Edge Function
-- creates one MFG_TO_COMPANY order per contribution; this migration
-- makes "one order per contribution" a database guarantee, and lets
-- the orders layer discriminator carry the manufacturer batch.
-- ============================================================

-- Exactly one layer-1 order per pool contribution — dispatch retries
-- are idempotent at the database level, matching orders.idempotency_key
-- semantics for the layer-2 checkout path.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pool_contribution
  ON orders(pool_contribution_id) WHERE pool_contribution_id IS NOT NULL;
