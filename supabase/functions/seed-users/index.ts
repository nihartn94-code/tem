// Edge Function: seed-users
// Creates test users for all 4 roles with real Supabase Auth accounts
// and corresponding public.users + compliance_profiles rows
// IMPORTANT: This is a one-time setup function for E2E testing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publicErrorMessage } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Only allow the seeded admin or service role to call this.
    // HARD GATE: a PRESENT but invalid/expired header must NEVER bypass the
    // admin check (previously a garbage token skipped both the role check and
    // the bootstrap guard — unauthenticated seeding forever).
    const authHeader = req.headers.get("Authorization");
    let callerIsAdmin = false;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
      if (getUserError || !user) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase.from("users").select("role").eq("auth_user_id", user.id).single();
      if (!profile || profile.role !== "ADMIN") {
        return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Admin only" } }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerIsAdmin = true;
    }

    // Bootstrap guard: once an ADMIN exists, unauthenticated seeding is closed
    if (!authHeader) {
      const { data: existingAdmin } = await supabase
        .from("users").select("id").eq("role", "ADMIN").limit(1).maybeSingle();
      if (existingAdmin) {
        return new Response(JSON.stringify({
          error: { code: "FORBIDDEN", message: "Seed already initialized — admin authentication required" }
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const results = [];

    const testUsers = [
      {
        email: "admin@pharmaos.io",
        password: "Admin123!",
        phone: "+919000000001",
        display_name: "Platform Admin",
        role: "ADMIN",
      },
      {
        email: "mfg@pharmaos.io",
        password: "MfgPass123!",
        phone: "+919000000002",
        display_name: "Test Pharma Manufacturing",
        role: "MANUFACTURER",
        compliance: {
          legal_entity_name: "Test Pharma Mfg Pvt Ltd",
          gstin: "29AAPFT0939F1ZV",
          drug_license_number: "DL-MFG-001",
          drug_license_expiry: "2027-12-31",
          who_gmp_certified: true,
          facility_lat: 19.0760,
          facility_lng: 72.8777,
          verification_status: "verified",
        },
      },
      {
        email: "company@pharmaos.io",
        password: "Company123!",
        phone: "+919000000003",
        display_name: "Test Pharma Company",
        role: "PHARMA_COMPANY",
        compliance: {
          legal_entity_name: "Test Pharma Co Pvt Ltd",
          gstin: "29AABCT0939F1ZV",
          drug_license_number: "DL-COMP-001",
          drug_license_expiry: "2027-12-31",
          who_gmp_certified: false,
          facility_lat: 28.6139,
          facility_lng: 77.2090,
          verification_status: "verified",
        },
      },
      {
        email: "stockist@pharmaos.io",
        password: "Stock123!",
        phone: "+919000000004",
        display_name: "Test Medical Store",
        role: "STOCKIST",
        compliance: {
          legal_entity_name: "Test Medical Store",
          gstin: "29AAHMS0939F1ZV",
          drug_license_number: "DL-STOCK-001",
          drug_license_expiry: "2027-12-31",
          who_gmp_certified: false,
          facility_lat: 13.0827,
          facility_lng: 80.2707,
          verification_status: "verified",
        },
      },
    ];

    for (const tu of testUsers) {
      try {
        // Check if auth user already exists by trying to sign in
        const { data: existingUser } = await supabase.auth.signInWithPassword({
          email: tu.email,
          password: tu.password,
        });

        if (existingUser?.user) {
          results.push({ email: tu.email, status: "already_exists", auth_id: existingUser.user.id });
          continue;
        }
      } catch {
        // User doesn't exist, proceed to create
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: tu.email,
        password: tu.password,
        email_confirm: true,
      });

      if (authError) {
        results.push({ email: tu.email, status: "auth_error", error: authError.message });
        continue;
      }

      const authUserId = authData.user.id;

      // Check if public.users row already exists
      const { data: existingProfile } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .single();

      if (existingProfile) {
        results.push({ email: tu.email, status: "user_exists", user_id: existingProfile.id });
        continue;
      }

      // Create public.users row
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          auth_user_id: authUserId,
          role: tu.role,
          phone_number: tu.phone,
          display_name: tu.display_name,
          preferred_language: "en",
          is_active: true,
        })
        .select()
        .single();

      if (userError) {
        results.push({ email: tu.email, status: "user_insert_error", error: userError.message });
        continue;
      }

      // Create compliance profile if provided
      if (tu.compliance) {
        const { error: compError } = await supabase
          .from("compliance_profiles")
          .insert({
            user_id: newUser.id,
            legal_entity_name: tu.compliance.legal_entity_name,
            gstin: tu.compliance.gstin,
            drug_license_number: tu.compliance.drug_license_number,
            drug_license_expiry: tu.compliance.drug_license_expiry,
            who_gmp_certified: tu.compliance.who_gmp_certified,
            facility_lat: tu.compliance.facility_lat,
            facility_lng: tu.compliance.facility_lng,
            verification_status: tu.compliance.verification_status,
          });

        if (compError) {
          results.push({ email: tu.email, status: "compliance_error", error: compError.message, user_id: newUser.id });
          continue;
        }
      }

      results.push({
        email: tu.email,
        status: "created",
        user_id: newUser.id,
        auth_id: authUserId,
        role: tu.role,
      });
    }

    // Demo market data: 016's inserts no-op on fresh environments because
    // migrations run before any user exists. This idempotent SQL function
    // closes that gap on every seed run (migration 020).
    const { data: seeded, error: seedError } = await supabase.rpc("seed_demo_market_data", {});
    if (seedError) {
      results.push({ status: "market_data_error", error: seedError.message });
    } else {
      results.push({ status: "market_data_seeded", ...((Array.isArray(seeded) ? seeded[0] : seeded) ?? {}) });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
