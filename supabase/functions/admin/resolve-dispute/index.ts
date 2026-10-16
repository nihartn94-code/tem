// Edge Function: admin/resolve-dispute
// SRS §3.8 — Admin one-click dispute resolution
// Input: { dispute_ticket_id: uuid, resolution: "RELEASED_TO_SELLER" | "REFUNDED_TO_BUYER" }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getAuthUser, err, corsHeaders } from "../_shared/auth.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    // Local ES256 JWT verify (JWKS-cached) — no auth network round-trip (perf)
    const auth = await getAuthUser(req, Deno.env.get("SUPABASE_URL") ?? "");
    if (!auth.ok || !auth.userId) {
      return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: auth.userId };

    // Verify caller is Admin
    const { data: profile } = await supabase
      .from("users").select("id, role").eq("auth_user_id", user.id).single();

    if (!profile || profile.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Admin only" } }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dispute_ticket_id, resolution } = await req.json();

    // Get dispute ticket
    const { data: dispute } = await supabase
      .from("dispute_tickets").select("*, order:orders(*)").eq("id", dispute_ticket_id).single();

    if (!dispute) {
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Dispute not found" } }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dispute.resolution !== "PENDING") {
      return new Response(JSON.stringify({ error: { code: "ALREADY_RESOLVED", message: "Dispute already resolved" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resolution !== "RELEASED_TO_SELLER" && resolution !== "REFUNDED_TO_BUYER") {
      return new Response(JSON.stringify({
        error: { code: "VALIDATION", message: "resolution must be RELEASED_TO_SELLER or REFUNDED_TO_BUYER", field: "resolution" }
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Conditional updates (§25): only succeed if still PENDING; both error-checked
    const now = new Date().toISOString();
    const { data: updatedTicket, error: ticketError } = await supabase
      .from("dispute_tickets")
      .update({
        resolution,
        resolved_by: profile.id,
        resolved_at: now,
      })
      .eq("id", dispute_ticket_id)
      .eq("resolution", "PENDING")
      .select("id")
      .maybeSingle();

    if (ticketError) throw ticketError;
    if (!updatedTicket) {
      return new Response(JSON.stringify({ error: { code: "ALREADY_RESOLVED", message: "Dispute already resolved" } }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order state — guarded: only an order still in DISPUTED may transition.
    // Prevents force-SETTLING an order that was never batch-verified, or flipping REFUNDED back.
    const newOrderState = resolution === "RELEASED_TO_SELLER" ? "SETTLED" : "REFUNDED";
    const { data: updatedOrder, error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        state: newOrderState,
        settled_at: newOrderState === "SETTLED" ? now : null,
      })
      .eq("id", dispute.order_id)
      .eq("state", "DISPUTED")
      .select("id")
      .maybeSingle();

    if (orderUpdateError) throw orderUpdateError;
    if (!updatedOrder) {
      return new Response(JSON.stringify({
        error: { code: "INVALID_STATE", message: "Order is not in DISPUTED state — no transition performed" }
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Audit log
    const { error: auditError } = await supabase.from("audit_log").insert({
      actor_id: profile.id,
      action: `DISPUTE_RESOLVED_${resolution}`,
      entity_type: "dispute_tickets",
      entity_id: dispute_ticket_id,
      metadata: { order_id: dispute.order_id, resolution },
    });
    if (auditError) throw auditError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: { code: "SERVER_ERROR", message: err.message } }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
