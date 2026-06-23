/**
 * Load the currently-effective tax rates, with a seed fallback.
 * DI: caller passes the supabase client. Mirrors the calculator route's
 * inline fetch, extracted so /condo/fit can reuse it.
 */

import type { ServerClient } from "@/lib/supabase/server";
import { SEED_TAX_RATES } from "./seed";
import type { TaxRatesConfig } from "./types";

export async function loadActiveTaxRates(
  db: ServerClient
): Promise<{ rates: TaxRatesConfig; version: string }> {
  try {
    const { data, error } = await db
      .from("tax_rates")
      .select("effective_from, bsd_slabs, absd_matrix, ltv_rules, tdsr, msr")
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      const rates = data as unknown as TaxRatesConfig;
      return { rates, version: `db-${rates.effective_from}` };
    }
  } catch {
    // fall through to seed
  }
  return { rates: SEED_TAX_RATES, version: `seed-${SEED_TAX_RATES.effective_from}` };
}
