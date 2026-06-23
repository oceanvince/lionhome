/**
 * URA adapter — real Private Residential Property Transactions source.
 *
 * SKELETON: the HTTP calls are stubbed with clear TODOs. Wiring needed:
 *   1. Daily token: POST AccessKey → 24h Token (cache it).
 *   2. Pull transactions by batch (1–4, island-wide) or period (quarter).
 *   3. Coordinates are SVY21 → convert to WGS84 before storing.
 *   4. Filter island-wide results down to the target project (name/street match).
 *
 * Env: URA_ACCESS_KEY. Until configured, fetchTransactions throws so the
 * pipeline falls back / skips rather than silently returning empty.
 */

import type { TxnLite } from "@/lib/project-scoring";
import type { UraSource, ProjectRef } from "./sources";

const URA_TOKEN_URL = "https://www.ura.gov.sg/uraDataService/insertNewToken.action";
// const URA_TXN_URL = "https://www.ura.gov.sg/uraDataService/invokeUraDS.action";

async function getToken(accessKey: string): Promise<string> {
  // TODO: GET URA_TOKEN_URL with header `AccessKey: <accessKey>` → { Result: token }.
  void URA_TOKEN_URL;
  void accessKey;
  throw new Error("URA token fetch not implemented");
}

export function createUraSource(): UraSource {
  return {
    async fetchTransactions(project: ProjectRef): Promise<TxnLite[]> {
      const accessKey = process.env.URA_ACCESS_KEY;
      if (!accessKey) {
        throw new Error("URA_ACCESS_KEY not set — cannot ingest URA transactions");
      }
      await getToken(accessKey);
      // TODO: fetch batches with AccessKey + Token, map URA records → TxnLite:
      //   { txnDate: contractDate, price, areaSqft: area, psf, bedroomType, saleType: typeOfSale }
      // and filter to `project` by name/street. Convert SVY21 x/y → WGS84 upstream.
      void project;
      throw new Error("URA transaction fetch not implemented");
    },
  };
}
