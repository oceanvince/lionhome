/**
 * URA adapter — real Private Residential Property Transactions source.
 *
 * Register + docs: https://eservice.ura.gov.sg/maps/api/. URA Data Service flow:
 *   1. GET insertNewToken/v1 with header `AccessKey` → a 24h Token.
 *   2. GET invokeUraDS/v1?service=PMI_Resi_Transaction&batch=1..4 with
 *      headers `AccessKey` + `Token` (+ a non-empty User-Agent, else 403).
 *      Each batch covers the whole island; one call returns every project's
 *      transactions, so we fetch all four ONCE per run, index by project name,
 *      and serve per-project lookups from the cache.
 *
 * Env:
 * - URA_API_KEY: registered AccessKey.
 * - URA_ENDPOINT_MODE: "v1" (default) or "legacy" (.action endpoints).
 * - URA_TOKEN_URL / URA_DS_URL: optional explicit endpoint overrides.
 *
 * Without URA_API_KEY, fetchTransactions throws, so the pipeline's .catch leaves
 * the project as-is rather than wiping data. TxnLite carries no coordinates, so
 * URA's SVY21 x/y is ignored.
 */

import type { TxnLite } from "@/lib/project-scoring";
import type { UraSource, ProjectRef } from "./sources";

const ENDPOINTS = {
  v1: {
    tokenUrl: "https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1",
    dsUrl: "https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1",
  },
  legacy: {
    tokenUrl: "https://www.ura.gov.sg/uraDataService/insertNewToken.action",
    dsUrl: "https://www.ura.gov.sg/uraDataService/invokeUraDS.action",
  },
} as const;
const SERVICE = "PMI_Resi_Transaction";
const BATCHES = [1, 2, 3, 4]; // island-wide coverage
const USER_AGENT = "lionhome-condo-ingest/1.0";
const SQM_TO_SQFT = 10.7639104;

/**
 * URA typeOfSale → internal TxnLite.saleType convention.
 * URA: 1 New Sale · 2 Sub Sale · 3 Resale.
 * Internal: 1 new · 2 resale · 3 sub-sale (profit scoring treats 2 as resale).
 */
const SALE_TYPE_MAP: Record<string, number> = { "1": 1, "2": 3, "3": 2 };

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UraEndpoints {
  tokenUrl: string;
  dsUrl: string;
}

export function resolveUraEndpoints(
  env: Partial<Record<string, string | undefined>> = process.env
): UraEndpoints {
  const mode = env.URA_ENDPOINT_MODE === "legacy" ? "legacy" : "v1";
  const base = ENDPOINTS[mode];
  return {
    tokenUrl: env.URA_TOKEN_URL || base.tokenUrl,
    dsUrl: env.URA_DS_URL || base.dsUrl,
  };
}

/** Normalize a project name for matching (case/space-insensitive). */
function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** URA contractDate "MMYY" → ISO "20YY-MM-01" (null if malformed). */
export function parseContractDate(mmyy: string | undefined): string | null {
  if (!mmyy || !/^\d{4}$/.test(mmyy)) return null;
  const mm = mmyy.slice(0, 2);
  const yy = mmyy.slice(2);
  if (Number(mm) < 1 || Number(mm) > 12) return null;
  return `20${yy}-${mm}-01`;
}

/** Map one URA transaction record → TxnLite (null if unusable). */
export function mapUraTransaction(t: any): TxnLite | null {
  const txnDate = parseContractDate(t?.contractDate);
  const price = Number(t?.price);
  const areaSqm = Number(t?.area);
  if (!txnDate || !Number.isFinite(price) || !Number.isFinite(areaSqm) || areaSqm <= 0) {
    return null;
  }
  const areaSqft = areaSqm * SQM_TO_SQFT;
  return {
    txnDate,
    price,
    areaSqft: Number(areaSqft.toFixed(2)),
    psf: Number((price / areaSqft).toFixed(2)),
    bedroomType: null, // URA's transaction feed carries no bedroom count
    saleType: SALE_TYPE_MAP[String(t?.typeOfSale)] ?? null,
  };
}

/** Build name→TxnLite[] index from URA's batched Result payloads. */
export function indexUraResults(results: any[]): Map<string, TxnLite[]> {
  const index = new Map<string, TxnLite[]>();
  for (const proj of results ?? []) {
    const name = proj?.project;
    if (!name) continue;
    const key = norm(name);
    const txns = (proj.transaction ?? [])
      .map(mapUraTransaction)
      .filter((x: TxnLite | null): x is TxnLite => x !== null);
    if (txns.length === 0) continue;
    const existing = index.get(key);
    if (existing) existing.push(...txns);
    else index.set(key, txns);
  }
  return index;
}

async function fetchToken(accessKey: string, endpoints: UraEndpoints): Promise<string> {
  const res = await fetch(endpoints.tokenUrl, {
    headers: { AccessKey: accessKey, "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`URA token HTTP ${res.status}`);
  const json: any = await res.json();
  if (json?.Status !== "Success" || !json?.Result) {
    throw new Error(`URA token error: ${json?.Message ?? "no token"}`);
  }
  return json.Result as string;
}

async function fetchBatch(
  accessKey: string,
  token: string,
  batch: number,
  endpoints: UraEndpoints
): Promise<any[]> {
  const url = `${endpoints.dsUrl}?service=${SERVICE}&batch=${batch}`;
  const res = await fetch(url, {
    headers: { AccessKey: accessKey, Token: token, "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`URA batch ${batch} HTTP ${res.status}`);
  const json: any = await res.json();
  if (json?.Status && json.Status !== "Success") {
    throw new Error(`URA batch ${batch} error: ${json?.Message ?? "unknown"}`);
  }
  return (json?.Result as any[]) ?? [];
}

export function createUraSource(): UraSource {
  let indexPromise: Promise<Map<string, TxnLite[]>> | null = null;

  /** Token + all four batches, fetched once and cached for the run. */
  async function loadIndex(): Promise<Map<string, TxnLite[]>> {
    const accessKey = process.env.URA_API_KEY ?? process.env.URA_ACCESS_KEY;
    if (!accessKey) throw new Error("URA_API_KEY not set — cannot ingest URA transactions");
    const endpoints = resolveUraEndpoints();
    const token = await fetchToken(accessKey, endpoints);
    const batches = await Promise.all(
      BATCHES.map((b) => fetchBatch(accessKey, token, b, endpoints))
    );
    return indexUraResults(batches.flat());
  }

  return {
    async fetchTransactions(project: ProjectRef): Promise<TxnLite[]> {
      // Cache the success, never the failure. A rejected promise left in place
      // makes every remaining project in the same cron run await the same
      // error, so a single URA 500 turned into an empty transaction list for
      // the whole catalogue. Clearing it lets the next project retry.
      if (!indexPromise) {
        indexPromise = loadIndex().catch((err) => {
          indexPromise = null;
          throw err;
        });
      }
      const index = await indexPromise;
      return index.get(norm(project.name)) ?? [];
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
