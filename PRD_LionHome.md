# Product Requirements Document

## LionHome — Singapore Chinese-Speaking Property Decision Platform

| Field                | Value                                       |
| -------------------- | ------------------------------------------- |
| Document Version     | 1.0                                         |
| Status               | Ready for Development                       |
| Document Type        | Product Requirements Document (PRD)         |
| Audience             | Engineering, Design, QA, Product Operations |
| Release Target       | MVP in 6 weeks (Phase 1)                    |
| Working Product Name | LionHome (狮城家) — final naming TBD        |
| Source BRD           | LionHome BRD v1.0                           |

---

## Table of Contents

1. Executive Summary
2. Goals, Non-Goals & Success Metrics
3. Target Users & Personas
4. Core User Flows
5. Information Architecture
6. Module 1 — Property Affordability Calculator
7. Module 2 — Buyer Health Check (Quiz)
8. Module 3 — Personalized Result & Strategy Report
9. Module 4 — Deep Property Report (Semi-Automated)
10. Module 5 — Region & Listing Comparator
11. Module 6 — Content Decision Center
12. Module 7 — My Home Buying Profile
13. Module 8 — Advisor Booking & Lead Submission
14. Module 9 — Lead OS (Internal Back-Office)
15. Module 10 — Agent Lite Portal
16. Data Model
17. API Specifications
18. Compliance Requirements (PDPA, DNC, CEA)
19. Non-Functional Requirements
20. Analytics & Instrumentation
21. Phasing & Release Plan
22. Acceptance Criteria & Definition of Done
23. Open Questions
24. Appendix — Singapore Tax Calculation Reference

---

## 1. Executive Summary

### 1.1 What we're building

LionHome is a **mobile-first responsive web application** that helps Mandarin-speaking property buyers in Singapore make smarter purchasing decisions, while operating as a **high-quality lead generation and matching engine** for vetted property agents on the back end.

The product is **not** a listing portal, not a search-house competitor to PropertyGuru, and not a content site. It is a **decision support tool that converts ambiguous buying intent into qualified, attributable buyers**.

### 1.2 Why this exists

Singapore's private condo market sees ~20,000 transactions per year. The Chinese-speaking sub-segment (PRs, citizens, executives using Mandarin as primary language) is underserved digitally — existing portals are English-first and listing-centric, while WeChat/Xiaohongshu content lacks credible decision tools. Buyers face genuine information asymmetry: ABSD/BSD/TDSR/LTV rules are complex, identity status changes the math dramatically, and most buyers cannot self-calculate their realistic purchasing power.

Meanwhile, small-B agents (independent realtors, freelancers) have strong willingness to pay for qualified leads but receive low-quality contact dumps from existing channels.

LionHome bridges this gap with a content + tools front end and a vetted agent matching back end, monetized through a hybrid lead fee + commission share model.

### 1.3 Strategic positioning

- **To C-end users:** "Buy property in Singapore smarter, not more confused."
- **To B-end agents:** "Get real, time-bound, qualified buyers — not phone numbers."
- **To the platform itself:** A super-router node sitting between high-intent Chinese-speaking buyers and vetted agents, with full attribution.

### 1.4 Why mobile web (not native app)

The primary acquisition channel is Xiaohongshu (Little Red Book). Xiaohongshu links open in mobile browsers by default; redirecting users to App Store downloads collapses conversion to under 5%. Property purchase is a low-frequency, high-stakes decision — users do not need a daily-open app, they need a tool that works the moment they tap a link. A responsive web app with PWA capability covers the use case at a fraction of the build cost and lets us ship in 6 weeks instead of 6 months.

### 1.5 Build philosophy for engineering

- **Front-end behaves like a tool. Back-end behaves like a transaction OS.**
- **Semi-automation is acceptable in MVP.** Where automation costs more than human effort at current volume, we use humans (e.g., deep reports). We productize once volume justifies it.
- **Every user input has a business purpose.** No vanity fields. Every form question maps to either lead scoring or compliance.
- **Compliance is a first-class feature, not a footer.** PDPA, DNC, and CEA requirements are baked into data flow from day one.

---

## 2. Goals, Non-Goals & Success Metrics

### 2.1 Business goals (6-month horizon)

| Goal                                       | Target                                    |
| ------------------------------------------ | ----------------------------------------- |
| Closed transactions attributed to platform | 10                                        |
| Commission share revenue                   | ~SGD 20,000                               |
| Stable operating model                     | 3 consecutive months                      |
| Active vetted agent partners               | 5–10 (filtered from initial 50 prospects) |
| Monthly qualified leads generated          | 20+ by month 6                            |
| Xiaohongshu follower count                 | 10,000+ by month 6                        |

### 2.2 Product goals (MVP launch — week 6)

| Goal                                              | Target                            |
| ------------------------------------------------- | --------------------------------- |
| Affordability calculator completion rate          | ≥ 60% of starts                   |
| Quiz completion rate                              | ≥ 50% of starts                   |
| Result page → contact submission rate             | ≥ 25%                             |
| Time from lead submission to first agent response | < 2 hours (during business hours) |
| Lead OS operational with full attribution chain   | 100% of leads tracked end-to-end  |

### 2.3 Non-goals (explicitly out of scope for MVP)

- Native iOS or Android apps
- Full property listing aggregation (we are not a search portal)
- Map-based search
- 3D virtual tours
- User-to-user community / forum
- Full agent SaaS / CRM
- Direct integrations with banks, HDB, URA transaction systems
- English-language version (Phase 2)
- Auto-generated deep property reports (semi-manual in MVP, automated in Phase 4)

### 2.4 Definition of MVP success

MVP is successful if, by end of week 12 (6 weeks build + 6 weeks operation), we have:

1. Generated ≥ 50 contact submissions through the funnel
2. Routed ≥ 20 qualified leads to vetted agents
3. Closed ≥ 1 attributable transaction with full data trail
4. Identified the top 3 highest-converting content angles for Xiaohongshu
5. Identified the bottom-50% agents to drop and the top-20% to retain

---

## 3. Target Users & Personas

### 3.1 Primary persona — "Wei, the upgrading PR family head"

- **Demographics:** 38, male, Singapore PR (originally from mainland China), married with 2 young children, household income SGD 280,000/year
- **Current state:** Lives in a 4-room HDB flat, considering upgrading to a 3-bedroom condo
- **Budget:** SGD 1.8M–2.4M
- **Decision drivers:** Top schools within 1km, MRT proximity, capital appreciation potential
- **Pain points:**
  - Doesn't fully understand ABSD impact for PR second property
  - Has been spammed by 5 agents, doesn't trust any specific one
  - Confused between RCR vs OCR trade-off
  - Wife and he disagree on prioritization of school vs commute
- **How they find us:** Saw a Xiaohongshu post titled "PR家庭升级第二套房，ABSD怎么算最划算?"
- **Success state:** Receives a clear personalized strategy report, books a 15-min consult, gets matched with a vetted bilingual agent who actually has new-launch + resale experience in their target districts

### 3.2 Secondary persona — "Lin, the recently arrived high earner"

- **Demographics:** 42, female, just received PR approval, regional director at a tech multinational, household income SGD 450,000/year
- **Current state:** Renting in District 9, considering first home purchase as PR
- **Budget:** SGD 2.5M–3.5M
- **Decision drivers:** Status, prestige, future resale, walkability
- **Pain points:**
  - Just transitioned from foreigner (60% ABSD) to PR (5% ABSD on first), wants to act fast
  - Strong opinions but limited Singapore market knowledge
  - Doesn't want to be "sold to" by aggressive agents
- **How they find us:** WeChat group share of a comparison article between Orchard and Bukit Timah
- **Success state:** Uses our calculator and comparator, validates her own thinking, agrees to a no-pressure intro call

### 3.3 Tertiary persona — "Mr. Tan, the small-B agent partner"

- **Demographics:** 35, male, CEA-registered salesperson, 4 years experience, mainly works new launches in District 14/15
- **Current state:** Spends SGD 800/month on PropertyGuru leads, complains 80% are tire kickers
- **Pain points:**
  - Bad lead quality
  - No way to know if a lead has been shared with 5 other agents
  - Wants Mandarin-speaking buyers but his current channels are English-first
- **What he expects from us:**
  - Lead quality > 3x what he's paying for elsewhere
  - Clear attribution so disputes are minimized
  - Reasonable commission split — willing to do 20% on closed deals if leads convert at >5%

### 3.4 Anti-persona (NOT our target)

- Singaporean citizens buying first HDB (different decision logic, different agent network)
- Foreign investors with no PR path (60% ABSD makes deals rare and high-risk)
- Buyers under 30 with no real budget (high noise, low conversion)

---

## 4. Core User Flows

### 4.1 Acquisition → conversion master flow

```
Xiaohongshu post → Tap link
  ↓
LionHome landing page (mobile web)
  ↓
4 entry points (CTAs):
  ├── Affordability Calculator
  ├── Buyer Health Check (Quiz)
  ├── Region/Property Matcher
  └── Read Article (Content)
  ↓
Layer 1 lead capture (name, WhatsApp, language pref, purchase timeline)
  ↓
Result page (personalized output, partial content gated)
  ↓
Layer 2 lead capture (residency, budget, income, property history)
  ↓
CTA: "Book a 15-min strategy call" or "Get full report"
  ↓
Layer 3 lead capture (decision maker, concerns, agent consent)
  ↓
Lead enters Lead OS → scored → routed to top-tier agent
  ↓
Agent contacts lead via WhatsApp within 2 hours (SLA)
  ↓
Agent updates status: Contacted → Viewing → Negotiation → Closed
  ↓
Three-way close confirmation:
  - Agent reports closed
  - Buyer confirms via push message
  - Buyer/agent uploads OTP redacted copy or URA transaction screenshot
  ↓
Commission settlement triggered
```

### 4.2 Returning user flow

```
User receives WhatsApp/email notification:
  "Your saved unit at [project] just had a new transaction at SGD X PSF"
  ↓
Tap link → My Profile page (auto-login via magic link)
  ↓
View updated price chart, refresh strategy report
  ↓
Optionally: Re-trigger advisor booking with updated context
```

### 4.3 Agent flow (lite portal)

```
Agent receives WhatsApp + email: "New qualified lead assigned"
  ↓
Tap link → Agent portal (magic-link login)
  ↓
View full lead profile (anonymized phone until they accept)
  ↓
Click "Accept lead" → phone/WhatsApp revealed → 24-hour exclusive window starts
  ↓
Update status as deal progresses
  ↓
At close: upload proof, mark closed
  ↓
Buyer receives confirmation request → confirms
  ↓
Settlement triggered
```

### 4.4 Operations flow (Lead OS)

```
Lead arrives → auto-scored
  ↓
Ops reviews high-priority queue (score ≥ 70)
  ↓
Routes to recommended agent (or overrides)
  ↓
Monitors SLA: if agent doesn't accept in 2 hours, auto-reassign
  ↓
Tracks status updates, flags stale leads (no update in 7 days)
  ↓
At close, validates proof, triggers settlement
```

---

## 5. Information Architecture

### 5.1 Top-level site map (C-end)

```
/                           Landing page (Home)
/calculator                 Affordability Calculator (Module 1)
/quiz                       Buyer Health Check (Module 2)
/result/{session_id}        Personalized Result Page (Module 3)
/report/{report_id}         Deep Property Report (Module 4) — gated
/compare                    Region/Listing Comparator (Module 5)
/articles                   Content list page (Module 6)
/articles/{slug}            Article detail
/profile                    My Home Buying Profile (Module 7) — auth required
/advisor                    Advisor Booking (Module 8)
/legal/privacy              Privacy Policy
/legal/terms                Terms of Service
/legal/data-sharing         Data Sharing Consent details
```

### 5.2 Top-level site map (Internal — Lead OS)

```
/admin/login                Admin login
/admin/dashboard            Lead OS Dashboard
/admin/leads                Lead list (filter, sort, search)
/admin/leads/{id}           Lead detail (full profile, journey, consent log)
/admin/agents               Agent management
/admin/agents/{id}          Agent detail (performance, history)
/admin/routing              Routing rules engine
/admin/deals                Deal tracking pipeline
/admin/settlements          Commission settlement
/admin/content              CMS for articles
/admin/analytics            Business KPI dashboard
```

### 5.3 Top-level site map (Agent Portal)

```
/agent/login                Magic-link login
/agent/leads                My assigned leads
/agent/leads/{id}           Lead detail + status update
/agent/deals                My deal pipeline
/agent/profile              My profile + CEA verification status
```

### 5.4 Navigation principles

- **C-end mobile:** No persistent nav bar. Sticky bottom CTA on every page that adapts to user state ("Start your check" → "Continue your check" → "Book consult"). Hamburger menu top-right with: Home, Calculator, Quiz, Articles, My Profile, Login.
- **C-end desktop:** Top nav bar with: Logo | Calculator | Quiz | Compare | Articles | My Profile | Language toggle (中文/EN — EN disabled in MVP).
- **Internal:** Left sidebar nav with module sections, top breadcrumbs.

---

## 6. Module 1 — Property Affordability Calculator

### 6.1 Purpose & business value

The calculator is the **highest-value top-of-funnel acquisition tool**. Singapore's tax stack (BSD + ABSD), TDSR, MSR, LTV limits, and CPF eligibility are genuinely confusing. An accurate, beautifully presented calculator establishes immediate credibility and gathers four critical lead-scoring fields: residency, income, existing property count, budget.

**Primary KPI:** Calculation completion rate ≥ 60% of starts.
**Secondary KPI:** Calculation → contact form conversion ≥ 35%.

### 6.2 User journey

1. User lands on `/calculator` (often from Xiaohongshu deep link with UTM params).
2. Sees a clean hero: "新加坡买房，我到底买得起多少？" with a single CTA "开始测算" (Start Calculation).
3. Steps through a 5-step form (one question per screen on mobile, single page on desktop).
4. Sees animated calculation with a 1.5s loader: "Crunching ABSD, BSD, TDSR…"
5. Lands on result page with their personal calculation breakdown.
6. Result page has: Save result, Share result, Get personalized report, Book consultation.
7. To save or share, user must enter name + WhatsApp (Layer 1 lead capture).

### 6.3 Input specification

| Field                                   | Type          | Required    | Validation                                                      | Notes                              |
| --------------------------------------- | ------------- | ----------- | --------------------------------------------------------------- | ---------------------------------- |
| Residency status                        | Single select | Yes         | One of: SG Citizen / PR / Foreigner / Buying via company entity | Drives ABSD calc                   |
| Marital status                          | Single select | Yes         | Single / Married / Married with foreign spouse                  | Affects ABSD remission eligibility |
| Spouse residency (if married)           | Single select | Conditional | Same options as residency                                       | Joint purchase logic               |
| Existing residential properties owned   | Number        | Yes         | 0–10 (cap)                                                      | Drives ABSD tier                   |
| Annual gross household income (SGD)     | Number range  | Yes         | 50,000 – 2,000,000 with slider                                  | Drives loan eligibility & TDSR     |
| Age of primary applicant                | Number        | Yes         | 21–75                                                           | Affects loan tenure                |
| Employment type                         | Single select | Yes         | Salaried / Self-employed / Mixed                                | Affects loan haircut               |
| Existing monthly debt obligations (SGD) | Number        | Yes         | 0–50,000, default 0                                             | Affects TDSR                       |
| Available cash for down payment (SGD)   | Number        | Yes         | 50,000–10,000,000                                               | Drives feasible price ceiling      |
| Available CPF OA balance (SGD)          | Number        | Conditional | 0–2,000,000, only if PR/Citizen                                 | Drives down payment composition    |
| Loan tenure preference                  | Slider        | Yes         | 5–30 years, default 25                                          | User can adjust                    |
| Property type preference                | Single select | Yes         | New launch (BUC) / Resale / Either                              | Affects payment schedule logic     |

### 6.4 Output specification

The result page renders these sections in order:

**Section A — "Your Maximum Purchase Price"** (hero):

- Single large number, e.g., **"SGD 2.18M"**
- Subtitle: "基于您的身份、收入与首付能力的最大可购房价"
- Visual: horizontal bar showing breakdown (Cash + CPF + Loan)

**Section B — "Cost Breakdown at SGD [max price]"**:

- Down payment (split: cash / CPF)
- Loan amount
- BSD (Buyer's Stamp Duty) — calculated per IRAS tiers
- ABSD (Additional Buyer's Stamp Duty) — calculated per residency × property count
- Legal fees (estimated SGD 2,500–4,000)
- Valuation fee (estimated SGD 300–500)
- Stamp duty on mortgage (estimated)
- **Total upfront cash needed**: bolded

**Section C — "Monthly Payment Stress Test"**:

- Base case: at current market rate (assume 4.0% in MVP, configurable)
- Stress case: at base + 2pp
- TDSR utilization: % of capped 55%
- Visual: gauge chart for TDSR

**Section D — "What this means in real terms"**:

- 3 example scenarios pulled from a curated database:
  - "您的预算可以买:District 15 二手3房 / District 19 新盘2+1 / District 5 资深公寓3房"
- Each example shows district, property type, typical PSF range

**Section E — "Risks & Notes"** (educational copy block):

- Identity-specific notes (e.g., "As a PR buying your second property, ABSD is 30%")
- 1-2 risk callouts based on inputs (e.g., low cash buffer warning if cash post-purchase < 6 months expenses)

**Section F — CTA card**:

- Primary: "Save my calculation & get a personalized strategy report"
- Secondary: "Compare 2 properties side-by-side"
- Tertiary: "Book a free 15-min consult"

### 6.5 Calculation logic (engineering reference)

See Appendix Section 24 for full calculation formulas. Engineering must implement:

- **BSD**: progressive tiers per IRAS schedule
- **ABSD**: matrix lookup [residency × property count] → rate
- **Max loan**: min(LTV cap × price, TDSR cap × income, MSR cap × income for HDB)
- **Max purchase price**: solve for P where Cash + CPF + Max_Loan(P) ≥ P × down_payment_ratio + BSD(P) + ABSD(P)
- All rates configurable via admin panel (do NOT hardcode — IRAS rules change)

### 6.6 States & edge cases

- **Foreigner with 60% ABSD**: Show clear warning. Some users will abandon — that's a feature, not a bug, this is correct lead filtering.
- **Income too low for any meaningful purchase**: Show empathetic message, redirect to HDB content (out of our scope but good will).
- **Budget too high relative to income**: Show TDSR-limited result with explanation.
- **CPF only available for PR/Citizen**: Hide CPF field for Foreigner residency.
- **Spouse has different residency**: Use higher-rate residency for ABSD (per IRAS).

### 6.7 Lead capture trigger

The calculator is **playable without registration** — user can complete the entire flow and see results without entering any contact info. **Registration is gated only behind Save / Share / Get Report / Book Consult actions.**

This is intentional: we need users to experience value first, then convert. Forcing registration upfront kills completion rate.

### 6.8 Acceptance criteria

- [ ] All 12 input fields work on mobile + desktop
- [ ] Validation errors display inline, never block submission silently
- [ ] Calculation completes in < 500ms after final input
- [ ] BSD/ABSD calculations match IRAS published examples to the dollar
- [ ] Result page is shareable via URL (with no PII in URL)
- [ ] Result page is responsive from 320px to 1920px viewports
- [ ] Result page renders correctly in WeChat in-app browser, Xiaohongshu in-app browser, Safari iOS, Chrome Android
- [ ] All rates are admin-configurable (no hardcoded tax tables)
- [ ] Re-running calculation with same inputs gives identical results

---

## 7. Module 2 — Buyer Health Check (Quiz)

### 7.1 Purpose

The quiz classifies users into one of 5 buyer archetypes and assigns a "purchase readiness score" (0–100). It is more emotional and less calculative than Module 1 — it answers "what kind of buyer am I?" rather than "what can I afford?". This drives:

- Personalization of subsequent content & report
- Lead scoring (high readiness = prioritize)
- Match logic (different agents specialize in different buyer types)

### 7.2 Buyer archetypes

| Archetype                           | Profile                                         | Match priority                         |
| ----------------------------------- | ----------------------------------------------- | -------------------------------------- |
| 自住升级型 (Upgrader)               | HDB → condo, family-driven, school-conscious    | High                                   |
| 学区驱动型 (School Hunter)          | Specific-school motivated, often time-sensitive | High                                   |
| 通勤效率型 (Commuter)               | Job-driven, MRT-proximity priority              | Medium                                 |
| 保值配置型 (Value Investor)         | Capital appreciation focus, secondary residence | High                                   |
| 海外回流落地型 (Returning Diaspora) | Recent PR, foundational first home in SG        | Highest (highest LTV, urgent timeline) |

### 7.3 Question structure

The quiz has 8 questions, each on its own screen (mobile) with progress bar. Questions in order:

1. **Why are you buying?** — primary residence / investment / both / not sure
2. **When do you want to complete?** — 1 month / 3 months / 6 months / 12 months / exploring
3. **Do you currently have children, or planning?** — yes have / planning soon / no
4. **What matters most? (rank top 3 of 6)** — School quality / Commute / Capital appreciation / Living comfort / Rental yield / Prestige
5. **Have you spoken to property agents yet?** — none / 1 / 2-3 / 4+
6. **What's your biggest worry right now?** — affordability / timing the market / picking the wrong area / agent trust / family disagreement / other
7. **How confident are you in your Singapore market knowledge?** — slider 1-5
8. **Anything else you'd like our team to know?** (optional free text)

### 7.4 Scoring algorithm

Purchase Readiness Score = weighted sum:

- Timeline (≤3 months = 30 pts, 4–6 months = 20, 7–12 months = 10, exploring = 0)
- Budget clarity from calculator if completed (+20 pts if completed, +10 if partial)
- Income–budget alignment (if calculator completed) (+15 if TDSR < 50%, +10 if 50–55%, 0 otherwise)
- Confidence score (× 3)
- Agent contact history (none = +10 pts, 1 = +5, 2-3 = 0, 4+ = -5 indicates already shopped around)
- Concerns specificity (specific concern = +5, "not sure" = 0)
- Free text quality (if non-empty and substantive = +5, evaluated by simple length + sentiment heuristic)

Score buckets:

- **85–100:** Ready to view properties — route to agent within 2h
- **60–84:** Ready to consult — schedule advisor call first
- **40–59:** Educate first — push content, retarget in 30 days
- **0–39:** Not yet — capture for newsletter, no agent routing

### 7.5 Result rendering

After quiz submission:

1. Loading animation 1.5s
2. Result reveal: "You're a 学区驱动型 buyer with a readiness score of 78/100"
3. Personalized 3-paragraph copy (rendered from template + LLM-assisted variation):
   - What this archetype means
   - What this score means for your next step
   - 3 specific recommended actions
4. CTA card identical to Module 1 result page

### 7.6 Acceptance criteria

- [ ] All 8 questions render correctly with progress indicator
- [ ] Quiz can be paused and resumed (state persisted in localStorage + server if logged in)
- [ ] Scoring is deterministic (same inputs → same score)
- [ ] Result page personalization uses both archetype and score (not just archetype)
- [ ] Quiz completion rate measurable per question (drop-off analytics)
- [ ] Free-text field is sanitized to prevent XSS
- [ ] Quiz works without prior calculator completion (and uses calculator data if available)

---

## 8. Module 3 — Personalized Result & Strategy Page

### 8.1 Purpose

This is the **conversion page** — where calculator + quiz outputs converge into a recommendation, and where Layer 2 lead capture happens. It's the page users will share screenshots of on WeChat, so visual quality matters.

### 8.2 Page structure

URL: `/result/{session_id}` — shareable.

**Section 1 — Header card:**

- "Hi [Name or "there"], here's your personalized strategy"
- Last updated timestamp
- 3 stat tiles: Buyer type | Readiness score | Suggested budget band

**Section 2 — Your Purchasing Power (gated/preview):**

- Summary from calculator (if completed)
- If not completed: CTA "Run the calculator to unlock this section"

**Section 3 — Recommended Districts (3 districts):**

- For each: district code, name in CN, why it suits you (2-3 sentences), typical PSF range, sample MRT, sample school
- **Locked teaser:** "View detailed report for District 15" → triggers Layer 2 form
- Generation logic: rule-based matching from buyer archetype + budget + commute hint + family status

**Section 4 — New launch vs Resale guidance:**

- 1-paragraph recommendation based on residency, timeline, cash position
- Visual: Pros/cons table

**Section 5 — Risk callouts:**

- 1-3 personalized warnings (e.g., "Your TDSR is at 53% — limit your loan tenure exposure")

**Section 6 — Next steps card:**

- Primary CTA: "Get the full personalized report (free)" → triggers Layer 2 form
- Secondary CTA: "Book 15-min strategy consult" → triggers advisor booking flow
- Tertiary CTA: "Compare 2 properties" → Module 5

### 8.3 Layer 2 lead capture form

Triggered when user clicks Get full report or unlocks gated content.

| Field                                     | Type                                                                                      | Required              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| Residency status                          | Confirm/edit                                                                              | Yes                   |
| Marital status                            | Confirm/edit                                                                              | Yes                   |
| Currently own residential property in SG? | Yes/No                                                                                    | Yes                   |
| Budget range                              | Slider with bands                                                                         | Yes                   |
| Available down payment                    | Number                                                                                    | Yes                   |
| Annual income range                       | Bands                                                                                     | Yes                   |
| Need home loan?                           | Yes/No                                                                                    | Yes                   |
| Preferred districts                       | Multi-select                                                                              | No                    |
| Unit type preference                      | Multi-select (1BR / 2BR / 3BR / 4BR+)                                                     | Yes                   |
| Self-use / Investment weight              | Slider 0-100                                                                              | Yes                   |
| Consent checkbox 1                        | Required: "I agree to LionHome Privacy Policy and use of my data to generate this report" | Yes                   |
| Consent checkbox 2                        | Optional: "I'd like LionHome to send me market updates via email/WhatsApp"                | No (separate consent) |

### 8.4 Acceptance criteria

- [ ] Page loads in < 2s on 4G mobile
- [ ] All sections render even with partial data (graceful degradation)
- [ ] Locked sections show clear CTA, not just blur
- [ ] Sharing URL preserves session_id but contains no PII
- [ ] OG meta tags render correctly when shared on WhatsApp / WeChat / Xiaohongshu
- [ ] Layer 2 form auto-fills from prior data where available

---

## 9. Module 4 — Deep Property Report (Semi-Automated, MVP-Manual)

### 9.1 Purpose

The deep report is **the highest-value content artifact** the platform produces — a 15–20 page personalized PDF analyzing 3-5 specific projects matched to the user. It's the moat.

**MVP approach: human-in-the-loop.** Engineering builds the request/queue/delivery system; content is generated by ops team within 24-48h SLA. Phase 4 introduces template automation. Phase 5 introduces full automation.

### 9.2 User flow

1. User completes Layer 2 form (Module 3, Section 8.3)
2. System creates a `ReportRequest` record, status = `pending`
3. User sees confirmation: "Your report is being prepared. We'll WhatsApp you within 24 hours when it's ready."
4. Ops team receives notification (Slack + email)
5. Ops uses internal report builder to draft (see 9.4)
6. Ops marks ready → system sends WhatsApp with link to report
7. User clicks link → magic-link auth → views report on `/report/{report_id}`

### 9.3 Report content structure

For each of 3-5 matched projects:

1. **Project snapshot** — name, district, tenure, TOP year, total units, developer
2. **Why this matches you** — 2-paragraph custom rationale
3. **Unit type & layout analysis** — for relevant unit sizes within budget
4. **Pricing** — current PSF range, historical PSF chart (URA data)
5. **School zone analysis** — schools within 1km/2km, ranking, ballot history if available
6. **Commute analysis** — to CBD, to Jurong, to One-North (configurable based on user input)
7. **Surrounding amenities** — radar chart: MRT, malls, healthcare, F&B, parks
8. **Rental yield benchmark** — current rental PSF for similar units, gross yield %
9. **5-year outlook** — government plans (URA Master Plan), new MRT lines, supply pipeline
10. **Risk flags** — leasehold remaining, oversupply concerns, en-bloc proximity, road noise

Plus a **closing section**:

- Side-by-side comparison table of all matched projects
- Recommended sequence to view them
- Suggested next step: book a viewing through our advisor

### 9.4 Internal report builder (Lead OS)

Ops view at `/admin/reports/{request_id}/builder`:

- Left panel: User profile + quiz answers + calculator outputs
- Center: Project picker (search URA database by district + price + property type)
- For each picked project: editable template with auto-filled fields (PSF chart, school list, commute times via OneMap API), free-text fields for "Why this matches" and "Risk flags"
- Right panel: Live preview as PDF
- Bottom: Save draft / Mark ready

### 9.5 Data sources (free)

- **URA REST API** — transaction data, project details (free, requires registration)
- **OneMap API** — schools, MRT, amenities, commute time (free, government-provided)
- **MOE School Information Service** — school details, P1 ballot history (semi-public)
- **Manual research** — Master Plan changes, en-bloc rumors, road noise (judgment calls)

### 9.6 Output specs

- PDF, A4 portrait, 15-20 pages
- Cover page with user name + report ID
- Table of contents
- Each project section ~3 pages
- Closing section ~2 pages
- Branded footer with disclaimers (PDPA + advisory disclaimer)
- File naming: `LionHome_Report_{user_first_name}_{YYYYMMDD}.pdf`
- Storage: Supabase Storage with signed URLs (expire in 7 days; user can re-request)

### 9.7 Acceptance criteria

- [ ] Report request flow works end to end
- [ ] Ops can complete a report in < 60 minutes for a typical user
- [ ] PDF renders consistently across viewers (Adobe, browser, mobile preview)
- [ ] All charts are server-rendered (not JS-dependent at view time)
- [ ] User receives WhatsApp notification when ready
- [ ] User can re-download report from My Profile within 30 days
- [ ] Report count is tracked per user for analytics

---

## 10. Module 5 — Region & Listing Comparator

### 10.1 Purpose

Productize the user's natural decision paralysis. Most buyers oscillate between two specific options before deciding — let them compare side-by-side with our data lens.

### 10.2 Comparison types

1. **District vs District** (e.g., Queenstown vs Bishan)
2. **Project vs Project** (e.g., specific new launch vs specific resale)
3. **New launch vs Resale in same district**
4. **2BR vs 3BR in same project**

### 10.3 Comparison matrix

For each comparison, show side-by-side cards on the following dimensions:

| Dimension                              | District | Project |
| -------------------------------------- | -------- | ------- |
| Avg PSF (last 12 months)               | ✓        | ✓       |
| 5-year price growth                    | ✓        | ✓       |
| Schools within 1km (count + top names) | ✓        | ✓       |
| MRT proximity                          | ✓        | ✓       |
| Commute to CBD                         | ✓        | ✓       |
| Rental yield                           | ✓        | ✓       |
| Supply pipeline (next 3 years)         | ✓        | ✓       |
| Tenure & remaining lease               | —        | ✓       |
| Total units & unit mix                 | —        | ✓       |
| Developer track record                 | —        | ✓       |

### 10.4 UI pattern

- Top: 2 dropdown/search inputs to pick what to compare
- Body: 2-column comparison cards stacked vertically (mobile) or side-by-side (desktop)
- Each row has a small "Why this matters" tooltip
- Bottom: AI-generated summary paragraph "Based on your profile, [X] is likely a better fit because..."
- CTA: "Get a deep report on [winner]" or "Book consult to discuss"

### 10.5 Acceptance criteria

- [ ] At least 30 popular district + project combinations pre-cached at launch
- [ ] User can compare arbitrary inputs (graceful empty states for sparse data)
- [ ] Comparison summary uses LLM with strict prompt (no hallucinated stats)
- [ ] Mobile UI is fully thumb-navigable
- [ ] Comparison can be saved to user profile

---

## 11. Module 6 — Content Decision Center

### 11.1 Purpose

Content is the **primary acquisition engine**. The site CMS is not just a blog — it's where Xiaohongshu users land, consume value, and convert.

### 11.2 Content types

| Type                         | Format                           | Purpose                          |
| ---------------------------- | -------------------------------- | -------------------------------- |
| Policy explainer             | 800-1200 word article            | SEO + trust                      |
| District guide               | 1500-2000 word article + visuals | Long-tail SEO + decision support |
| Project review               | 1200 word article                | High-intent traffic              |
| Decision methodology         | 1000 word article                | Brand authority                  |
| Real case study (anonymized) | 800 word article                 | Conversion                       |
| Quick tip                    | 300 word article                 | Social shareability              |

### 11.3 Content page structure

- Hero image
- Title (CN)
- Author + date + read time
- Article body (rich text)
- Inline CTAs every 4–6 paragraphs (e.g., after a section about ABSD, embed "Calculate your ABSD →")
- Related content carousel
- Bottom: Floating CTA "Get my personalized strategy"

### 11.4 CMS requirements

Internal `/admin/content`:

- Markdown editor with live preview
- Image upload to CDN
- Tag system (for personalization & SEO)
- Schedule publish
- Draft/published states
- SEO fields: meta title, meta description, OG image
- Auto-generate slug from title

### 11.5 SEO requirements

- All articles server-rendered (Next.js SSR/SSG)
- Sitemap auto-generated
- Schema.org Article markup
- Canonical URLs
- Hreflang ready (for future EN version)
- Page speed: Lighthouse score ≥ 90 mobile

### 11.6 Acceptance criteria

- [ ] At least 10 seed articles published at MVP launch
- [ ] All articles indexed by Google within 2 weeks of launch
- [ ] CTAs in articles drive measurable conversion (tracked separately from homepage CTAs)
- [ ] Article URLs are clean, human-readable
- [ ] Mobile reading experience is optimized (font size, line height, image lazy load)

---

## 12. Module 7 — My Home Buying Profile

### 12.1 Purpose

Convert one-time users into returning users. The profile holds all calculator runs, quiz results, reports, saved projects, and journey progress.

### 12.2 Authentication

- Login methods: WhatsApp OTP (primary), Email magic link (secondary), Google OAuth (tertiary)
- No password-based login in MVP (passwords are friction; OTP is standard in SEA)
- Session length: 30 days, refreshable

### 12.3 Profile sections

**A. My Calculations** — list of past calculator runs with timestamps, allow rerun, allow delete

**B. My Quiz Results** — most recent + history if retaken

**C. My Reports** — list of personalized reports with status (pending / ready / expired), download buttons

**D. Saved Projects** — projects user has marked as interested; show price changes since save (if any)

**E. My Journey** — visual progress: Exploring / Researching / Viewing / Negotiating / Closed; user-editable

**F. Notification Preferences** — granular toggles:

- Price alerts on saved projects (default ON)
- Policy change alerts (default ON)
- New article digest weekly (default OFF — opt-in only)
- Promotional messages from agents (default OFF — must opt-in explicitly per PDPA)

**G. My Data & Privacy** — view all data we hold, request export (JSON download), request deletion

**H. Consent log** — full audit trail of every consent given, when, for what

### 12.4 Acceptance criteria

- [ ] All historical user actions appear in profile
- [ ] Data export returns full JSON within 60s
- [ ] Account deletion is hard delete after 30-day grace period (soft delete first)
- [ ] All toggles persist immediately and reflect in downstream messaging logic
- [ ] Profile page works for users who only completed the quiz (not the calculator) and vice versa

---

## 13. Module 8 — Advisor Booking & Lead Submission

### 13.1 Purpose

The bridge between platform and human matchmaking. This is where Layer 3 lead capture happens — the deepest, most consent-heavy data collection.

### 13.2 Trigger points

The advisor CTA appears in multiple places:

- Calculator result page (Section F)
- Quiz result page
- Strategy page (Module 3)
- Report (cover and closing)
- Comparator summary
- Article inline CTAs
- Returning user trigger: 3rd visit to a saved project

### 13.3 Booking flow

1. User taps "Book 15-min consult"
2. Modal/page: "Quick form — 30 seconds"
3. Layer 3 form (see 13.4)
4. User picks time slot from calendar (next 7 days, 30-min slots)
5. Confirmation page + WhatsApp confirmation
6. Internal: lead enters Lead OS with `consultation_requested` flag

### 13.4 Layer 3 form fields

| Field                                            | Type                                             | Required | Notes                                       |
| ------------------------------------------------ | ------------------------------------------------ | -------- | ------------------------------------------- |
| Primary decision maker                           | Single select (self / spouse / parents / shared) | Yes      | Routing signal                              |
| Biggest concern right now                        | Free text                                        | Yes      | Personalization signal                      |
| Already engaged with another agent?              | Yes/No + name optional                           | Yes      | Conflict avoidance                          |
| Specific project in mind?                        | Free text                                        | No       | If yes, prioritize agents with that project |
| Preferred consult format                         | In-person / Video call / WhatsApp call           | Yes      |                                             |
| Preferred language                               | 中文 / English / Both fine                       | Yes      | Match logic                                 |
| Available time slots                             | Multi-select                                     | Yes      | Operational logistics                       |
| Consent: share my profile with matched advisor   | Required checkbox with full text                 | Yes      | **CRITICAL PDPA gate**                      |
| Consent: receive follow-up WhatsApp from advisor | Required checkbox                                | Yes      | DNC compliance                              |

### 13.5 Consent text (must be exact)

> By submitting this form, I agree that LionHome may share my profile (including my calculations, quiz results, budget, residency, and contact information) with one CEA-registered property advisor selected by LionHome based on my needs, for the sole purpose of providing me with property buying advice. I understand:
>
> - I am giving consent only for the named purpose above.
> - I may withdraw this consent at any time by contacting [contact@lionhome.sg].
> - The advisor will contact me only via WhatsApp/phone call/email.
> - I have the right to know which advisor was matched to me before they contact me.
> - This consent is separate from any consent for marketing communications.

This consent is logged in `consent_log` table with timestamp, IP, user agent, exact consent text version.

### 13.6 Internal lead processing

When Layer 3 form submits:

1. Lead status updated to `qualified`
2. Lead score recalculated (Layer 3 completion adds significant points)
3. Auto-routing rule fires:
   - Match by buyer archetype + preferred district + language + agent specialization
   - Pick top 3 candidate agents
   - Assign to #1 (others queued as backups if #1 doesn't accept in 2h)
4. Notify assigned agent via WhatsApp + email + portal alert
5. Start 2-hour SLA timer for first response

### 13.7 Acceptance criteria

- [ ] Form submission succeeds even if user is not logged in (creates account automatically)
- [ ] Consent text is version-controlled; old consent versions remain referenceable
- [ ] Booking calendar shows real availability (not fake)
- [ ] WhatsApp confirmations send within 30 seconds of submission
- [ ] Lead enters Lead OS within 30 seconds of submission

---

## 14. Module 9 — Lead OS (Internal Back-Office)

### 14.1 Purpose

The Lead OS is the operational heart of the business. Without it, lead quality, agent performance, and attribution fall apart. This is where the team works every day.

### 14.2 Roles & permissions

| Role                       | Permissions                                                     |
| -------------------------- | --------------------------------------------------------------- |
| Founder/Admin              | Full access                                                     |
| Operations                 | View/edit all leads, assign, override routing, view settlements |
| Content                    | CMS access only                                                 |
| Read-only (e.g., investor) | Dashboard view only                                             |

### 14.3 Sub-modules

#### 14.3.1 Lead Dashboard

- KPI tiles: leads today / this week / this month, qualification rate, avg response time, pipeline value
- Funnel viz: Visitors → Calculator completed → Quiz completed → Layer 1 / 2 / 3 captured → Routed → Closed
- Real-time activity feed
- Filters: source channel, score range, status, agent, time window

#### 14.3.2 Lead List & Detail

**List view** at `/admin/leads`:

- Columns: ID | Name | Score | Status | Buyer Type | Budget | Timeline | Assigned Agent | Last Activity | Created
- Sort by any column
- Filter by status, score range, agent, channel, time window
- Bulk actions: assign, tag, export

**Detail view** at `/admin/leads/{id}`:

- Header: name, score, status, current agent
- Tabs:
  - **Profile**: all captured fields, all calculator runs, quiz answers
  - **Journey**: timeline of every page view, every form, every CTA click
  - **Communications**: WhatsApp/email log between platform and user
  - **Reports**: list of generated reports
  - **Consent log**: full audit trail with versions
  - **Agent activity**: which agents have been assigned, status updates from each
  - **Internal notes**: ops team notes

#### 14.3.3 Agent Management

**List view** at `/admin/agents`:

- Columns: Name | CEA Number | Status | Active leads | Conversion rate | Avg response time | Last activity
- Color-coded performance tier (top 20% green, mid 60% yellow, bottom 20% red)

**Detail view** at `/admin/agents/{id}`:

- Profile: photo, CEA registration, contact, specialization (district + new launch / resale + buyer types)
- Performance metrics over rolling 90 days:
  - Leads received
  - Acceptance rate
  - First response time (avg, p50, p95)
  - Viewing conversion %
  - Closed deals
  - Disputes
  - User satisfaction (post-consult survey)
- History: all leads ever assigned with outcomes
- Actions: pause from routing / resume / change tier / remove

**CEA verification:** Manual at MVP — ops verifies CEA number against public registry, marks `verified_at`.

#### 14.3.4 Routing Rules Engine

- Default rule: match by archetype × district × language × agent specialization, pick agent with best 90-day conversion
- Override rules table: priority-ordered list of conditions → actions (e.g., "If buyer is Returning Diaspora AND budget > 3M, route to Agent X")
- Exclusivity window: default 2 hours, configurable
- Auto-reassignment: if not accepted in window, route to backup agent
- Round-robin fallback: if no preference match, distribute among top-tier agents

#### 14.3.5 Deal Tracking

Pipeline view (kanban):

- Columns: Lead → Contacted → Viewing → Negotiation → OTP issued → Completed → Lost
- Each card: lead name, agent, project (if known), value estimate, days in stage
- Drag-drop to update (with audit log)
- Auto-flags: stale (>7 days no update), at-risk (negotiation > 21 days), hot (OTP issued)

#### 14.3.6 Settlement

For each closed deal:

- Linked lead + agent
- Commission proof uploads (OTP + URA confirmation)
- Calculated commission share owed to platform
- Status: pending verification / verified / paid / disputed
- Action buttons: Verify / Mark paid / Open dispute

### 14.4 Acceptance criteria

- [ ] Ops can find any lead by name/phone/email in < 5 seconds
- [ ] Lead detail view loads complete data in < 2s
- [ ] Routing rule changes take effect within 1 minute
- [ ] All ops actions are audit-logged (who did what, when)
- [ ] Settlement workflow prevents double-payment
- [ ] Dashboard refreshes in real-time (or near-real-time, ≤ 30s lag)

---

## 15. Module 10 — Agent Lite Portal

### 15.1 Purpose

A minimal interface for agent partners to receive leads, update status, and submit deal proofs. **Explicitly not** a full CRM. Agents who want full CRM use their own tools — we just need them to update status with us.

### 15.2 Authentication

- Magic link via WhatsApp + email when assigned a lead
- Long-lived session per device (60 days)
- Optional 2FA for high-volume agents

### 15.3 Pages

#### 15.3.1 My Leads

List of leads currently or recently assigned:

- New (awaiting acceptance)
- Active (accepted, in progress)
- Closed (won or lost)

For each: lead name (first name only until accepted), score, archetype, budget, timeline, assigned date, current status.

#### 15.3.2 Lead Detail

Before acceptance:

- Anonymized profile (first name, age range, residency, budget range, archetype, key concerns)
- Phone/WhatsApp **hidden**
- Two buttons: "Accept lead (start 24h exclusive)" or "Decline (will reassign)"

After acceptance:

- Full profile + phone + WhatsApp (deeplink to chat)
- Status updater: dropdown with stages
- Notes field (free text, visible to ops)
- Document upload zone (for OTP, etc.)

#### 15.3.3 Deal Submission

When agent moves status to "Closed":

- Required: project name, transaction price, completion date, OTP file upload OR URA confirmation screenshot
- System triggers buyer confirmation request automatically
- After buyer confirms, settlement record created

#### 15.3.4 My Profile

- Edit contact info, photo, specialization tags
- View own performance dashboard (last 90 days):
  - Leads received vs accepted
  - Avg first response time
  - Conversion %
  - Earnings to date
- View own tier status

### 15.4 Acceptance criteria

- [ ] Magic link auth works on first try, every time
- [ ] Hidden phone is genuinely hidden in DOM (not just CSS-hidden)
- [ ] Status changes propagate to ops in real-time
- [ ] File uploads support PDF, JPG, PNG up to 10MB
- [ ] Mobile-first design — agents are mobile users

---

## 16. Data Model

### 16.1 Core entities (simplified ER)

```
users                       Platform users (buyers, leads)
├─ user_profile             Extended profile data
├─ calculator_runs          Each calculator submission
├─ quiz_runs                Each quiz submission
├─ saved_projects           Bookmarked projects
└─ consent_log              Audit trail for all consents

leads                       Lifecycle of a buyer becoming a lead
├─ lead_scores              Score history
├─ lead_assignments         Agent assignments over time
├─ lead_journey_events      Page views, CTA clicks, etc.
└─ lead_communications      WA/email touchpoints

agents                      Vetted agent partners
├─ agent_profile            Specialization, CEA, photo
├─ agent_performance        Rolling metrics
└─ agent_actions            Status updates, notes

reports                     Personalized PDF reports
├─ report_requests          Pending/ready states
└─ report_versions          Multiple revisions

deals                       Tracked deal pipeline
├─ deal_stages              Stage history with timestamps
├─ deal_proofs              Uploaded files
└─ deal_confirmations       Buyer + agent confirmations

settlements                 Commission share records
├─ settlement_lines         Line items
└─ disputes                 Dispute tracking

content                     CMS articles
├─ content_versions         Draft/publish history
└─ content_tags             Taxonomy

projects                    SG property projects (cached from URA)
├─ project_transactions     Historical PSF data
└─ project_amenities        Schools, MRT, malls within radius

config                      Admin-configurable values
├─ tax_rates                BSD/ABSD/etc., versioned
├─ ltv_rules                LTV caps by scenario
└─ routing_rules            Lead routing logic
```

### 16.2 Critical table specs

**`users`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| created_at | timestamptz | |
| phone | varchar(20) | E.164 format, encrypted at rest |
| email | varchar(255) | Encrypted at rest |
| display_name | varchar(100) | |
| residency | enum | citizen/pr/foreigner/company |
| preferred_language | enum | zh-CN/zh-TW/en |
| utm_source / medium / campaign / content / term | varchar | First-touch attribution |
| last_seen_at | timestamptz | |
| deleted_at | timestamptz | Soft delete |

**`leads`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | FK → users | |
| status | enum | new / layer1 / layer2 / qualified / routed / contacted / viewing / negotiation / closed / lost / dormant |
| score | int | 0-100, recalculated on each new data point |
| score_components | jsonb | Breakdown for transparency |
| buyer_archetype | enum | upgrader/school/commuter/value/diaspora |
| readiness_band | enum | hot/warm/cool/cold |
| current_assignment_id | FK | Latest agent assignment |
| created_at, updated_at | timestamptz | |

**`consent_log`** (CRITICAL — never delete, append-only)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | FK → users | |
| consent_type | enum | privacy_policy / data_sharing_with_advisor / marketing_email / marketing_whatsapp / cookies |
| consent_version | varchar | e.g., "v1.2" |
| consent_text_hash | sha256 | Of exact text shown |
| granted | boolean | true=opt-in, false=opt-out |
| ip_address | inet | |
| user_agent | text | |
| timestamp | timestamptz | |
| withdrawn_at | timestamptz | If later withdrawn |

**`lead_journey_events`** (high-volume)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| lead_id | FK → leads | |
| event_type | enum | page_view / cta_click / form_start / form_submit / chat_message / etc. |
| event_data | jsonb | Type-specific payload |
| timestamp | timestamptz | Indexed |

**`agents`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | varchar | |
| cea_number | varchar(20) | UNIQUE; verified |
| cea_verified_at | timestamptz | |
| status | enum | active / paused / removed |
| tier | enum | top / mid / probation / removed |
| phone, whatsapp, email | varchar | |
| specializations | jsonb | districts[], property_types[], buyer_archetypes[], languages[] |
| created_at, updated_at | timestamptz | |

**`deals`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| lead_id | FK → leads | |
| agent_id | FK → agents | |
| project_id | FK → projects | nullable until known |
| stage | enum | matches deal_stages |
| transaction_price | numeric | nullable until close |
| commission_total | numeric | nullable until close |
| platform_share_pct | numeric | default 20% |
| platform_share_amount | numeric | calculated |
| ota_signed_at | date | |
| completion_date | date | |
| buyer_confirmed_at | timestamptz | Three-way confirmation |
| agent_confirmed_at | timestamptz | |
| settlement_status | enum | pending / verified / paid / disputed |

### 16.3 Data retention & deletion

- Active user data: retained while account exists
- Inactive (no login >18 months): notification → 30 days → soft delete
- Deleted user: PII purged, retain anonymized lead/deal records for 7 years (regulatory)
- Consent log: never deleted (append-only, even after user deletion — but PII fields are nulled)

### 16.4 Encryption

- At rest: AES-256 for all PII columns (phone, email, name, income figures)
- In transit: TLS 1.3 minimum
- Application-level encryption for income/budget fields (Supabase pgcrypto)

---

## 17. API Specifications

### 17.1 Public API conventions

- Base path: `/api/v1`
- Format: JSON
- Auth: JWT for user-authenticated routes; session cookies for browser flows
- Errors: standard format `{error: {code, message, details?}}`
- Rate limiting: 60 req/min per IP for public endpoints, 600/min for authenticated

### 17.2 Key endpoints (MVP)

**Calculator**

- `POST /api/v1/calculator` — submit inputs, return calculation. No auth required.
  - Body: full input set per Section 6.3
  - Response: full output per Section 6.4 + `session_id` for sharing
- `GET /api/v1/calculator/{session_id}` — retrieve a saved calculation
- `POST /api/v1/calculator/{session_id}/save` — save to user account (requires auth)

**Quiz**

- `POST /api/v1/quiz` — submit answers, return archetype + score
- `GET /api/v1/quiz/{session_id}` — retrieve

**Lead capture**

- `POST /api/v1/leads/layer1` — submit name + WhatsApp + timeline
- `POST /api/v1/leads/layer2` — submit budget, residency, etc.
- `POST /api/v1/leads/layer3` — submit booking + consent
- `GET /api/v1/leads/me` — get current user's lead state

**Reports**

- `POST /api/v1/reports/request` — create report request (auth required)
- `GET /api/v1/reports/{id}` — fetch report metadata + signed download URL
- `GET /api/v1/reports/me` — list user's reports

**Profile**

- `GET /api/v1/profile/me` — full profile
- `PATCH /api/v1/profile/me` — update fields
- `POST /api/v1/profile/me/data-export` — trigger export job
- `DELETE /api/v1/profile/me` — initiate account deletion (30-day grace)

**Authentication**

- `POST /api/v1/auth/whatsapp/send-otp`
- `POST /api/v1/auth/whatsapp/verify-otp`
- `POST /api/v1/auth/email/magic-link`
- `GET /api/v1/auth/email/verify?token=...`
- `POST /api/v1/auth/logout`

**Content** (read-only public)

- `GET /api/v1/content/articles` — paginated list
- `GET /api/v1/content/articles/{slug}`

### 17.3 Internal/admin endpoints

All under `/api/admin/v1/*` with role-based auth:

- `GET /api/admin/v1/leads` — list with filters
- `GET /api/admin/v1/leads/{id}` — full detail
- `PATCH /api/admin/v1/leads/{id}/assign` — assign agent
- `POST /api/admin/v1/agents` — create agent
- `PATCH /api/admin/v1/agents/{id}` — update
- `GET /api/admin/v1/deals` — pipeline
- `POST /api/admin/v1/settlements/{id}/verify`
- … (full list in separate API spec doc)

### 17.4 Webhooks (outbound)

For future agent integrations:

- `lead.assigned` — when lead is routed
- `lead.status_changed` — when agent updates status
- `deal.closed` — for settlement triggers

---

## 18. Compliance Requirements

### 18.1 PDPA (Personal Data Protection Act)

The product MUST implement these requirements **before MVP launch**:

**Notification of purpose**

- Every form that collects PII must display the purpose at point of collection
- Purposes must be specific (NOT "for any purpose we deem fit")
- Purpose text is versioned and stored in `consent_log`

**Consent**

- All consent is opt-in by default — no pre-checked boxes
- Layer 3 form has a separate consent for sharing with advisor (cannot be bundled with privacy policy consent)
- Marketing consent is separate from service consent
- Withdrawal mechanism: every WhatsApp/email message includes "Reply STOP to unsubscribe" link

**Use limitation**

- Data shared with agents includes ONLY fields the user consented to share
- Agents cannot use the data for anything beyond serving this specific buyer

**Access & correction**

- Users can view all their data via My Profile
- Users can export full data as JSON
- Users can request correction via support contact

**Retention**

- Data retention policy documented and enforced (Section 16.3)

**Data Protection Officer (DPO)**

- A named DPO is required by PDPA for organizations
- Email: `dpo@[domain]` — published in privacy policy

### 18.2 DNC (Do Not Call) compliance

- Marketing messages to Singapore numbers must check DNC registry status
- Even if user has provided number, marketing-specific consent must be separate
- Cannot use the platform's WhatsApp to "ask for marketing consent" — that itself is a marketing message
- Agents who message leads via WhatsApp must independently comply (this is documented in agent agreement)

### 18.3 CEA (Council for Estate Agencies) compliance

- All agents on platform MUST have a verified CEA salesperson registration number
- Verification is manual against the public CEA registry at MVP
- Platform's role is positioned as "information matching service" not "estate agency work"
- Legal review required before launch to confirm platform model does not require CEA license itself
- If at any point platform takes commission for "introducing buyer to seller", legal opinion may classify this as estate agency work — engage Singapore property lawyer **before MVP**

### 18.4 Cookies & analytics

- Cookie banner with granular controls (necessary / analytics / marketing)
- Default: only necessary cookies pre-enabled
- Google Analytics / Mixpanel only fires after analytics consent
- Privacy policy lists every cookie with purpose

---

## 19. Non-Functional Requirements

### 19.1 Performance

| Metric                         | Target           |
| ------------------------------ | ---------------- |
| Time to First Byte (TTFB)      | < 400ms (p95)    |
| Largest Contentful Paint (LCP) | < 2.5s mobile 4G |
| First Input Delay (FID)        | < 100ms          |
| Cumulative Layout Shift (CLS)  | < 0.1            |
| Lighthouse mobile score        | ≥ 85             |
| Calculator response time       | < 500ms          |
| API p95 latency                | < 800ms          |

### 19.2 Availability

- Target uptime: 99.5% (acceptable for MVP; Phase 4: 99.9%)
- Planned maintenance windows: communicated 48h in advance

### 19.3 Security

- All endpoints HTTPS only
- HSTS enabled
- CSP headers configured
- SQL injection: parameterized queries only (Supabase handles via SDK)
- XSS: all user content escaped at render
- CSRF: tokens on state-changing endpoints
- Auth: rate-limited, lockout after 5 failed attempts in 15 min
- Secrets management: env vars + secret manager, never in repo
- PII access logging: every admin view of a lead is logged
- Annual security audit (Phase 4+)

### 19.4 Scalability

- MVP designed for 10K monthly users; architecture supports 100K with same code
- Supabase handles DB scaling to 100K users without resharding
- Vercel handles traffic spikes natively
- Heavy operations (PDF generation, batch notifications) move to background jobs (Inngest or Supabase Edge Functions)

### 19.5 Browser & device support

| Platform                                                   | Support                  |
| ---------------------------------------------------------- | ------------------------ |
| Safari iOS 14+                                             | Full                     |
| Chrome Android (last 2 years)                              | Full                     |
| WeChat in-app browser                                      | Full                     |
| Xiaohongshu in-app browser                                 | Full                     |
| WhatsApp link preview                                      | Must render OG correctly |
| Chrome / Safari / Firefox / Edge desktop (last 2 versions) | Full                     |
| IE11                                                       | Not supported            |

### 19.6 Internationalization

- MVP: 简体中文 (zh-CN) only
- Phase 2: 繁体中文 (zh-TW) + English (en)
- All copy externalized to i18n files from day one (engineering investment, no UI in MVP)
- Currency: SGD only
- Date format: localized

### 19.7 Accessibility

- WCAG 2.1 AA compliance target
- Semantic HTML
- Alt text on all meaningful images
- Keyboard navigation works for all critical flows
- Focus indicators visible

---

## 20. Analytics & Instrumentation

### 20.1 Event taxonomy

Standardized event names. Required properties shown in `[brackets]`.

**Acquisition**

- `page_viewed` `[page_path, referrer, utm_*]`
- `external_link_clicked` `[destination, location_on_page]`

**Calculator funnel**

- `calculator_started` `[entry_point]`
- `calculator_step_completed` `[step_number, step_name]`
- `calculator_abandoned` `[last_step]`
- `calculator_completed` `[completion_time_seconds, residency, budget_band]`
- `calculator_result_shared` `[share_method]`

**Quiz funnel**

- `quiz_started`, `quiz_step_completed`, `quiz_abandoned`, `quiz_completed`

**Lead capture**

- `layer1_form_started` `[trigger_location]`
- `layer1_form_submitted` `[fields_completed_count]`
- `layer2_form_started`, `layer2_form_submitted`
- `layer3_form_started`, `layer3_form_submitted` `[buyer_archetype, score, advisor_consent_given]`

**Reports**

- `report_requested`, `report_delivered`, `report_viewed`, `report_downloaded`

**Advisor**

- `advisor_cta_clicked` `[location]`
- `advisor_booked` `[time_to_consult_hours]`
- `advisor_consult_completed`

**Agent (internal)**

- `lead_assigned`, `lead_accepted`, `lead_first_contact`, `lead_status_changed`
- `deal_closed`, `deal_disputed`

### 20.2 Dashboards

Dashboards built in Metabase or similar (free tier acceptable):

- **Acquisition dashboard**: traffic by source, conversion to layer 1
- **Funnel dashboard**: full funnel chart with drop-off rates
- **Lead quality dashboard**: score distribution, archetype mix, qualification rate
- **Agent dashboard**: per-agent SLA compliance, conversion, earnings
- **Revenue dashboard**: pipeline value, closed deals, settlement status

### 20.3 Cohort & retention

- Track returning users by cohort week
- Monitor "second session" rate as key engagement signal

### 20.4 A/B testing readiness

- Feature flag system from day one (e.g., GrowthBook free tier)
- Experiments planned for Phase 2: hero CTA copy, calculator entry vs quiz entry, lead capture timing

---

## 21. Phasing & Release Plan

### 21.1 Phase 0 — Pre-build (Weeks 1–2)

**Owner: Founder + Designer**

- Finalize ICP and persona doc
- Run 15–20 user interviews
- Design system + Figma mockups for core flows
- Filter initial 50 agents to top 5–8 for pilot
- Engage Singapore property lawyer (PDPA + CEA review)
- Sign service agreement template with pilot agents

**Exit criteria:** Designs signed off, legal review complete, agent agreements signed.

### 21.2 Phase 1 — MVP build (Weeks 3–6)

**Owner: Engineering**

Sprint 1 (Weeks 3–4):

- Repo setup, CI/CD, environments
- Auth (WhatsApp OTP + email magic link)
- Calculator (frontend + backend + tax engine)
- Layer 1 lead capture
- Basic Lead OS shell

Sprint 2 (Weeks 5–6):

- Quiz module
- Result/strategy page
- Layer 2 + Layer 3 lead capture
- Advisor booking flow
- Lead OS lead detail + assignment
- Agent Lite Portal (login, lead detail, status update)
- Report request system (manual generation)
- 10 seed articles
- Cookie banner + privacy policy + ToS pages

**Exit criteria:** All MVP acceptance criteria met, soft launch to 50 beta users.

### 21.3 Phase 2 — Acquisition validation (Weeks 7–10)

**Owner: Marketing + Ops**

- Publish 10–15 Xiaohongshu posts/week
- Run 3 landing page variants (school-driven / family upgrade / PR first condo)
- Test 3 hero CTAs
- Manual lead grading and routing
- First reports delivered manually

**Exit criteria:** 50–100 leads captured, 10–20 qualified, top-converting content angles identified.

### 21.4 Phase 3 — Closing & attribution loop (Weeks 11–14)

**Owner: Engineering + Ops**

- Lead auto-scoring (replaces manual grading)
- Auto-routing rules engine
- Three-way deal confirmation system
- Settlement workflow
- Agent performance scoring
- First close-out and settlement

**Exit criteria:** 2–3 attributed closes, settlement workflow tested end-to-end.

### 21.5 Phase 4 — Report automation & content scale (Weeks 15–18)

**Owner: Engineering + Content**

- Report template engine (80% auto, 20% manual)
- Region/listing comparator launches
- Price monitoring & alerts on saved projects
- Policy change push notifications
- Content cadence: 3–4 articles/week

### 21.6 Phase 5 — Stabilization & scale (Weeks 19–24)

**Owner: All**

- Refine scoring model with real outcome data
- Tier system formalized for agents
- Re-engagement automation for cold leads
- 6-month review & roadmap for Phase 6

**Exit criteria:** 10 cumulative closes, SGD 20K revenue, stable model run for 3 consecutive months.

---

## 22. Acceptance Criteria & Definition of Done

### 22.1 Module-level Definition of Done (DoD)

A module is "Done" when:

- [ ] All acceptance criteria in its section are met
- [ ] Unit tests cover critical business logic (≥ 70% coverage on calc/scoring/routing)
- [ ] E2E tests cover the happy path
- [ ] Cross-browser tested (per Section 19.5)
- [ ] PII fields encrypted at rest
- [ ] Analytics events fire correctly
- [ ] Accessibility passes axe automated check
- [ ] Performance passes Lighthouse threshold (Section 19.1)
- [ ] Security review (no obvious OWASP top-10 issues)
- [ ] Documentation: API docs updated, ops runbook updated where relevant
- [ ] Stakeholder sign-off (founder)

### 22.2 MVP launch criteria

The MVP can launch publicly when:

- [ ] All Module DoD met for Modules 1, 2, 3, 6, 7, 8, 9 (lite), 10
- [ ] Module 4 (reports) operates manually with documented SOP
- [ ] Privacy policy, ToS, data sharing consent live
- [ ] Cookie banner functional
- [ ] Legal review complete
- [ ] At least 5 vetted agents onboarded
- [ ] 10 seed articles published
- [ ] Monitoring + alerting set up (Sentry + uptime)
- [ ] Backup + disaster recovery procedure documented

---

## 23. Open Questions

Issues to resolve during Phase 0 or early Phase 1:

1. **Brand name finalization** — LionHome vs alternative options. Trademark search needed.
2. **Domain & hosting region** — Singapore data residency preferred. Supabase region: ap-southeast-1.
3. **WhatsApp Business API provider** — direct Meta vs aggregator (Twilio, MessageBird, 360dialog). Cost vs onboarding speed tradeoff.
4. **Manual report SLA** — 24h vs 48h. Test with first 10 reports to set realistic expectations.
5. **Agent commission split** — 20% baseline, but consider tiered (15% standard / 25% premium leads). Decide after Phase 2 data.
6. **Lead exclusivity duration** — 24h sufficient? Some agents may push for 48h. Test in Phase 3.
7. **Three-way confirmation friction** — what if buyer doesn't respond to confirmation? Fallback to URA data only? Decide before Phase 3.
8. **Pricing for non-converted leads** — should agents pay a small per-lead fee even before close? Test in Phase 3.
9. **CEA license question** — confirm with lawyer whether platform model requires registration as estate agency. **CRITICAL — must resolve before MVP launch.**
10. **Currency handling** — SGD only sufficient, or do we show CNY equivalents for buyer comprehension? (Likely yes, optional toggle.)

---

## 24. Appendix — Singapore Tax Calculation Reference

**This is a development reference. Engineering MUST verify all rates against IRAS official sources before each deployment, as rates change. All rates must be admin-configurable.**

### 24.1 BSD (Buyer's Stamp Duty) — for residential property

Progressive on purchase price or market value, whichever is higher:

| Slab               | Rate |
| ------------------ | ---- |
| First SGD 180,000  | 1%   |
| Next SGD 180,000   | 2%   |
| Next SGD 640,000   | 3%   |
| Next SGD 500,000   | 4%   |
| Next SGD 1,500,000 | 5%   |
| Remaining amount   | 6%   |

**Verify against:** https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer's-stamp-duty-(bsd)

### 24.2 ABSD (Additional Buyer's Stamp Duty) — RATES SUBJECT TO CHANGE

Rates as of last verified date — engineering must confirm current rates at implementation.

| Profile           | 1st property             | 2nd property | 3rd+ property |
| ----------------- | ------------------------ | ------------ | ------------- |
| Singapore Citizen | 0%                       | 20%          | 30%           |
| Singapore PR      | 5%                       | 30%          | 35%           |
| Foreigner         | 60%                      | 60%          | 60%           |
| Entity            | 65% (+ ABSD trustee 65%) | —            | —             |

**Verify against:** https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/additional-buyer's-stamp-duty-(absd)

### 24.3 LTV (Loan-to-Value) limits

| Scenario                                  | LTV cap |
| ----------------------------------------- | ------- |
| 1st loan, tenure ≤ 30y, age + tenure ≤ 65 | 75%     |
| 1st loan, exceeding above conditions      | 55%     |
| 2nd outstanding loan, normal              | 45%     |
| 2nd outstanding loan, exceeding           | 25%     |
| 3rd+ outstanding loan                     | 15%     |

### 24.4 TDSR (Total Debt Servicing Ratio)

- Cap: 55% of gross monthly income
- Includes ALL debt obligations (existing mortgages, car loans, credit card minimums, student loans)
- Stress-test rate (medium-term floor): 4.0% (verify current floor)

### 24.5 MSR (Mortgage Servicing Ratio) — HDB & EC only

- Cap: 30% of gross monthly income
- Applies on top of TDSR for these property types only

### 24.6 CPF usage rules

- OA can be used for down payment after the cash component (5% minimum cash for HDB, 5% minimum cash for private if loan ≤ 75% LTV)
- Withdrawal limits and Valuation Limit (VL) calculations are complex — engineering should consult with a mortgage specialist when implementing

### 24.7 Other costs (estimates)

| Cost                      | Range                                   |
| ------------------------- | --------------------------------------- |
| Legal fees                | SGD 2,500 – 4,000                       |
| Valuation fees            | SGD 300 – 500                           |
| Mortgage stamp duty       | 0.4% of loan, capped at SGD 500         |
| Agent fee (if buyer-side) | 1% (sometimes paid by seller in resale) |

---

**End of PRD v1.0**
