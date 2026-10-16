// Edge Function: search-molecule
// Master doc §5 F3, §12 — role-scoped fuzzy search, cheapest-first.
// PERF (§23: <300ms target): two round-trips eliminated —
//   1. JWT verified locally via cached JWKS (no auth network call)
//   2. role-resolution + scoped search merged into ONE RPC
//      (search_molecule_scoped, migration 015)
// Identity stays anonymized pre-escrow (§7): no seller name/address/phone.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getAuthUser, err, corsHeaders, publicErrorMessage } from "../_shared/auth.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createServiceClient();

    const auth = await getAuthUser(req, projectUrl);
    if (!auth.ok || !auth.userId) return err("UNAUTHORIZED", "Invalid token", 401);

    const { query: rawQuery } = await req.json();
    // Length cap: search cost and payload size must not scale with adversarial input
    const query = typeof rawQuery === "string" ? rawQuery.slice(0, 80) : "";
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ combinations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ONE call: role resolution + role-scoped offers (marketplace and/or
    // manufacturer layer depending on caller role, compliance-joined)
    const { data: rows, error } = await supabase.rpc("search_molecule_scoped", {
      search_query: query,
      p_auth_uid: auth.userId,
    });
    if (error) throw error;

    const comboMap = new Map<string, {
      combination_id: string;
      display_composition: string;
      offers: any[];
    }>();

    for (const row of rows ?? []) {
      if (!comboMap.has(row.combination_id)) {
        comboMap.set(row.combination_id, {
          combination_id: row.combination_id,
          display_composition: row.display_composition,
          offers: [],
        });
      }
      const combo = comboMap.get(row.combination_id)!;
      if (row.offer_type === "MARKETPLACE") {
        combo.offers.push({
          offer_type: "MARKETPLACE",
          brand_id: row.brand_id,
          brand_name: row.brand_name || "Unknown",
          company_id: row.company_id,
          price_per_unit: Number(row.price_per_unit),
          available_stock: Number(row.available_stock),
          trade_scheme: row.trade_scheme,
        });
      } else {
        combo.offers.push({
          offer_type: "MANUFACTURER",
          brand_name: null, // anonymized pre-escrow (§7)
          company_id: null,
          minimum_order_qty: row.minimum_order_qty,
          price_per_unit: Number(row.price_per_unit),
          lead_time_days: row.lead_time_days,
        });
      }
    }

    const combinations = Array.from(comboMap.values())
      .filter((c) => c.offers.length > 0)
      .map((c) => ({
        ...c,
        offers: [...c.offers].sort((a, b) => a.price_per_unit - b.price_per_unit),
      }))
      .sort((a, b) => {
        const aMin = Math.min(...a.offers.map((o) => o.price_per_unit));
        const bMin = Math.min(...b.offers.map((o) => o.price_per_unit));
        return aMin - bMin;
      });

    return new Response(JSON.stringify({ combinations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
