// Edge Function: admin/update-platform-settings
// SRS §3.9 — Admin no-code governance
// Input: partial platform_settings columns

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getAuthUser, err, corsHeaders, publicErrorMessage } from "../_shared/auth.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
      // Local ES256 JWT verify (JWKS-cached) — no auth network round-trip (perf)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Missing auth" } }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const auth = await getAuthUser(req, Deno.env.get("SUPABASE_URL") ?? "");
      if (!auth.ok || !auth.userId) {
        return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const user = { id: auth.userId };

    const { data: profile } = await supabase
      .from("users").select("id, role").eq("auth_user_id", user.id).single();

    if (!profile || profile.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Admin only" } }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const allowedFields = [
      "global_fee_pct", "cash_velocity_discount_default_pct",
      "cash_velocity_discount_min_pct", "cash_velocity_discount_max_pct",
      "dispute_auto_flag_threshold",
    ];

    // Get current settings for audit
    const { data: current } = await supabase
      .from("platform_settings").select("*").eq("id", 1).single();

    // Build update and history entries
    const updates: Record<string, any> = {};
    const historyEntries = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== current?.[field]) {
        updates[field] = body[field];
        historyEntries.push({
          setting_name: field,
          old_value: String(current?.[field]),
          new_value: String(body[field]),
          changed_by: profile.id,
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ message: "No changes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    updates.updated_by = profile.id;
    updates.updated_at = new Date().toISOString();

    // Update settings
    await supabase.from("platform_settings").update(updates).eq("id", 1);

    // Write history
    if (historyEntries.length > 0) {
      await supabase.from("platform_settings_history").insert(historyEntries);
    }

    // Audit log — entity_id is uuid; the previous "1" was a guaranteed insert failure
    await supabase.from("audit_log").insert({
      actor_id: profile.id,
      action: "PLATFORM_SETTINGS_UPDATED",
      entity_type: "platform_settings",
      entity_id: "00000000-0000-0000-0000-000000000001",
      metadata: { changes: updates },
    });

    const { data: updated } = await supabase
      .from("platform_settings").select("*").eq("id", 1).single();

    return new Response(JSON.stringify(updated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: { code: "SERVER_ERROR", message: err.message } }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
