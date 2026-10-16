// Edge Function: confirm-batch-delivery
// Master doc §6.2/§6.3, §12 §2.5 — batch-OCR delivery gate.
// MATCH → SETTLED (+settled_at), MISMATCH → DISPUTED + dispute ticket.
// Concurrency: state transition is conditional on the current state
// (WHERE state = 'DELIVERED_PENDING_SCAN') — a second concurrent confirm
// mutates zero rows and is rejected as INVALID_STATE (§25).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getAuthUser, err, corsHeaders, publicErrorMessage } from "../_shared/auth.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    // Local ES256 JWT verify (JWKS-cached) — no auth network round-trip (perf)
    const auth = await getAuthUser(req, Deno.env.get("SUPABASE_URL") ?? "");
    if (!auth.ok || !auth.userId) return err("UNAUTHORIZED", "Invalid token", 401);
    const user = { id: auth.userId };

    const { order_id, scanned_batch_number } = await req.json();

    if (!order_id || !scanned_batch_number || typeof scanned_batch_number !== "string") {
      return err("VALIDATION", "order_id and scanned_batch_number required", 400);
    }

    // Caller must be the buyer — checked before any mutation
    const { data: profile } = await supabase
      .from("users").select("id").eq("auth_user_id", user.id).single();
    if (!profile) return err("UNAUTHORIZED", "Invalid user", 401);

    const { data: order } = await supabase
      .from("orders").select("*").eq("id", order_id).single();

    if (!order) return err("NOT_FOUND", "Order not found", 404);

    if (profile.id !== order.buyer_id) {
      return err("FORBIDDEN", "Only buyer can confirm delivery", 403);
    }

    if (order.state !== "DELIVERED_PENDING_SCAN") {
      return err(
        "INVALID_STATE",
        `Order is in state '${order.state}', only 'DELIVERED_PENDING_SCAN' orders can be confirmed`,
        400
      );
    }

    // Compare batch numbers (§3.7) — declared vs scanned
    const batchMatch = order.declared_batch_number === scanned_batch_number;
    const now = new Date().toISOString();

    if (batchMatch) {
      // Conditional update: only succeeds if still DELIVERED_PENDING_SCAN
      const { data: updated, error: updateError } = await supabase
        .from("orders")
        .update({ scanned_batch_number, state: "SETTLED", settled_at: now })
        .eq("id", order_id)
        .eq("state", "DELIVERED_PENDING_SCAN")
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) {
        return err("INVALID_STATE", "Order was concurrently confirmed", 409);
      }

      const { error: auditError } = await supabase.from("audit_log").insert({
        actor_id: profile.id,
        action: "BATCH_CONFIRMED",
        entity_type: "orders",
        entity_id: order_id,
        metadata: { declared: order.declared_batch_number, scanned: scanned_batch_number },
      });
      if (auditError) throw auditError;

      return new Response(JSON.stringify({ state: "SETTLED", dispute_ticket_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Mismatch — freeze payout, open dispute
      const { data: updated, error: updateError } = await supabase
        .from("orders")
        .update({ scanned_batch_number, state: "DISPUTED" })
        .eq("id", order_id)
        .eq("state", "DELIVERED_PENDING_SCAN")
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) {
        return err("INVALID_STATE", "Order was concurrently confirmed", 409);
      }

      const { data: dispute, error: disputeError } = await supabase
        .from("dispute_tickets")
        .insert({
          order_id,
          raised_by: profile.id,
          reason: "BATCH_MISMATCH",
          evidence_storage_paths: [],
        })
        .select()
        .single();
      if (disputeError) throw disputeError;

      await supabase.from("audit_log").insert({
        actor_id: profile.id,
        action: "BATCH_MISMATCH_DISPUTE",
        entity_type: "orders",
        entity_id: order_id,
        metadata: { declared: order.declared_batch_number, scanned: scanned_batch_number, dispute_id: dispute.id },
      });

      return new Response(JSON.stringify({ state: "DISPUTED", dispute_ticket_id: dispute.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: publicErrorMessage(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
