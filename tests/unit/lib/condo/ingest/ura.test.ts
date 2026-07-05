/**
 * URA adapter — parsing/mapping correctness (no live API). The pure mappers are
 * tested directly; the source is tested against a mocked global fetch.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  parseContractDate,
  mapUraTransaction,
  indexUraResults,
  resolveUraEndpoints,
  createUraSource,
} from "@/lib/condo/ingest/ura";

describe("resolveUraEndpoints", () => {
  it("defaults to eservice v1 endpoints", () => {
    const endpoints = resolveUraEndpoints({});
    expect(endpoints.tokenUrl).toContain("eservice.ura.gov.sg");
    expect(endpoints.tokenUrl).toContain("insertNewToken/v1");
    expect(endpoints.dsUrl).toContain("invokeUraDS/v1");
  });

  it("supports legacy .action endpoints", () => {
    const endpoints = resolveUraEndpoints({ URA_ENDPOINT_MODE: "legacy" });
    expect(endpoints.tokenUrl).toBe("https://www.ura.gov.sg/uraDataService/insertNewToken.action");
    expect(endpoints.dsUrl).toBe("https://www.ura.gov.sg/uraDataService/invokeUraDS.action");
  });

  it("allows explicit endpoint overrides", () => {
    const endpoints = resolveUraEndpoints({
      URA_ENDPOINT_MODE: "legacy",
      URA_TOKEN_URL: "https://example.test/token",
      URA_DS_URL: "https://example.test/data",
    });
    expect(endpoints).toEqual({
      tokenUrl: "https://example.test/token",
      dsUrl: "https://example.test/data",
    });
  });
});

describe("parseContractDate", () => {
  it("MMYY → ISO first-of-month", () => {
    expect(parseContractDate("0524")).toBe("2024-05-01");
    expect(parseContractDate("1223")).toBe("2023-12-01");
  });
  it("rejects malformed / out-of-range", () => {
    expect(parseContractDate("2024-05")).toBeNull();
    expect(parseContractDate("1324")).toBeNull(); // month 13
    expect(parseContractDate(undefined)).toBeNull();
  });
});

describe("mapUraTransaction", () => {
  it("converts sqm→sqft, computes psf, remaps saleType (URA 3 resale → internal 2)", () => {
    const t = mapUraTransaction({
      contractDate: "0125",
      price: "2000000",
      area: "100", // sqm
      typeOfSale: "3", // URA resale
    })!;
    expect(t.txnDate).toBe("2025-01-01");
    expect(t.areaSqft).toBeCloseTo(1076.39, 1);
    expect(t.psf).toBeCloseTo(2000000 / (100 * 10.7639104), 1);
    expect(t.saleType).toBe(2); // internal "resale"
    expect(t.bedroomType).toBeNull();
  });

  it("remaps URA new-sale=1→1 and sub-sale=2→3", () => {
    expect(
      mapUraTransaction({ contractDate: "0125", price: "1", area: "10", typeOfSale: "1" })!.saleType
    ).toBe(1);
    expect(
      mapUraTransaction({ contractDate: "0125", price: "1", area: "10", typeOfSale: "2" })!.saleType
    ).toBe(3);
  });

  it("returns null on bad area/price/date", () => {
    expect(mapUraTransaction({ contractDate: "0125", price: "x", area: "10" })).toBeNull();
    expect(mapUraTransaction({ contractDate: "0125", price: "1", area: "0" })).toBeNull();
    expect(mapUraTransaction({ contractDate: "bad", price: "1", area: "10" })).toBeNull();
  });
});

describe("indexUraResults", () => {
  it("indexes by normalized project name and drops empty/unusable", () => {
    const idx = indexUraResults([
      {
        project: "The Gazania",
        transaction: [
          { contractDate: "0125", price: "2000000", area: "100", typeOfSale: "3" },
          { contractDate: "bad", price: "x", area: "0" }, // dropped
        ],
      },
      { project: "No Txns", transaction: [] }, // skipped
    ]);
    expect([...idx.keys()]).toEqual(["the gazania"]);
    expect(idx.get("the gazania")).toHaveLength(1);
  });
});

describe("createUraSource (mocked fetch)", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    process.env.URA_API_KEY = "test-key";
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.URA_API_KEY;
    vi.restoreAllMocks();
  });

  it("fetches a token once, all 4 batches, and serves per-project lookups from cache", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("insertNewToken")) {
        return { ok: true, json: async () => ({ Status: "Success", Result: "tok" }) } as Response;
      }
      // A project lives in exactly one batch island-wide; only batch 1 here.
      const Result = url.includes("batch=1")
        ? [
            {
              project: "The Gazania",
              transaction: [
                { contractDate: "0125", price: "2000000", area: "100", typeOfSale: "3" },
              ],
            },
          ]
        : [];
      return { ok: true, json: async () => ({ Status: "Success", Result }) } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const src = createUraSource();
    const a = await src.fetchTransactions({ name: "the gazania" }); // normalized match
    const b = await src.fetchTransactions({ name: "Unknown Condo" });

    expect(a).toHaveLength(1);
    expect(a[0]!.saleType).toBe(2);
    expect(b).toEqual([]);
    // 1 token + 4 batches, fetched once total (second lookup hits the cache)
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("throws when URA_API_KEY is missing", async () => {
    delete process.env.URA_API_KEY;
    await expect(createUraSource().fetchTransactions({ name: "x" })).rejects.toThrow(/URA_API_KEY/);
  });
});
