// Edge Function: admin
// 04-API-SPEC.md §2.6 — Resolve dispute (Admin only)
// 04-API-SPEC.md §2.7 — Update platform settings (Admin only)

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
    if (!auth.ok || !auth.userId) {
      return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: auth.userId };

    // Verify caller is Admin
    const { data: profile } = await supabase.from("users").select("*").eq("auth_user_id", user.id).single();
    if (!profile || profile.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Admin only" } }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Route to the appropriate sub-handler
    // The caller sends action in the body: "resolve-dispute" or "update-settings"
    const action = body.action as string;

    if (!action) {
      return new Response(JSON.stringify({ error: { code: "MISSING_ACTION", message: "Request body must include 'action' field: 'resolve-dispute' or 'update-settings'" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resolve-dispute") {
      return await handleResolveDispute(supabase, profile, body, corsHeaders);
    } else if (action === "update-settings") {
      return await handleUpdateSettings(supabase, profile, body, corsHeaders);
    } else {
      return new Response(JSON.stringify({ error: { code: "INVALID_ACTION", message: `Unknown action '${action}'. Must be 'resolve-dispute' or 'update-settings'` } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// §2.6 — Resolve Dispute
// ============================================================
async function handleResolveDispute(
  supabase: any,
  profile: any,
  body: any,
  corsHeaders: Record<string, string>
) {
  const { dispute_ticket_id, resolution } = body;

  if (!dispute_ticket_id || !resolution) {
    return new Response(JSON.stringify({
      error: { code: "VALIDATION", message: "dispute_ticket_id and resolution required" }
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (resolution !== "RELEASED_TO_SELLER" && resolution !== "REFUNDED_TO_BUYER") {
    return new Response(JSON.stringify({
      error: { code: "VALIDATION", message: "resolution must be RELEASED_TO_SELLER or REFUNDED_TO_BUYER" }
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Get the dispute ticket
  const { data: dispute } = await supabase
    .from("dispute_tickets")
    .select("*, order:orders(*)")
    .eq("id", dispute_ticket_id)
    .single();

  if (!dispute) {
    return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Dispute not found" } }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (dispute.resolution !== "PENDING") {
    return new Response(JSON.stringify({ error: { code: "ALREADY_RESOLVED", message: "Dispute already resolved" } }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Conditional updates: only succeed if the dispute is still PENDING
  // (concurrent resolution guard, §25). Both writes are error-checked —
  // a partial failure must not silently leave inconsistent state (§24).
  const now = new Date().toISOString();
  const orderState = resolution === "RELEASED_TO_SELLER" ? "SETTLED" : "REFUNDED";

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

  const { data: updatedOrder, error: orderUpdateError } = await supabase
    .from("orders")
    .update({
      state: orderState,
      settled_at: orderState === "SETTLED" ? now : null,
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
    action: resolution === "RELEASED_TO_SELLER" ? "DISPUTE_RESOLVED_SELLER" : "DISPUTE_RESOLVED_BUYER",
    entity_type: "dispute_tickets",
    entity_id: dispute_ticket_id,
    metadata: {
      resolution,
      order_id: dispute.order_id,
      order_state: orderState,
    },
  });
  if (auditError) throw auditError;

  return new Response(JSON.stringify({ success: true, order_state: orderState }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// §2.7 — Update Platform Settings
// ============================================================
async function handleUpdateSettings(
  supabase: any,
  profile: any,
  body: any,
  corsHeaders: Record<string, string>
) {
  const allowedFields = [
    "global_fee_pct",
    "cash_velocity_discount_default_pct",
    "cash_velocity_discount_min_pct",
    "cash_velocity_discount_max_pct",
    "dispute_auto_flag_threshold",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({
      error: { code: "VALIDATION", message: "No valid settings to update" }
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Numeric range validation (§24) — negative/absurd values rejected
  const numFields: Record<string, [number, number]> = {
    global_fee_pct: [0, 100],
    cash_velocity_discount_default_pct: [0, 100],
    cash_velocity_discount_min_pct: [0, 100],
    cash_velocity_discount_max_pct: [0, 100],
    dispute_auto_flag_threshold: [1, 1000],
  };
  for (const [field, [min, max]] of Object.entries(numFields)) {
    if (field in updates) {
      const v = Number(updates[field]);
      if (!Number.isFinite(v) || v < min || v > max) {
        return new Response(JSON.stringify({
          error: { code: "VALIDATION", message: `${field} must be between ${min} and ${max}`, field }
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      updates[field] = v;
    }
  }
  if (
    "cash_velocity_discount_min_pct" in updates &&
    "cash_velocity_discount_max_pct" in updates &&
    Number(updates.cash_velocity_discount_min_pct) > Number(updates.cash_velocity_discount_max_pct)
  ) {
    return new Response(JSON.stringify({
      error: { code: "VALIDATION", message: "cash_velocity_discount_min_pct cannot exceed cash_velocity_discount_max_pct", field: "cash_velocity_discount_min_pct" }
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Get current settings for history
  const { data: current } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .single();

  // Update settings
  updates.updated_by = profile.id;
  updates.updated_at = new Date().toISOString();

  const { error: settingsError } = await supabase
    .from("platform_settings")
    .update(updates)
    .eq("id", 1);

  if (settingsError) throw settingsError;

  // Write history for each changed field (error-checked — §24)
  for (const [field, newValue] of Object.entries(updates)) {
    if (field === "updated_by" || field === "updated_at") continue;
    const oldValue = current?.[field];
    if (String(oldValue) !== String(newValue)) {
      const { error: historyError } = await supabase.from("platform_settings_history").insert({
        setting_name: field,
        old_value: String(oldValue),
        new_value: String(newValue),
        changed_by: profile.id,
        effective_at: new Date().toISOString(),
      });
      if (historyError) throw historyError;
    }
  }

  // Audit log — entity_id is uuid; the previous "1" was a guaranteed insert failure
  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: "SETTINGS_UPDATED",
    entity_type: "platform_settings",
    entity_id: "00000000-0000-0000-0000-000000000001",
    metadata: { changed_fields: Object.keys(updates).filter(k => k !== "updated_by" && k !== "updated_at") },
  });

  // Return updated settings
  const { data: updated } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .single();

  return new Response(JSON.stringify(updated), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
