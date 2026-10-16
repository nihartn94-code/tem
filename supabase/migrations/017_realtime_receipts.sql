-- 017: Realtime receipts — orders + dispute_tickets in the realtime publication
-- Client (useRealtimeSync) subscribes to postgres_changes; RLS row-level filters
-- apply per subscriber session, so users only receive events for rows they can read.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispute_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dispute_tickets;
  END IF;
END
$$;

-- Replica identity: default is fine (PK), but be explicit so UPDATE/DELETE payloads
-- carry the primary key the client filters on.
ALTER TABLE orders REPLICA IDENTITY DEFAULT;
ALTER TABLE dispute_tickets REPLICA IDENTITY DEFAULT;
