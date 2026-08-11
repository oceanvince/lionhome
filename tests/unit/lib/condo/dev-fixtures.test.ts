import { afterEach, describe, expect, it, vi } from "vitest";
import { devFixturesEnabled } from "@/lib/condo/dev-fixtures";
import {
  getActiveProjectBySlug,
  getAmenities,
  getLatestScores,
  getRecentTransactions,
} from "@/lib/condo/repo";
import type { DbClient } from "@/lib/condo/repo";

afterEach(() => vi.unstubAllEnvs());

/** Passing this would mean the fixture branch was skipped and a query ran. */
const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error("fixtures enabled but the repo still went to the database");
    },
  }
) as DbClient;

describe("devFixturesEnabled", () => {
  it("is off in production even when the flag is set", () => {
    // The comment promised "never enabled in production" while only checking
    // the env var, so a stray CONDO_DEV_FIXTURES=1 in the Vercel project would
    // have served invented projects and scores to real visitors.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONDO_DEV_FIXTURES", "1");
    expect(devFixturesEnabled()).toBe(false);
  });

  it("is on outside production only when the flag is set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CONDO_DEV_FIXTURES", "1");
    expect(devFixturesEnabled()).toBe(true);

    vi.stubEnv("CONDO_DEV_FIXTURES", "0");
    expect(devFixturesEnabled()).toBe(false);
  });
});

describe("the detail path serves fixtures too", () => {
  // Only the search path consulted fixtures, so every result card linked to a
  // detail page that 404'd — the mode did not work for the flow it exists for.
  it("resolves a fixture slug without touching the database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CONDO_DEV_FIXTURES", "1");

    const project = await getActiveProjectBySlug(noDb, "the-gazania");
    expect(project?.name).toBe("The Gazania");

    const scores = await getLatestScores(noDb, project!.id);
    expect(scores.length).toBeGreaterThan(0);

    expect(await getAmenities(noDb, project!.id)).not.toHaveLength(0);
    expect(await getRecentTransactions(noDb, project!.id, 12)).not.toHaveLength(0);
  });

  it("still reports an unknown slug as missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CONDO_DEV_FIXTURES", "1");
    expect(await getActiveProjectBySlug(noDb, "no-such-condo")).toBeNull();
  });
});
