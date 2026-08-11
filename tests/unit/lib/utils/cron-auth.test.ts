import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCron } from "@/lib/utils/cron-auth";

afterEach(() => vi.unstubAllEnvs());

const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` });

describe("isAuthorizedCron", () => {
  it("accepts the configured secret in the Authorization header", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t-value");
    expect(isAuthorizedCron(bearer("s3cr3t-value"))).toBe(true);
    expect(isAuthorizedCron(new Headers({ authorization: "bearer s3cr3t-value" }))).toBe(true);
  });

  it("rejects a wrong secret, a missing header and a bare token", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t-value");
    expect(isAuthorizedCron(bearer("wrong"))).toBe(false);
    expect(isAuthorizedCron(new Headers())).toBe(false);
    expect(isAuthorizedCron(new Headers({ authorization: "s3cr3t-value" }))).toBe(false);
  });

  it("rejects everything when CRON_SECRET is unset, rather than letting all callers in", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isAuthorizedCron(bearer("anything"))).toBe(false);
    expect(isAuthorizedCron(new Headers())).toBe(false);
  });

  it("handles a token of a different length without throwing", () => {
    // timingSafeEqual throws on mismatched lengths, which would turn a wrong
    // guess into a 500 and leak the secret's length. Both sides are hashed to
    // 32 bytes first, so length differences are just a mismatch.
    vi.stubEnv("CRON_SECRET", "short");
    expect(() => isAuthorizedCron(bearer("a-considerably-longer-guess"))).not.toThrow();
    expect(isAuthorizedCron(bearer("a-considerably-longer-guess"))).toBe(false);
  });

  it("ignores a secret passed as a query string — the header is the only channel", () => {
    // The routes used to accept ?secret=, which wrote the value into Vercel's
    // requestPath/queryString log columns for the whole retention window.
    vi.stubEnv("CRON_SECRET", "s3cr3t-value");
    expect(isAuthorizedCron(new Headers({ "x-secret": "s3cr3t-value" }))).toBe(false);
  });
});
