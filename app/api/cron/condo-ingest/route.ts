import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listIngestTargets } from "@/lib/condo/repo";
import { ingestProject } from "@/lib/condo/ingest/pipeline";
import { createUraSource } from "@/lib/condo/ingest/ura";
import { createOneMapSource } from "@/lib/condo/ingest/onemap";
import { defaultRegionalBaseline } from "@/lib/condo/ingest/sources";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Nightly condo ingestion (SPEC §6 / TD §6). Guarded by CRON_SECRET.
 * Re-ingests every active/stub project with the real URA/OneMap adapters,
 * recomputes scores, and promotes stubs once data is ready.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "invalid cron secret" } },
      { status: 401 }
    );
  }

  const db = getSupabaseServiceRoleClient();
  const sources = {
    ura: createUraSource(),
    oneMap: createOneMapSource(),
    regionalBaseline: defaultRegionalBaseline,
  };

  const targets = await listIngestTargets(db);
  const results: { slug: string; promoted?: boolean; error?: string }[] = [];

  for (const t of targets) {
    try {
      const res = await ingestProject(db, t, sources);
      results.push({ slug: t.name, promoted: res.promoted });
    } catch (err) {
      // One project's external-source failure must not abort the whole run.
      results.push({ slug: t.name, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  const ok = results.filter((r) => r.error === undefined).length;
  return NextResponse.json({ ok: true, data: { total: targets.length, succeeded: ok, results } });
}
