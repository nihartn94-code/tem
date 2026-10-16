// Edge Function: pool-dispatch
// Master doc §6.1 — Manufacturer dispatches a locked production pool.
// Creates ONE MFG_TO_COMPANY order per contribution (buyer = contributing
// Company, seller = Manufacturer, pool_contribution_id set per the
// valid_layer_refs CHECK). Orders enter DELIVERED_PENDING_SCAN and flow
// through the same batch-verification gate as layer-2 orders.
//
// Trust boundary (§10): quantities, unit costs and batch numbers are
// re-derived from production_pool_contributions / catalog — the client
// supplies only the pool id. Idempotent: unique index on
// orders(pool_contribution_id) (migration 014) + pre-check per contribution.

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

    const { data: profile } = await supabase
      .from("users").select("id, role").eq("auth_user_id", user.id).single();
    if (!profile) return err("UNAUTHORIZED", "Unknown user", 401);

    const { pool_id } = await req.json();
    if (!pool_id) return err("VALIDATION", "pool_id required", 400, "pool_id");

    // Batch reference is SERVER-ASSIGNED (§3.7 gate integrity): the batch-verify
    // flow compares device scans against this value — a client-invented ref
    // would let the gate be preconditioned before dispatch.
    const declared_batch_number = `PB-${pool_id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Role gate: the pool's Manufacturer dispatches (Admin may on their behalf)
    const { data: pool } = await supabase
      .from("production_pools")
      .select("*, catalog:manufacturer_catalog(id, manufacturer_id, factory_gate_unit_cost)")
      .eq("id", pool_id)
      .single();

    if (!pool) return err("NOT_FOUND", "Pool not found", 404);
    if (pool.status !== "locked" && pool.status !== "in_production") {
      return err("INVALID_STATE", `Pool is '${pool.status}' — only locked pools can be dispatched`, 400);
    }

    const isOwner = profile.role === "MANUFACTURER" && pool.catalog.manufacturer_id === profile.id;
    const isAdmin = profile.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return err("FORBIDDEN", "Only the pool's manufacturer or an admin can dispatch", 403);
    }

    // All contributions for this pool (server-derived: qty, cost, buyer)
    const { data: contributions, error: contribError } = await supabase
      .from("production_pool_contributions")
      .select("id, company_id, requested_quantity, agreed_unit_cost")
      .eq("pool_id", pool_id);
    if (contribError) throw contribError;
    if (!contributions || contributions.length === 0) {
      return err("VALIDATION", "Pool has no contributions", 400);
    }

    // Governed settings — copied at creation (§6.4)
    const { data: settings } = await supabase
      .from("platform_settings").select("*").eq("id", 1).single();
    if (!settings) return err("SERVER_ERROR", "Platform settings missing", 500);
    const feePct = Number(settings.global_fee_pct);

    const now = new Date().toISOString();
    const created = [];
    const skipped = [];

    for (const c of contributions) {
      // Idempotency pre-check (unique index is the hard guarantee)
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("pool_contribution_id", c.id)
        .maybeSingle();
      if (existing) {
        skipped.push({ contribution_id: c.id, order_id: existing.id, reason: "ALREADY_DISPATCHED" });
        continue;
      }

      const gross = Number(c.agreed_unit_cost) * c.requested_quantity;
      const feeValue = gross * (feePct / 100);
      const netPayout = gross - feeValue;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          layer: "MFG_TO_COMPANY",
          buyer_id: c.company_id,
          seller_id: pool.catalog.manufacturer_id,
          pool_contribution_id: c.id,
          quantity: c.requested_quantity,
          gross_invoice_value: gross,
          platform_fee_pct: feePct,
          platform_fee_value: feeValue,
          cash_velocity_discount_pct: 0,
          net_seller_payout: netPayout,
          payment_channel: "MANUAL_CONFIRMATION",
          declared_batch_number,
          delivery_lat: null,
          delivery_lng: null,
          state: "DELIVERED_PENDING_SCAN",
        })
        .select()
        .single();

      if (orderError) {
        // 23505 on pool_contribution_id = concurrent dispatch — treat as skipped
        if ((orderError as { code?: string }).code === "23505") {
          skipped.push({ contribution_id: c.id, reason: "ALREADY_DISPATCHED" });
          continue;
        }
        throw orderError;
      }

      const { error: auditError } = await supabase.from("audit_log").insert({
        actor_id: profile.id,
        action: "POOL_DISPATCHED",
        entity_type: "orders",
        entity_id: order.id,
        metadata: {
          pool_id,
          contribution_id: c.id,
          gross,
          fee_pct: feePct,
          declared_batch_number,
        },
      });
      if (auditError) throw auditError;

      created.push({ order_id: order.id, company_id: c.company_id });
    }

    // Pool → in_production once dispatch succeeds for at least one contribution
    if (created.length > 0 && pool.status === "locked") {
      const { error: poolUpdateError } = await supabase
        .from("production_pools")
        .update({ status: "in_production" })
        .eq("id", pool_id)
        .eq("status", "locked");
      if (poolUpdateError) throw poolUpdateError;

      const { error: lockAuditError } = await supabase.from("audit_log").insert({
        actor_id: profile.id,
        action: "POOL_IN_PRODUCTION",
        entity_type: "production_pools",
        entity_id: pool_id,
        metadata: { orders_created: created.length },
      });
      if (lockAuditError) throw lockAuditError;
    }

    return new Response(
      JSON.stringify({
        created,
        skipped,
        pool_status: created.length > 0 && pool.status === "locked" ? "in_production" : pool.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: publicErrorMessage(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
