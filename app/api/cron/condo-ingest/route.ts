import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listIngestTargets } from "@/lib/condo/repo";
import { ingestProject } from "@/lib/condo/ingest/pipeline";
import { createUraSource } from "@/lib/condo/ingest/ura";
import { createOneMapSource } from "@/lib/condo/ingest/onemap";
import { defaultRegionalBaseline } from "@/lib/condo/ingest/sources";
import { isAuthorizedCron } from "@/lib/utils/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Nightly condo ingestion (SPEC §6 / TD §6). Guarded by CRON_SECRET.
 * Re-ingests every active/stub project with the real URA/OneMap adapters,
 * recomputes scores, and promotes stubs once data is ready.
 *
 * Vercel Cron invokes this via GET with `Authorization: Bearer $CRON_SECRET`;
 * a manual run POSTs with the same header. Both share `runIngest`. The secret is
 * never accepted as a query parameter — that would log it (lib/utils/cron-auth.ts).
 */
export async function GET(req: NextRequest) {
  return runIngest(req);
}

export async function POST(req: NextRequest) {
  return runIngest(req);
}

async function runIngest(req: NextRequest) {
  if (!isAuthorizedCron(req.headers)) {
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
