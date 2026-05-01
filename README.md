# LionHome

A mobile-first decision-support platform for Mandarin-speaking property buyers in Singapore. See [`docs/PRD.md`](docs/PRD.md) for the full product spec.

> **Status:** scaffold only. Modules per PRD Sections 6–15 are not yet implemented.

---

## Stack

| Concern             | Choice                                                        |
| ------------------- | ------------------------------------------------------------- |
| Framework           | Next.js 15 (App Router) + React 19                            |
| Language            | TypeScript (strict, `noUncheckedIndexedAccess`)               |
| Styling             | Tailwind CSS v4 + shadcn/ui primitives                        |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage), region `ap-southeast-1` |
| Forms               | react-hook-form + zod                                         |
| State               | React Server Components by default; Zustand only where needed |
| i18n                | next-intl, default `zh-CN` (en scaffolded but disabled)       |
| Analytics           | PostHog (self-hosted-ready)                                   |
| Email               | Resend                                                        |
| WhatsApp            | Twilio                                                        |
| PDF                 | @react-pdf/renderer                                           |
| Tests               | Vitest (unit) · Playwright (e2e)                              |
| Lint / Format       | ESLint + Prettier (with Tailwind plugin)                      |
| Deployment          | Vercel                                                        |

---

## Onboarding (target: under 15 minutes)

### Prerequisites

- **Node.js 20+** (22.x recommended)
- **Docker Desktop** running (Supabase CLI uses it)
- **Supabase CLI** — already installed as a dev dependency; run via `npx supabase`

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in the values you have. For a fully offline local dev session you only need the two Supabase values produced by `npx supabase start` (Step 3).

### 3. Start a local Supabase stack

```bash
npx supabase start
```

This boots Postgres, Auth, Storage, and the Studio UI in Docker. Copy the printed `API URL` and `anon key` into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed value>
SUPABASE_SERVICE_ROLE_KEY=<printed value>
```

### 4. Apply migrations

```bash
npm run db:reset
```

`db:reset` drops, re-creates, and re-applies every migration in [`supabase/migrations/`](supabase/migrations/) (also linked at [`db/migrations`](db/migrations) per PRD §5). The seed in [`supabase/seed.sql`](supabase/seed.sql) runs automatically afterward.

To apply migrations to a remote project instead, run `npm run db:push`.

### 5. Generate typed Supabase client (optional)

```bash
npm run db:types
```

This regenerates [`lib/supabase/database.types.ts`](lib/supabase/database.types.ts).

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Common scripts

| Command                           | What it does                                       |
| --------------------------------- | -------------------------------------------------- |
| `npm run dev`                     | Start the Next dev server                          |
| `npm run build`                   | Production build                                   |
| `npm run start`                   | Run the production build locally                   |
| `npm run lint` / `lint:fix`       | ESLint                                             |
| `npm run typecheck`               | `tsc --noEmit`                                     |
| `npm run format` / `format:check` | Prettier                                           |
| `npm test`                        | Vitest unit tests (single run)                     |
| `npm run test:watch`              | Vitest watch mode                                  |
| `npm run test:e2e`                | Playwright e2e (boots `npm run dev` automatically) |
| `npm run db:start` / `db:stop`    | Boot / shut down local Supabase                    |
| `npm run db:reset`                | Drop, re-apply migrations, run seed                |
| `npm run db:push`                 | Apply migrations to a remote Supabase project      |
| `npm run db:diff`                 | Diff local schema against migrations               |
| `npm run db:types`                | Regenerate `database.types.ts`                     |

---

## Repository layout (PRD §5)

```
app/
  (marketing)/         # /, /articles, /legal/*
  (tools)/             # /calculator, /quiz, /compare
  (auth)/              # /login, /verify
  (user)/              # /profile, /result/[id], /report/[id], /advisor
  admin/               # Lead OS (separate auth context)
  agent/               # Agent Lite Portal (separate auth context)
  api/v1/              # Public API routes
  api/admin/v1/        # Admin API routes
components/
  ui/                  # shadcn primitives
  forms/
  layouts/
lib/
  supabase/            # client + server helpers; generated types
  tax/                 # BSD/ABSD/TDSR/LTV calc engine (pure functions)
  scoring/             # Lead scoring (pure functions)
  utils/
db/
  migrations -> ../supabase/migrations
  seed       -> ../supabase/seed.sql
docs/PRD.md
i18n/
  config.ts, request.ts, messages/{zh-CN,en}.json
tests/
  unit/
  e2e/
```

`db/` is a symlinked alias of `supabase/` so the layout matches the PRD while remaining compatible with the Supabase CLI's default paths.

---

## Migrations

- Migrations live in [`supabase/migrations/`](supabase/migrations/) (alias: [`db/migrations`](db/migrations)). Each file is timestamp-prefixed (`YYYYMMDDhhmmss_*.sql`).
- Add a new migration: `npx supabase migration new <slug>`.
- Apply locally: `npm run db:reset`.
- Apply remotely: `npm run db:push` (requires `npx supabase link --project-ref <ref>` first).
- Tax rates and other admin-configurable values live in dedicated tables (`tax_rates`, `config`). **Never hardcode** rates in the calc engine — they read from `tax_rates` (PRD §6.5).

---

## Compliance notes (PRD §18)

- All PII columns (phone, email, name, income figures) are flagged in migration `COMMENT`s. Application-level encryption (Supabase pgcrypto) is the next milestone.
- `consent_log` is append-only — UPDATE/DELETE are revoked at the table level. Withdrawal is recorded as a new row.
- RLS is enabled on every table. Default posture is deny; narrow allow policies are added in [`supabase/migrations/20260430000004_rls_policies.sql`](supabase/migrations/20260430000004_rls_policies.sql).

---

## Architectural conventions

- **Server Components by default.** Mark Client Components with `"use client"` only when interactivity demands it.
- **Every database query goes through a typed wrapper in [`lib/supabase/`](lib/supabase/).** Don't import `@supabase/supabase-js` directly in feature code.
- **No `any`. No `@ts-ignore`.** ESLint is configured to fail on both. Use `@ts-expect-error <reason>` if absolutely necessary.
- **Pure calc/scoring functions.** Anything in [`lib/tax/`](lib/tax/) and [`lib/scoring/`](lib/scoring/) must be deterministic and side-effect free — they're easy to test and easy to port.

---

## Tests

- Unit tests: [`tests/unit/`](tests/unit/) — Vitest with jsdom, runs via `npm test`.
- E2E tests: [`tests/e2e/`](tests/e2e/) — Playwright. First run: `npm run test:e2e:install` to fetch browsers.

Coverage targets per PRD §22: ≥ 70% on calc/scoring/routing.
