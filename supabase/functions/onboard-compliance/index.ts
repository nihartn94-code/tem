// Edge Function: onboard-compliance
// SRS §3.1 — Compliance onboarding for non-Admin accounts
// Handles both insert (new) and update (existing) to prevent duplicate profiles

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

    const { data: profile } = await supabase.from("users").select("*").eq("auth_user_id", user.id).single();
    if (!profile || profile.role === "ADMIN") {
      return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Admin cannot onboard" } }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { legal_entity_name, gstin, drug_license_number, drug_license_expiry, who_gmp_certified, facility_lat, facility_lng, license_doc_storage_path, gmp_cert_storage_path } = body;

    // Validate GSTIN format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstin)) {
      return new Response(JSON.stringify({ error: { code: "VALIDATION", message: "Invalid GSTIN format", field: "gstin" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!drug_license_number || typeof drug_license_number !== "string" || drug_license_number.trim().length < 4) {
      return new Response(JSON.stringify({ error: { code: "VALIDATION", message: "Drug license number is required", field: "drug_license_number" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof facility_lat !== "number" || !Number.isFinite(facility_lat) ||
        typeof facility_lng !== "number" || !Number.isFinite(facility_lng)) {
      return new Response(JSON.stringify({ error: { code: "VALIDATION", message: "Valid facility coordinates are required", field: "facility_lat" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(drug_license_expiry) <= new Date()) {
      return new Response(JSON.stringify({ error: { code: "VALIDATION", message: "License expiry must be in the future", field: "drug_license_expiry" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIX #3: Check for existing compliance profile — update if exists, insert if not
    const { data: existing } = await supabase
      .from("compliance_profiles")
      .select("id")
      .eq("user_id", profile.id)
      .single();

    let data;
    if (existing) {
      // Update existing profile (re-submit after renewal, etc.)
      const { data: updated, error: updateError } = await supabase
        .from("compliance_profiles")
        .update({
          legal_entity_name,
          gstin,
          drug_license_number,
          drug_license_expiry,
          who_gmp_certified: who_gmp_certified || false,
          facility_lat,
          facility_lng,
          license_doc_storage_path,
          gmp_cert_storage_path: gmp_cert_storage_path || null,
          verification_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      data = updated;
    } else {
      // Insert new profile
      const { data: inserted, error: insertError } = await supabase
        .from("compliance_profiles")
        .insert({
          user_id: profile.id,
          legal_entity_name,
          gstin,
          drug_license_number,
          drug_license_expiry,
          who_gmp_certified: who_gmp_certified || false,
          facility_lat,
          facility_lng,
          license_doc_storage_path,
          gmp_cert_storage_path: gmp_cert_storage_path || null,
          verification_status: "pending",
        })
        .select()
        .single();
      if (insertError) throw insertError;
      data = inserted;
    }

    // Audit log
    await supabase.from("audit_log").insert({
      actor_id: profile.id,
      action: existing ? "COMPLIANCE_UPDATED" : "COMPLIANCE_SUBMITTED",
      entity_type: "compliance_profiles",
      entity_id: data.id,
      metadata: { gstin, drug_license_number, is_update: !!existing },
    });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
