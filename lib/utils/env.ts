import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  ONEMAP_API_KEY: z.string().optional(),
  ONEMAP_EMAIL: z.string().optional(),
  ONEMAP_PASSWORD: z.string().optional(),
  URA_API_KEY: z.string().optional(),
  // ura.ts reads URA_API_KEY ?? URA_ACCESS_KEY — both belong here, or a typo in
  // either just surfaces as an ingest that quietly fetches nothing.
  URA_ACCESS_KEY: z.string().optional(),
  // Guards the two cron routes. Unset means every cron invocation 401s, which
  // is the failure this schema exists to catch early.
  CRON_SECRET: z.string().min(1).optional(),
  // Dev-only fixture switch. "1" enables; see lib/condo/dev-fixtures.ts, which
  // additionally refuses to turn on when NODE_ENV is production.
  CONDO_DEV_FIXTURES: z.enum(["0", "1"]).optional(),
  CONDO_DEV_ACTIVE_COUNT: z.coerce.number().int().positive().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  // Calculator thresholds. A typo here silently changes what the tool tells
  // people they can afford, so they are declared rather than read raw.
  NEXT_PUBLIC_MIN_DOWN_PAYMENT: z.coerce.number().nonnegative().optional(),
  NEXT_PUBLIC_MIN_VIABLE_PRICE: z.coerce.number().nonnegative().optional(),
  NEXT_PUBLIC_MIN_VIABLE_PRICE_ENABLED: z.enum(["0", "1"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.format();
    throw new Error(`Invalid environment variables: ${JSON.stringify(formatted, null, 2)}`);
  }
  cached = parsed.data;
  return cached;
}
