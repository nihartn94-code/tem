// Edge Function: checkout-basket
// Master doc §6.2, §12, §25 — Stockist checkout
// Trust boundary: every price/fee/discount re-derived server-side.
// Processing order per §12: (1) idempotency check, (2) geo-fence,
// (3) re-validate live price/stock per listing, (4) copy fee/discount
// onto the order row at creation, (5) one order per distinct seller,
// (6) atomic stock decrement, (7) audit_log.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getAuthUser, err, corsHeaders, publicErrorMessage } from "../_shared/auth.ts";

const VALID_CHANNELS = new Set(["ESCROW_INSTANT", "NBFC_CREDIT_LINE", "STANDARD_CREDIT_TERMS", "MANUAL_CONFIRMATION"]);

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function perSellerKeys(listings: { company_id: string }[]): Set<string> {
  return new Set(listings.map((l) => l.company_id));
}

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
    if (!profile || profile.role !== "STOCKIST") return err("FORBIDDEN", "Only stockists can checkout", 403);

    const body = await req.json();
    const { items, payment_channel, delivery_lat, delivery_lng } = body;
    const idempotencyKey: string | undefined = body.idempotency_key;

    // ---- Input validation ----
    if (!Array.isArray(items) || items.length === 0) {
      return err("VALIDATION", "items must be a non-empty array", 400, "items");
    }
    for (const item of items) {
      if (!item.marketplace_listing_id || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return err("VALIDATION", "Each item needs marketplace_listing_id and a positive integer quantity", 400, "items");
      }
    }
    if (!VALID_CHANNELS.has(payment_channel)) {
      return err("VALIDATION", "Invalid payment_channel", 400, "payment_channel");
    }
    if (
      typeof delivery_lat !== "number" || !Number.isFinite(delivery_lat) ||
      typeof delivery_lng !== "number" || !Number.isFinite(delivery_lng) ||
      delivery_lat < -90 || delivery_lat > 90 || delivery_lng < -180 || delivery_lng > 180
    ) {
      return err("VALIDATION", "Valid delivery coordinates are required", 400, "delivery_lat");
    }

    // ---- (1) Idempotency: a retried checkout returns the original orders ----
    // Keys are namespaced per seller (chk_<key>:<sellerId>) so one basket
    // spanning multiple sellers never collides on the unique index.
    // NOTE: exact-match check runs in step (5b) once sellerIds are known —
    // a prefix LIKE here could replay a different basket's orders.

    // ---- (2) Geo-fence: mandatory (master doc §7 / TC-04) ----
    const { data: compliance } = await supabase
      .from("compliance_profiles")
      .select("facility_lat, facility_lng")
      .eq("user_id", profile.id)
      .single();

    if (!compliance) {
      return err("COMPLIANCE_REQUIRED", "No verified compliance profile — delivery location cannot be validated", 403);
    }
    const distance = haversineKm(delivery_lat, delivery_lng, compliance.facility_lat, compliance.facility_lng);
    if (distance > 50) {
      return err("DELIVERY_MISMATCH", "Delivery location too far from verified facility", 400, "delivery_lat");
    }

    // ---- (3)+(4)+(5): re-validate, group by seller ----
    const listingIds = items.map((i) => i.marketplace_listing_id);
    const { data: listings, error: listingsError } = await supabase
      .from("stockist_marketplace")
      .select("id, company_id, wholesale_price_per_unit, available_stock_units, batch_number, expiry_date, company_brands!inner(brand_name)")
      .in("id", listingIds);

    if (listingsError || !listings || new Set(listings.map((l) => l.id)).size !== new Set(listingIds).size) {
      return err("NOT_FOUND", "One or more listings not found", 404);
    }

    const byId = new Map(listings.map((l) => [l.id, l]));
    const qtyByListing = new Map<string, number>();
    for (const item of items) {
      qtyByListing.set(item.marketplace_listing_id, (qtyByListing.get(item.marketplace_listing_id) ?? 0) + item.quantity);
    }

    // Server-side price/stock re-validation against live DB values
    for (const [listingId, qty] of qtyByListing) {
      const listing = byId.get(listingId)!;
      if (listing.available_stock_units <= 0) {
        return err("OUT_OF_STOCK", `${listing.company_brands?.brand_name ?? "Item"} is out of stock`, 400);
      }
      if (listing.expiry_date && new Date(listing.expiry_date) <= new Date()) {
        return err("EXPIRED_BATCH", `${listing.company_brands?.brand_name ?? "Item"} is past its expiry date and cannot be ordered`, 400);
      }
      if (listing.available_stock_units < qty) {
        return err(
          "INSUFFICIENT_STOCK",
          `Only ${listing.available_stock_units} units available for ${listing.company_brands?.brand_name ?? "item"}, requested ${qty}`,
          400
        );
      }
    }

    // §7 zero-day ghosting: service role bypasses RLS, so the trust
    // boundary re-checks seller compliance itself. An expired-license
    // seller's stock can never be bought even if a client cached a listing id.
    const sellerIds = Array.from(perSellerKeys(listings));
    const { data: compliantSellers } = await supabase
      .from("active_compliant_users")
      .select("user_id")
      .in("user_id", sellerIds);
    const compliantSet = new Set((compliantSellers ?? []).map((s) => s.user_id));
    for (const sellerId of sellerIds) {
      if (!compliantSet.has(sellerId)) {
        return err("SELLER_NOT_COMPLIANT", "This seller's license is no longer valid — order cannot be placed", 409);
      }
    }

    // ---- (5b) Idempotency replay: exact per-seller keys, checked after seller
    // resolution. A retried checkout returns the original orders.
    if (idempotencyKey) {
      const keys = sellerIds.map((s) => `${idempotencyKey}:${s}`);
      const { data: existing } = await supabase
        .from("orders")
        .select("id, idempotency_key, net_seller_payout, gross_invoice_value")
        .eq("buyer_id", profile.id)
        .in("idempotency_key", keys);
      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({
            orders: existing.map((o) => ({
              order_id: o.id,
              escrow_provider_ref: `manual_${o.id}`,
              net_seller_payout: o.net_seller_payout,
              gross_invoice_value: o.gross_invoice_value,
            })),
            idempotent_replay: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Governed settings — no silent fallbacks (§6.4 fee immutability)
    const { data: settings } = await supabase.from("platform_settings").select("*").eq("id", 1).single();
    if (!settings) return err("SERVER_ERROR", "Platform settings missing", 500);
    const feePct = Number(settings.global_fee_pct);
    const discountPct = payment_channel === "ESCROW_INSTANT" ? Number(settings.cash_velocity_discount_default_pct) : 0;

    // ---- One order per distinct seller ----
    // Money math in integer paise: float rounding made gross − fee − discount
    // drift from net_seller_payout by a paisa; NUMERIC(14,2) then rounds each
    // value independently. Derive all amounts from one paise figure.
    const toPaise = (x: number) => Math.round(x * 100);
    const perSeller = new Map<string, { listingIds: string[]; grossPaise: number }>();
    for (const [listingId, qty] of qtyByListing) {
      const listing = byId.get(listingId)!;
      const grossPaise = toPaise(Number(listing.wholesale_price_per_unit)) * qty;
      const entry = perSeller.get(listing.company_id) ?? { listingIds: [], grossPaise: 0 };
      entry.listingIds.push(listingId);
      entry.grossPaise += grossPaise;
      perSeller.set(listing.company_id, entry);
    }

    const orders: Array<{ _decremented?: Array<{ listingId: string; qty: number }>; order_id: string; escrow_provider_ref: string; net_seller_payout: number; gross_invoice_value: number }> = [];
    for (const [sellerId, { listingIds: sellerListingIds, grossPaise }] of perSeller) {
      const feePaise = Math.round((grossPaise * feePct) / 100);
      const netPayoutPaise = Math.round((grossPaise - feePaise) * (1 - discountPct / 100));
      const gross = grossPaise / 100;
      const feeValue = feePaise / 100;
      const discountedPayout = netPayoutPaise / 100;

      // Primary listing for FK + declared batch (order granularity is per seller)
      const primaryListing = byId.get(sellerListingIds[0])!;
      const totalQty = sellerListingIds.reduce((sum, id) => sum + qtyByListing.get(id)!, 0);

      // ---- (6) Atomic stock decrement per listing BEFORE order insert ----
      const decremented: string[] = [];
      for (const listingId of sellerListingIds) {
        const { data: decrementSuccess, error: decrementError } = await supabase.rpc("decrement_stock", {
          listing_id: listingId,
          qty: qtyByListing.get(listingId)!,
        });
        if (decrementError || !decrementSuccess) {
          // Compensate EVERYTHING decremented so far — across ALL sellers —
          // or a mid-basket failure silently burns reserved stock forever.
          for (const done of orders.map((o) => o._decremented).flat()) {
            await supabase.rpc("increment_stock", { listing_id: done.listingId, qty: done.qty });
          }
          for (const listingId of decremented) {
            await supabase.rpc("increment_stock", { listing_id: listingId, qty: qtyByListing.get(listingId)! });
          }
          return err("STOCK_DECREMENT_FAILED", "Failed to reserve stock. Another checkout may have taken it.", 409);
        }
        decremented.push(listingId);
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          layer: "COMPANY_TO_STOCKIST",
          buyer_id: profile.id,
          seller_id: sellerId,
          marketplace_listing_id: primaryListing.id,
          quantity: totalQty,
          gross_invoice_value: gross,
          platform_fee_pct: feePct,
          platform_fee_value: feeValue,
          cash_velocity_discount_pct: discountPct,
          net_seller_payout: discountedPayout,
          payment_channel,
          declared_batch_number: primaryListing.batch_number,
          delivery_lat,
          delivery_lng,
          state: "DELIVERED_PENDING_SCAN",
          idempotency_key: idempotencyKey ? `${idempotencyKey}:${sellerId}` : null,
        })
        .select()
        .single();

      if (orderError) {
        // Compensate: restore the stock we reserved for this seller
        for (const listingId of sellerListingIds) {
          await supabase.rpc("increment_stock", { listing_id: listingId, qty: qtyByListing.get(listingId)! });
        }
        // Unique violation on idempotency_key = concurrent duplicate checkout
        if ((orderError as { code?: string }).code === "23505") {
          // Concurrent duplicate: restore this seller's reserved stock before returning
          for (const listingId of decremented) {
            await supabase.rpc("increment_stock", { listing_id: listingId, qty: qtyByListing.get(listingId)! });
          }
          return err("DUPLICATE_CHECKOUT", "This checkout was already processed", 409);
        }
        // Any other insert failure: restore this seller's reserved stock
        for (const listingId of decremented) {
          await supabase.rpc("increment_stock", { listing_id: listingId, qty: qtyByListing.get(listingId)! });
        }
        throw orderError;
      }

      const { error: auditError } = await supabase.from("audit_log").insert({
        actor_id: profile.id,
        action: "ORDER_CREATED",
        entity_type: "orders",
        entity_id: order.id,
        metadata: {
          gross_value: gross,
          fee: feeValue,
          discount: discountPct,
          listings: sellerListingIds,
          payment_channel,
        },
      });
      if (auditError) throw auditError;

      orders.push({
        _decremented: decremented.map((listingId) => ({ listingId, qty: qtyByListing.get(listingId)! })),
        order_id: order.id,
        escrow_provider_ref: `manual_${order.id}`,
        net_seller_payout: order.net_seller_payout,
        gross_invoice_value: order.gross_invoice_value,
      });
    }

    return new Response(JSON.stringify({ orders: orders.map(({ _decremented, ...o }) => o) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: publicErrorMessage(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
