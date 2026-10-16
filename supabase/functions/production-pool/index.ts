// Edge Function: production-pool
// Master doc §6.1, §12 §2.8, TC-07 — Company contributes to a production pool.
// All mutation logic lives in the contribute_to_pool SQL function (migration 011):
// ONE atomic operation — find-or-create pool, contribution, increment, threshold lock.
// Edge Function only: auth, role gate, input validation, audit_log.

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

    const { data: profile } = await supabase.from("users").select("*").eq("auth_user_id", user.id).single();
    if (!profile || profile.role !== "PHARMA_COMPANY") {
      return err("FORBIDDEN", "Only companies can contribute to pools", 403);
    }

    const { manufacturer_catalog_id, requested_quantity, intended_brand_name, packaging_spec, agreed_unit_cost } = await req.json();

    if (!manufacturer_catalog_id || !intended_brand_name) {
      return err("VALIDATION", "manufacturer_catalog_id and intended_brand_name are required", 400);
    }
    if (!Number.isInteger(requested_quantity) || requested_quantity <= 0) {
      return err("VALIDATION", "requested_quantity must be a positive integer", 400, "requested_quantity");
    }
    if (agreed_unit_cost !== undefined && agreed_unit_cost !== null &&
        (typeof agreed_unit_cost !== "number" || agreed_unit_cost <= 0)) {
      return err("VALIDATION", "agreed_unit_cost must be a positive number", 400, "agreed_unit_cost");
    }

    // Catalog must exist and be active — validated server-side (§10)
    const { data: catalog } = await supabase
      .from("manufacturer_catalog")
      .select("id, factory_gate_unit_cost")
      .eq("id", manufacturer_catalog_id)
      .eq("is_active", true)
      .single();
    if (!catalog) return err("NOT_FOUND", "Manufacturer catalog entry not found or inactive", 404);

    // Unit cost: never trust the client — re-derive from catalog (§10 trust boundary)
    const unitCost = catalog.factory_gate_unit_cost;

    // ONE atomic SQL operation (migration 011/018). contribution_key makes
    // retried requests idempotent — no double contribution, no double increment.
    const { data: result, error: rpcError } = await supabase.rpc("contribute_to_pool", {
      p_catalog_id: manufacturer_catalog_id,
      p_company_id: profile.id,
      p_requested_quantity: requested_quantity,
      p_brand_name: intended_brand_name,
      p_packaging: packaging_spec ?? null,
      p_unit_cost: unitCost,
      p_contribution_key: (req.headers.get("idempotency-key") || `${profile.id}:${manufacturer_catalog_id}:${requested_quantity}:${intended_brand_name}`),
    });

    if (rpcError) {
      const msg = rpcError.message || "";
      if (msg.includes("INVALID_QUANTITY")) return err("VALIDATION", "requested_quantity must be positive", 400);
      if (msg.includes("CATALOG_NOT_FOUND")) return err("NOT_FOUND", "Catalog entry not found", 404);
      throw rpcError;
    }

    const pool = Array.isArray(result) ? result[0] : result;

    const { error: auditError } = await supabase.from("audit_log").insert({
      actor_id: profile.id,
      action: "POOL_CONTRIBUTION",
      entity_type: "production_pool_contributions",
      entity_id: pool.pool_id,
      metadata: {
        requested_quantity,
        intended_brand_name,
        agreed_unit_cost: unitCost,
        pool_status: pool.pool_status,
        just_locked: pool.just_locked,
      },
    });
    if (auditError) throw auditError;

    if (pool.just_locked) {
      const { error: lockAuditError } = await supabase.from("audit_log").insert({
        actor_id: profile.id,
        action: "POOL_LOCKED",
        entity_type: "production_pools",
        entity_id: pool.pool_id,
        metadata: {
          accumulated: pool.acc_qty,
          target: pool.target_qty,
          manufacturer_catalog_id,
        },
      });
      if (lockAuditError) throw lockAuditError;
    }

    return new Response(
      JSON.stringify({
        pool_id: pool.pool_id,
        pool_status: pool.pool_status,
        accumulated_quantity: pool.acc_qty,
        target_quantity: pool.target_qty,
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
