// Edge Function: basket-scan-match
// SRS §3.5, 04-API-SPEC.md §2.3
// Fetches all formulations, brand names, AND salt names, fuzzy-matches client-side
// FIX: Added auth check - only authenticated users can call this

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getAuthUser, err, corsHeaders, publicErrorMessage } from "../_shared/auth.ts";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

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

    const { ocr_extracted_lines } = await req.json();

    if (!ocr_extracted_lines || !Array.isArray(ocr_extracted_lines) || ocr_extracted_lines.length === 0) {
      return new Response(JSON.stringify({ error: { code: "VALIDATION", message: "At least one OCR line required" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // CPU amplification cap: matching cost is O(lines × targets × Levenshtein)
    const lines: string[] = ocr_extracted_lines
      .slice(0, 40)
      .map((l: unknown) => String(l ?? "").slice(0, 100))
      .filter((l: string) => l.length > 0);
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: { code: "VALIDATION", message: "At least one OCR line required" } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Three parallel queries: formulations, brands, and salts with their combination mappings
    const [formulationsResult, brandsResult, saltsResult] = await Promise.all([
      supabase.from("formulation_combinations").select("id, display_composition"),
      supabase.from("company_brands").select("id, brand_name, combination_id"),
      supabase.from("combination_salt_bridge")
        .select("combination_id, chemical_salts!inner(id, salt_name)"),
    ]);

    if (formulationsResult.error) throw formulationsResult.error;
    if (brandsResult.error) throw brandsResult.error;
    if (saltsResult.error) throw saltsResult.error;

    // Build matching targets: compositions + brand names + salt names → combination_id
    type MatchTarget = { text: string; combinationId: string };
    const targets: MatchTarget[] = [];

    for (const f of formulationsResult.data || []) {
      targets.push({ text: f.display_composition, combinationId: f.id });
    }
    for (const b of brandsResult.data || []) {
      targets.push({ text: b.brand_name, combinationId: b.combination_id });
    }
    for (const s of saltsResult.data || []) {
      const saltName = (s as any).chemical_salts?.salt_name;
      if (saltName) {
        targets.push({ text: saltName, combinationId: s.combination_id });
      }
    }

    // Fuzzy match each OCR line against all targets
    const matches = [];

    for (const line of lines) {
      const cleanLine = line.trim().toLowerCase();
      if (!cleanLine) {
        matches.push({ input_line: line, candidate_combination_id: null, confidence: 0 });
        continue;
      }

      let bestCombinationId: string | null = null;
      let bestScore = 0;

      for (const target of targets) {
        const targetText = target.text.toLowerCase();

        // Bidirectional contains check
        const containsScore = (cleanLine.includes(targetText) || targetText.includes(cleanLine)) ? 0.8 : 0;
        const levScore = stringSimilarity(cleanLine, targetText);
        const ocrWords = cleanLine.split(/\s+/);
        const targetWords = targetText.split(/\s+/);
        const overlap = ocrWords.filter((w) => targetWords.some((tw) => tw.includes(w) || w.includes(tw))).length;
        const wordScore = ocrWords.length > 0 ? (overlap / ocrWords.length) * 0.9 : 0;

        const score = Math.max(containsScore, levScore, wordScore);

        if (score > bestScore) {
          bestScore = score;
          bestCombinationId = target.combinationId;
        }
      }

      matches.push({
        input_line: line,
        candidate_combination_id: bestScore > 0.3 ? bestCombinationId : null,
        confidence: Math.round(Math.min(bestScore, 1.0) * 100) / 100,
      });
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: publicErrorMessage(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
