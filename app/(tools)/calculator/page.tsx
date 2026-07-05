"use client";

import React, { useState, useCallback, useRef } from "react";
import { buildApiPayload, toAmount, isForeigner } from "@/lib/calculator/bucket-maps";
import type { CalculatorFormState, ResidencyOption, Timeline } from "@/lib/calculator/form-types";
import { INITIAL_FORM } from "@/lib/calculator/form-types";
import type { V2ComputeResult, TierData, PriceTierKey, Viability } from "@/lib/calculator/v2-types";
import { computeBreakEven, estimateMedianRent } from "@/lib/finance";
import { MIN_DOWN_PAYMENT, MIN_VIABLE_PRICE_ENABLED } from "@/lib/tax";

/* ─────────────────────────────────────────────────────────────────────
   COLORS / TOKENS
───────────────────────────────────────────────────────────────────── */
const C = {
  primary: "#2F4F3D",
  primarySoft: "#EAEFEB",
  charcoal: "#1A1C1A",
  offwhite: "#FCFBF9",
  cream: "#F5F1E8",
  border: "#E5E5E5",
  warn: "#8B3A1F",
  warnSoft: "#F8EFE8",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
};
const SERIF = "'Noto Serif SC', serif";

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────── */
function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
function fmtS(n: number) {
  return `S$ ${fmt(n)}`;
}
/** "S$ X – Y 万" range, in 万 (10k). */
function fmtRange(low: number, high: number) {
  const lo = Math.round(low / 10_000);
  const hi = Math.round(high / 10_000);
  return `S$ ${lo} – ${hi} 万`;
}
function fmtWan(n: number) {
  return `S$ ${Math.round(n / 10_000)} 万`;
}

const RESIDENCY_LABEL: Record<ResidencyOption, string> = {
  sc: "新加坡公民",
  pr: "PR",
  foreigner_wp: "外籍 (WP)",
  foreigner_none: "外籍 (无身份)",
};
const ABSD_RATE_LABEL: Record<ResidencyOption, string> = {
  sc: "SC 0% 起",
  pr: "PR 5% 起",
  foreigner_wp: "外籍 60%",
  foreigner_none: "外籍 60%",
};
const TIER_NAME: Record<PriceTierKey, string> = {
  comfortable: "舒适区",
  balanced: "平衡区",
  aggressive: "上限区",
};
// Max purchasing power first (压力区), comfortable last.
const TIER_ORDER: PriceTierKey[] = ["aggressive", "balanced", "comfortable"];

/* ─────────────────────────────────────────────────────────────────────
   PRIMITIVES
───────────────────────────────────────────────────────────────────── */
function BtnPrimary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: C.primary,
        color: "#fff",
        padding: "16px 24px",
        borderRadius: 4,
        fontWeight: 500,
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 56,
        border: "none",
        transition: "opacity 0.15s",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        background: "#fff",
        color: C.charcoal,
        padding: "16px 24px",
        borderRadius: 4,
        fontWeight: 500,
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        minHeight: 56,
        border: `1px solid ${C.border}`,
      }}
    >
      {children}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="返回"
      style={{
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${C.border}`,
        borderRadius: "50%",
        background: "transparent",
        color: C.charcoal,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M13 4L7 10L13 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function BrandLogo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary }} />
      <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", color: C.charcoal }}>
        狮城家 LionHome
      </span>
    </span>
  );
}

/**
 * StepHeader with 3-node horizontal progress:
 *   ●───●───○   (current highlighted, done filled, todo hollow)
 */
function StepHeader({ current, onBack }: { current: 1 | 2 | 3; onBack: () => void }) {
  const total = 3;
  const nodes = [1, 2, 3] as const;
  return (
    <div style={{ width: "100%", marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <BackBtn onClick={onBack} />
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.06em",
            color: C.gray400,
          }}
        >
          {current} / {total}
        </span>
      </div>
      {/* Progress track */}
      <div
        style={{
          position: "relative",
          height: 20,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
        }}
      >
        {/* Background line */}
        <div
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            height: 1,
            background: C.border,
          }}
        />
        {/* Filled line (up to current node) */}
        <div
          style={{
            position: "absolute",
            left: 10,
            width: `calc((100% - 20px) * ${(current - 1) / (total - 1)})`,
            height: 1,
            background: C.primary,
            transition: "width 0.25s ease-out",
          }}
        />
        {/* Nodes */}
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {nodes.map((n) => {
            const done = n < current;
            const active = n === current;
            const size = active ? 14 : 10;
            return (
              <div
                key={n}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: done || active ? C.primary : "#fff",
                  border: `1px solid ${done || active ? C.primary : C.border}`,
                  transition: "all 0.2s ease-out",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 500,
        color: C.gray500,
        marginBottom: 12,
      }}
    >
      {children}
    </label>
  );
}

function IdentityCard({
  title,
  sub,
  selected,
  onClick,
}: {
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 16,
        border: `1px solid ${selected ? C.primary : C.border}`,
        borderRadius: 4,
        background: selected ? C.primarySoft : "#fff",
        boxShadow: selected ? `0 0 0 1px ${C.primary}` : "none",
        cursor: "pointer",
        minHeight: 88,
        transition: "all 0.15s",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 500, color: selected ? C.primary : C.charcoal }}>
        {title}
      </span>
      <span style={{ fontSize: 12, fontWeight: 300, color: C.gray500, marginTop: 2 }}>{sub}</span>
    </div>
  );
}

function RadioCard({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        border: `1px solid ${selected ? C.primary : C.border}`,
        borderRadius: 4,
        background: selected ? C.primarySoft : "#fff",
        boxShadow: selected ? `0 0 0 1px ${C.primary}` : "none",
        cursor: "pointer",
        minHeight: 56,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 15, color: C.charcoal }}>{label}</span>
      {sub && <span style={{ fontSize: 12, fontWeight: 300, color: C.gray400 }}>{sub}</span>}
    </div>
  );
}

function SegRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 4, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              background: active ? "#fff" : "transparent",
              color: active ? C.primary : C.gray500,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Manual money input — digit string, clearable, with a unit prefix and optional helper line. */
function MoneyInput({
  label,
  value,
  onChange,
  prefix = "S$",
  suffix,
  hint,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  placeholder?: string;
  /** Red border + red hint, e.g. when the entered value is below an allowed minimum. */
  error?: boolean;
}) {
  return (
    <div>
      <InputLabel>{label}</InputLabel>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1px solid ${error ? C.warn : C.border}`,
          borderRadius: 4,
          padding: "0 16px",
          background: "#fff",
        }}
      >
        <span style={{ color: C.gray500, fontSize: 16, marginRight: 8 }}>{prefix}</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            padding: "14px 0",
            fontSize: 18,
            fontWeight: 600,
            fontFamily: SERIF,
            color: C.charcoal,
            background: "transparent",
            fontVariantNumeric: "tabular-nums",
          }}
        />
        {suffix && <span style={{ color: C.gray400, fontSize: 13, marginLeft: 8 }}>{suffix}</span>}
      </div>
      {hint && (
        <p
          style={{
            fontSize: 11,
            color: error ? C.warn : C.gray400,
            fontWeight: error ? 500 : 300,
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function Toast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        background: C.charcoal,
        color: "#fff",
        fontSize: 14,
        padding: "12px 20px",
        borderRadius: 4,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      ✓ 已为你准备好，顾问将在 24 小时内联系
    </div>
  );
}

function Badge({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 8,
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 999,
        background: warn ? C.warn : C.primary,
        color: "#fff",
        fontWeight: 500,
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

function CostRow({
  label,
  value,
  strongTop,
  noTop,
  total,
}: {
  label: string;
  value: string;
  strongTop?: boolean;
  noTop?: boolean;
  total?: boolean;
}) {
  const emphasized = total || strongTop;
  const borderTop = emphasized ? `1px solid ${C.border}` : noTop ? "none" : "1px solid #F3F4F6";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontSize: 14,
        padding: "10px 0",
        borderTop,
        marginTop: emphasized ? 4 : 0,
      }}
    >
      <span
        style={{ color: emphasized ? C.charcoal : C.gray500, fontWeight: emphasized ? 500 : 300 }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: total ? 600 : 500,
          color: total ? C.primary : C.charcoal,
          fontVariantNumeric: "tabular-nums",
          fontSize: total ? 16 : 14,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Shown instead of the result when the buyer's max purchasing power falls below
 * the viable-home bar (viability.min_viable_price). Tells them, gently, what it
 * would take to start — no judgemental framing.
 */
function InterceptView({
  viability,
  monthlyIncome,
  targetDownPayment,
  onRestart,
}: {
  viability: Viability;
  monthlyIncome: number;
  targetDownPayment: number | null;
  onRestart: () => void;
}) {
  const incomeOk = monthlyIncome >= viability.min_monthly_income;
  const hasBudget = targetDownPayment !== null;
  const budgetOk = !hasBudget || targetDownPayment >= viability.min_down_payment;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 430,
        margin: "0 auto",
        background: C.offwhite,
        minHeight: "100dvh",
      }}
    >
      <div
        style={{ padding: "max(40px, env(safe-area-inset-top)) 20px 28px", background: C.cream }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 500,
            textTransform: "uppercase",
            color: C.primary,
            marginBottom: 8,
          }}
        >
          你的购房预算
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.2,
            color: C.charcoal,
          }}
        >
          离开始看房，
          <br />
          就差一点点
        </div>
        <p
          style={{
            fontSize: 12,
            color: C.gray500,
            fontWeight: 300,
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          按目前的条件，能看的房价还偏低，先不急着出结果。下面是开始正式测算需要达到的水平——补齐后再来即可。
        </p>
      </div>

      <div style={{ padding: "28px 20px 100px" }}>
        <section style={{ marginBottom: 32 }}>
          <h3 style={SECTION_TITLE}>① 开始测算需要达到</h3>
          <div
            style={{
              background: "#fff",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: 20,
            }}
          >
            <CostRow label="家庭月收入" value={`≥ ${fmtS(viability.min_monthly_income)}`} total />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: 13,
                padding: "6px 0 2px",
                color: C.gray500,
                fontWeight: 300,
              }}
            >
              <span>你目前 {fmtS(monthlyIncome)}/月</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: incomeOk ? C.primary : C.warn }}>
                {incomeOk
                  ? "✓ 已满足"
                  : `还差 ${fmtS(Math.max(0, viability.min_monthly_income - monthlyIncome))}/月`}
              </span>
            </div>

            {hasBudget && (
              <>
                <CostRow label="目标首付预算" value={`≥ ${fmtS(viability.min_down_payment)}`} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize: 13,
                    padding: "6px 0 2px",
                    color: C.gray500,
                    fontWeight: 300,
                  }}
                >
                  <span>你目前 {fmtS(targetDownPayment)}</span>
                  <span
                    style={{ fontSize: 13, fontWeight: 500, color: budgetOk ? C.primary : C.warn }}
                  >
                    {budgetOk
                      ? "✓ 已满足"
                      : `还差 ${fmtS(Math.max(0, viability.min_down_payment - targetDownPayment))}`}
                  </span>
                </div>
              </>
            )}

            <p
              style={{
                fontSize: 11,
                color: C.gray400,
                fontWeight: 300,
                marginTop: 12,
                lineHeight: 1.6,
              }}
            >
              {hasBudget
                ? "收入决定能贷多少、首付决定要付多少——两项都达到，就能开始三档测算。"
                : "未填目标首付时只看收入。收入达到后即可开始三档测算；也可回上一步填入目标首付。"}
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={onRestart}
          style={{
            width: "100%",
            background: "#fff",
            color: C.charcoal,
            padding: "16px 24px",
            borderRadius: 4,
            fontWeight: 500,
            fontSize: 16,
            minHeight: 56,
            border: `1px solid ${C.border}`,
            cursor: "pointer",
          }}
        >
          重新测算
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────── */
type View = "hero" | "step1" | "step2" | "step3" | "loading" | "result";

const LOADING_TEXTS = [
  "计算 BSD/ABSD 印花税...",
  "测算 LTV 与 TDSR...",
  "生成三档房价区间...",
  "计算 break-even 涨幅...",
];

const STEP_PAGE: React.CSSProperties = {
  width: "100%",
  maxWidth: 430,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  minHeight: "100dvh",
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: "max(24px, env(safe-area-inset-top))",
  paddingBottom: "max(24px, env(safe-area-inset-bottom))",
  boxSizing: "border-box",
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: C.charcoal,
  marginBottom: 16,
  fontFamily: SERIF,
};

export default function CalculatorPage() {
  const [view, setView] = useState<View>("hero");
  const [form, setForm] = useState<CalculatorFormState>(INITIAL_FORM);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<V2ComputeResult | null>(null);

  // Result-page adjustable state
  const [selectedTier, setSelectedTier] = useState<PriceTierKey>("balanced");
  const [years, setYears] = useState(7);
  const [tenure, setTenure] = useState(30);
  const [rate, setRate] = useState(1.65); // %
  // rent as a digit string so the field can be fully cleared while typing
  const [rentDigits, setRentDigits] = useState("4500");
  const rentNum = rentDigits === "" ? 0 : Number(rentDigits);
  const rentEdited = useRef(false);

  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  // Lead-sharing consent must be explicit (PDPA s.13). Default unchecked.
  const [leadConsent, setLeadConsent] = useState(false);

  const setField = useCallback(
    <K extends keyof CalculatorFormState>(key: K, val: CalculatorFormState[K]) =>
      setForm((f) => ({ ...f, [key]: val })),
    []
  );

  function goTo(v: View) {
    setView(v);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }

  const foreigner = isForeigner(form.residency);
  const step1Ready = form.residency !== null;
  // Flat minimum target down payment, enforced at input time.
  const minDownPayment = MIN_DOWN_PAYMENT;
  const targetDownPaymentNum = toAmount(form.targetDownPayment);
  // A target down payment below the minimum is blocked here.
  const targetBelowMin = targetDownPaymentNum > 0 && targetDownPaymentNum < minDownPayment;
  // Income is required; target down payment is optional (blank = no cash limit) but,
  // if given, must cover at least the minimum.
  const step2Ready = toAmount(form.incomeMonthly) > 0 && !targetBelowMin;
  const step3Ready = form.timeline !== null;

  /* ─── Submit ─────────────────────────────────────────────────── */
  async function handleSubmit() {
    goTo("loading");
    setLoadingIdx(0);
    const interval = setInterval(
      () => setLoadingIdx((i) => Math.min(i + 1, LOADING_TEXTS.length - 1)),
      600
    );

    const payload = buildApiPayload(form, form.age);
    try {
      const res = await fetch("/api/v1/calculator/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      clearInterval(interval);
      if (json.ok) {
        const data = json.data as V2ComputeResult;
        setResult(data);
        setSelectedTier("balanced");
        setYears(data.break_even?.default_holding_years ?? 7);
        setTenure(data.break_even?.default_tenure_years ?? 30);
        setRate((data.break_even?.default_rate ?? 0.0165) * 100);
        rentEdited.current = false;
        setRentDigits(
          String(
            data.break_even?.median_rent_estimate ??
              estimateMedianRent(data.tiers.balanced.midpoint)
          )
        );
        try {
          sessionStorage.setItem("lh_calc_inputs", JSON.stringify(payload));
          sessionStorage.setItem("lh_calc_outputs", JSON.stringify(data));
          sessionStorage.setItem("lh_tax_version", data.tax_rates_version);
        } catch {
          /* ignore */
        }
        goTo("result");
      } else {
        goTo("step3");
        alert(json.error?.message ?? "计算失败，请重试");
      }
    } catch {
      clearInterval(interval);
      goTo("step3");
      alert("网络错误，请检查连接后重试");
    }
  }

  /* ─── Tier switch: re-estimate rent unless user edited it ─────── */
  function pickTier(t: PriceTierKey) {
    setSelectedTier(t);
    if (!rentEdited.current && result) {
      setRentDigits(String(estimateMedianRent(result.tiers[t].midpoint)));
    }
  }

  /* ─── Save report ────────────────────────────────────────────── */
  async function saveReport(): Promise<string | null> {
    if (!result) return null;
    try {
      const storedInputs = JSON.parse(sessionStorage.getItem("lh_calc_inputs") ?? "{}");
      const res = await fetch("/api/v1/calculator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: storedInputs,
          outputs: result,
          tax_rates_version: result.tax_rates_version,
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRunId(data.data.run_id);
        return data.data.run_id as string;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function handleWhatsApp() {
    if (!leadConsent) {
      // 没勾选 PDPA 同意，滚动到 checkbox 并高亮提示。不发起任何保存/分享行为。
      const el = document.getElementById("lead-consent-box");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const id = runId ?? (await saveReport());
    const text = id
      ? `Hi 狮城家，我的报告编号是 ${id}，请帮我看这个区间的房。`
      : `Hi 狮城家，请帮我看看适合我的房。`;
    window.open(
      `https://api.whatsapp.com/send?phone=6591115568&text=${encodeURIComponent(text)}`,
      "_blank"
    );
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  function resetAll() {
    setForm(INITIAL_FORM);
    setResult(null);
    setSelectedTier("balanced");
    setYears(7);
    setTenure(30);
    setRate(1.65);
    setRentDigits("4500");
    rentEdited.current = false;
    goTo("hero");
  }

  /* ═══════════════════════════════════════════════════════════════
     HERO
  ═══════════════════════════════════════════════════════════════ */
  if (view === "hero") {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
          background: C.offwhite,
        }}
      >
        <div style={{ flexShrink: 0, padding: "max(20px, env(safe-area-inset-top)) 20px 0" }}>
          <BrandLogo />
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "48px 20px 40px",
            margin: "24px 20px 0",
            borderRadius: 6,
            position: "relative",
            overflow: "hidden",
            background: C.cream,
          }}
        >
          <div style={{ position: "absolute", top: 24, right: 24, opacity: 0.3 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke={C.primary} strokeWidth="0.5" />
              <circle cx="40" cy="40" r="26" stroke={C.primary} strokeWidth="0.5" />
              <circle cx="40" cy="40" r="14" stroke={C.primary} strokeWidth="0.5" />
            </svg>
          </div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: C.primary,
              fontWeight: 500,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            新加坡购房预算测算
          </p>
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              color: C.charcoal,
              lineHeight: 1.05,
              fontSize: 36,
              marginBottom: 16,
            }}
          >
            新加坡买房，
            <br />
            预算多少钱适合我？
          </h1>
          <p
            style={{
              fontSize: 13,
              color: C.gray500,
              fontWeight: 300,
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            根据你的情况，3 分钟定制属于你的购房计划。
          </p>
        </div>

        <div
          style={{
            flex: 1,
            padding: "32px 28px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {[
            {
              t: "我适合买多少钱的房子？",
              s: "舒适 · 平衡 · 上限 三档预算，提前看清月供压力",
            },
            {
              t: "我的现金够不够买房？",
              s: "首付 · 印花税 · 月供逐项拆解",
            },
            {
              t: "买房还是租房更划算？",
              s: "买租对比，理性决策",
            },
          ].map(({ t, s }) => (
            <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: C.primarySoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7L6 10L11 4"
                    stroke={C.primary}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.charcoal, marginBottom: 2 }}>
                  {t}
                </div>
                <div style={{ fontSize: 12, color: C.gray500, fontWeight: 300, lineHeight: 1.6 }}>
                  {s}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flexShrink: 0, padding: "24px 20px max(24px, env(safe-area-inset-bottom))" }}>
          <BtnPrimary onClick={() => goTo("step1")}>快速测算</BtnPrimary>
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: C.gray400,
              marginTop: 12,
              fontWeight: 300,
              lineHeight: 1.6,
            }}
          >
            点击「快速测算」即表示你已阅读并同意{" "}
            <a
              href="/legal/terms"
              style={{ color: C.gray500, textDecoration: "underline" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              使用条款
            </a>{" "}
            和{" "}
            <a
              href="/legal/privacy"
              style={{ color: C.gray500, textDecoration: "underline" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              隐私政策
            </a>
            。本工具结果仅供参考，不构成财务或投资建议。
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 1 — 身份 / 套数 / 年龄
  ═══════════════════════════════════════════════════════════════ */
  if (view === "step1") {
    return (
      <div style={STEP_PAGE}>
        <StepHeader current={1} onBack={() => goTo("hero")} />
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 24 }}>
            <InputLabel>你的身份</InputLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(
                [
                  { value: "sc", title: "新加坡公民", sub: "ABSD 0% 起" },
                  { value: "pr", title: "永久居民 (PR)", sub: "ABSD 5% 起" },
                  { value: "foreigner_wp", title: "外籍·有工作许可", sub: "EP/SP/WP · ABSD 60%" },
                  { value: "foreigner_none", title: "外籍·无在新身份", sub: "仅访客 · ABSD 60%" },
                ] as { value: ResidencyOption; title: string; sub: string }[]
              ).map(({ value, title, sub }) => (
                <IdentityCard
                  key={value}
                  title={title}
                  sub={sub}
                  selected={form.residency === value}
                  onClick={() => setField("residency", value)}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <InputLabel>新加坡已有几套住宅</InputLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(
                [
                  { value: 0, label: "0 套", sub: "首次置业" },
                  { value: 1, label: "1 套", sub: "第二套买家" },
                  { value: 2, label: "2 套及以上", sub: "多套持有" },
                ] as { value: 0 | 1 | 2; label: string; sub: string }[]
              ).map(({ value, label, sub }) => (
                <RadioCard
                  key={value}
                  label={label}
                  sub={sub}
                  selected={form.existingProperties === value}
                  onClick={() => setField("existingProperties", value)}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <InputLabel>你的年龄</InputLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 600 }}>{form.age}</span>
              <span style={{ color: C.gray500 }}>岁</span>
            </div>
            <input
              type="range"
              min={21}
              max={65}
              value={form.age}
              onChange={(e) => setField("age", Number(e.target.value))}
              style={{ width: "100%", accentColor: C.primary }}
            />
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16 }}>
          <BtnPrimary disabled={!step1Ready} onClick={() => goTo("step2")}>
            下一步
          </BtnPrimary>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 2 — 收入 / 目标首付
  ═══════════════════════════════════════════════════════════════ */
  if (view === "step2") {
    return (
      <div style={STEP_PAGE}>
        <StepHeader current={2} onBack={() => goTo("step1")} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <MoneyInput
              label="家庭税前月收入（含配偶）"
              value={form.incomeMonthly}
              onChange={(v) => setField("incomeMonthly", v)}
              suffix="/ 月"
              placeholder=""
            />

            <MoneyInput
              label="目标首付（含现金 + CPF，可选填）"
              value={form.targetDownPayment}
              onChange={(v) => setField("targetDownPayment", v)}
              placeholder=""
              error={targetBelowMin}
              hint={
                targetBelowMin
                  ? `目标首付至少 ${fmtS(minDownPayment)}`
                  : targetDownPaymentNum > 0
                    ? undefined
                    : `留空则不限首付，房价只受收入与贷款成数限制（最低首付 ${fmtS(minDownPayment)}）`
              }
            />
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16 }}>
          <BtnPrimary disabled={!step2Ready} onClick={() => goTo("step3")}>
            下一步
          </BtnPrimary>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 3 — 时间线
  ═══════════════════════════════════════════════════════════════ */
  if (view === "step3") {
    return (
      <div style={STEP_PAGE}>
        <StepHeader current={3} onBack={() => goTo("step2")} />
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 24 }}>
            <InputLabel>你打算何时买？</InputLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(
                [
                  { value: "6m", label: "半年内" },
                  { value: "1y", label: "1 年内" },
                  { value: "explore", label: "1 年以上 / 仅了解" },
                ] as { value: Timeline; label: string }[]
              ).map(({ value, label }) => (
                <RadioCard
                  key={value}
                  label={label}
                  selected={form.timeline === value}
                  onClick={() => setField("timeline", value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16 }}>
          <BtnPrimary disabled={!step3Ready} onClick={handleSubmit}>
            生成评估
          </BtnPrimary>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     LOADING
  ═══════════════════════════════════════════════════════════════ */
  if (view === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ position: "relative", width: 64, height: 64, marginBottom: 28 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `1px solid ${C.border}`,
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `1px solid ${C.primary}`,
                borderTop: "1px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
          <h3
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 8,
              color: C.charcoal,
            }}
          >
            正在为你测算购房预算
          </h3>
          <p style={{ fontSize: 14, color: C.gray500, fontWeight: 300 }}>
            {LOADING_TEXTS[loadingIdx]}
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     RESULT
  ═══════════════════════════════════════════════════════════════ */
  if (view === "result" && result) {
    const residency = form.residency ?? "pr";
    const isFirst = form.existingProperties === 0;

    const hasBudget = form.targetDownPayment !== "";
    const targetAmount = toAmount(form.targetDownPayment);
    const monthlyIncome = toAmount(form.incomeMonthly);

    // Max purchasing power is below the viable-home bar → intercept and tell the
    // buyer what it would take, instead of showing tiers that don't mean much.
    // Gated off for now (MIN_VIABLE_PRICE_ENABLED); the result shows regardless.
    if (
      MIN_VIABLE_PRICE_ENABLED &&
      result.tiers.aggressive.price_high < result.viability.min_viable_price
    ) {
      return (
        <InterceptView
          viability={result.viability}
          monthlyIncome={monthlyIncome}
          targetDownPayment={hasBudget ? targetAmount : null}
          onRestart={() => goTo("hero")}
        />
      );
    }

    const tier: TierData = result.tiers[selectedTier];
    const cb = tier.cash_breakdown;
    // Cash shortfall only applies when the buyer set a target down payment.
    const cashGap = Math.max(0, cb.transaction_cash_total - targetAmount);
    const cashShort = hasBudget && cashGap > 0;

    // Live break-even (Block 3 only) via the shared core — identical to the server formula.
    const upfront = cb.down_payment_cash + cb.bsd + cb.absd + cb.legal_fees_est;
    const be =
      isFirst && cb.price > 0
        ? computeBreakEven({
            price: cb.price,
            loanAmount: cb.loan_amount,
            upfrontCash: upfront,
            monthlyRent: rentNum,
            holdingYears: years,
            tenureYears: tenure,
            rate: rate / 100,
          })
        : null;

    const propsLabel =
      form.existingProperties === 0 ? "首套" : form.existingProperties === 1 ? "第二套" : "第三套+";
    const incomeLabel = `S$ ${monthlyIncome.toLocaleString("en-US")}/月`;
    const downPaymentLabel = hasBudget
      ? `目标首付 S$ ${targetAmount.toLocaleString("en-US")}`
      : "首付不限";
    const lowerTierName =
      selectedTier === "aggressive"
        ? "平衡区"
        : selectedTier === "balanced"
          ? "舒适区"
          : "更低预算";

    return (
      <>
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            margin: "0 auto",
            background: C.offwhite,
            minHeight: "100dvh",
          }}
        >
          {/* Hero */}
          <div
            style={{
              padding: "max(40px, env(safe-area-inset-top)) 20px 28px",
              background: C.cream,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                fontWeight: 500,
                textTransform: "uppercase",
                color: C.primary,
                marginBottom: 8,
              }}
            >
              你的购房预算
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
                color: C.charcoal,
              }}
            >
              基于你 {RESIDENCY_LABEL[residency]} · {propsLabel} 的画像
            </div>
            <p style={{ fontSize: 12, color: C.gray500, fontWeight: 300, marginTop: 12 }}>
              以下三档房价对应不同月供压力，平衡区为推荐。
            </p>
          </div>

          <div style={{ padding: "28px 20px 100px" }}>
            {/* Block 1 · 三档房价区间 */}
            <section style={{ marginBottom: 32 }}>
              <h3 style={SECTION_TITLE}>① 你适合买多少钱的房子</h3>
              {result.degenerate && (
                <p
                  style={{
                    fontSize: 12,
                    color: C.warn,
                    fontWeight: 300,
                    marginBottom: 12,
                    lineHeight: 1.6,
                  }}
                >
                  你的现金封顶限制了三档收敛到同一价位 —— 想买更高需先增加现金。
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {TIER_ORDER.map((key) => {
                  const td = result.tiers[key];
                  const active = key === selectedTier;
                  const pct = Math.round(td.ratio * 100);
                  const isAgg = key === "aggressive";
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => pickTier(key)}
                      onKeyDown={(e) => e.key === "Enter" && pickTier(key)}
                      style={{
                        background: active ? C.primarySoft : "#fff",
                        border: `1px solid ${active ? C.primary : C.border}`,
                        boxShadow: active ? `0 0 0 1px ${C.primary}` : "none",
                        borderRadius: 4,
                        padding: 20,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.2em",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          color: C.primary,
                        }}
                      >
                        {TIER_NAME[key]}
                        {key === "balanced" && <Badge>推荐</Badge>}
                        {isAgg && <Badge warn>MAS 上限</Badge>}
                      </div>
                      <div
                        style={{
                          fontFamily: SERIF,
                          fontSize: 22,
                          fontWeight: 600,
                          color: C.charcoal,
                          marginTop: 4,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {td.price_high > 0 ? fmtRange(td.price_low, td.price_high) : "—"}
                      </div>
                      <div
                        style={{ fontSize: 12, color: C.gray500, fontWeight: 300, marginTop: 4 }}
                      >
                        压力测试月供占月收入 ≤ {pct}%{isAgg && " · 日常生活会吃紧"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Block 2 · 现金需求拆解 */}
            <section style={{ marginBottom: 32 }}>
              <h3 style={SECTION_TITLE}>
                ② 买 <span style={{ color: C.primary }}>“{TIER_NAME[selectedTier]}”</span>{" "}
                的房需要准备的现金
              </h3>
              <div
                style={{
                  background: "#fff",
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: 20,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: C.gray400,
                    fontWeight: 300,
                    marginBottom: 16,
                    lineHeight: 1.6,
                  }}
                >
                  按 <span style={{ fontWeight: 500, color: C.charcoal }}>{fmtWan(cb.price)}</span>
                  （区间中点）测算。
                </p>
                <CostRow label="首付（房价 − 可贷金额）" value={fmtS(cb.down_payment_cash)} />
                <CostRow label="BSD 买方印花税（累进）" value={fmtS(cb.bsd)} />
                <CostRow
                  label={`ABSD 额外印花税（${ABSD_RATE_LABEL[residency]}）`}
                  value={fmtS(cb.absd)}
                />
                <CostRow label="律师 / 估价 / 杂费" value={fmtS(cb.legal_fees_est)} />
                <CostRow label="过户现金合计" value={fmtS(cb.transaction_cash_total)} total />
                <p
                  style={{
                    fontSize: 12,
                    color: C.gray400,
                    fontWeight: 300,
                    marginTop: 16,
                    lineHeight: 1.6,
                  }}
                >
                  首付 = 房价 − 可贷金额（标准成数约 75%）。以上为过户时需准备的现金合计。
                </p>
              </div>

              {/* Feasibility / Diagnosis — only when a target down payment was given. */}
              {hasBudget &&
                (!cashShort ? (
                  <div
                    style={{
                      marginTop: 16,
                      background: C.primarySoft,
                      borderRadius: 4,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{ fontSize: 14, fontWeight: 500, color: C.primary, marginBottom: 4 }}
                    >
                      ✓ 首付充足
                    </div>
                    <p style={{ fontSize: 12, color: "#4B5563", fontWeight: 300, lineHeight: 1.6 }}>
                      你的目标首付 {fmtS(targetAmount)} ≥ 过户现金 {fmtS(cb.transaction_cash_total)}
                      ，可以放心进场看房。
                    </p>
                  </div>
                ) : (
                  <div
                    style={{ marginTop: 16, background: C.warnSoft, borderRadius: 4, padding: 16 }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.warn, marginBottom: 6 }}>
                      还差 {fmtS(cashGap)} 现金
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#4B5563",
                        fontWeight: 300,
                        marginBottom: 10,
                        lineHeight: 1.6,
                      }}
                    >
                      目标首付不足以买这档房。可选方案：
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        fontSize: 12,
                        color: "#374151",
                      }}
                    >
                      <div>
                        → 再备约 <b>{fmtS(cashGap)}</b>
                      </div>
                      <div>
                        → 降一档到 <b>{lowerTierName}</b>
                      </div>
                      <div>
                        →{" "}
                        {foreigner
                          ? "拿到 PR 后再买，ABSD 从 60% 降到 5%"
                          : "延长贷款年限 / 父母赞助补足"}
                      </div>
                    </div>
                  </div>
                ))}
            </section>

            {/* Block 3 · 买 vs 租 break-even (first property only) */}
            {isFirst ? (
              <section style={{ marginBottom: 32 }}>
                <h3 style={{ ...SECTION_TITLE, marginBottom: 4 }}>③ 那这套房买不买划算？</h3>
                <p style={{ fontSize: 12, color: C.gray500, fontWeight: 300, marginBottom: 16 }}>
                  买房 vs 继续租 + 把首付投资，哪个 {years} 年后净资产更高？
                </p>
                <div
                  style={{
                    background: "#fff",
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: 20,
                  }}
                >
                  <div style={{ marginBottom: 20 }}>
                    <InputLabel>如果不买，你打算每月花多少租房？</InputLabel>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="例如 4500"
                      value={rentDigits}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        rentEdited.current = true;
                        setRentDigits(e.target.value.replace(/[^\d]/g, ""));
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        fontFamily: SERIF,
                        fontSize: 22,
                        fontWeight: 600,
                        color: C.charcoal,
                        textAlign: "center",
                        background: "#fff",
                        boxSizing: "border-box",
                      }}
                    />
                    <p style={{ fontSize: 12, color: C.gray400, fontWeight: 300, marginTop: 8 }}>
                      默认按当前选中区间估算，直接填你的真实数字会更准。
                    </p>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <InputLabel>打算住几年？</InputLabel>
                    <SegRow
                      options={[5, 7, 10, 15].map((y) => ({ label: `${y} 年`, value: y }))}
                      value={years}
                      onChange={setYears}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <InputLabel>贷款年限</InputLabel>
                    <SegRow
                      options={[20, 25, 30].map((y) => ({ label: `${y} 年`, value: y }))}
                      value={tenure}
                      onChange={setTenure}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <InputLabel>房贷利率</InputLabel>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.charcoal }}>
                        {rate.toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.5}
                      max={4.0}
                      step={0.05}
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      style={{ width: "100%", accentColor: C.primary }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: C.gray400,
                        fontWeight: 300,
                        marginTop: 4,
                      }}
                    >
                      <span>1.5%</span>
                      <span>4.0%</span>
                    </div>
                  </div>

                  {/* Break-even bignum */}
                  <div
                    style={{
                      background: C.primarySoft,
                      borderRadius: 4,
                      padding: 20,
                      textAlign: "center",
                      marginTop: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: C.primary,
                        fontWeight: 500,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      这套房年涨 ≥
                    </div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 40,
                        fontWeight: 600,
                        color: C.primary,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {be ? (be.g_star * 100).toFixed(1) : "—"}%
                    </div>
                    <div style={{ fontSize: 12, color: C.primary, fontWeight: 500, marginTop: 8 }}>
                      {be?.clamped === "below"
                        ? "这套房即使下跌也比租划算"
                        : be?.clamped === "above"
                          ? "买才划算（这套房较难划算）"
                          : "买才比租划算"}
                    </div>
                  </div>

                  <div
                    style={{ marginTop: 16, paddingLeft: 16, borderLeft: `2px solid ${C.primary}` }}
                  >
                    <p style={{ fontSize: 12, color: "#4B5563", fontWeight: 300, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 500, color: C.charcoal }}>
                        URA PPI 2014–2024 名义年化约{" "}
                        {(result.break_even!.regional_historical * 100).toFixed(1)}
                        %（全岛均值，不代表具体项目；含通胀）
                      </span>
                      <br />
                      <span style={{ color: C.gray500 }}>
                        你怎么看未来 {years} 年这套房的涨幅？
                      </span>
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section style={{ marginBottom: 32 }}>
                <div
                  style={{
                    background: "#fff",
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: 16,
                  }}
                >
                  <p style={{ fontSize: 12, color: C.gray500, fontWeight: 300, lineHeight: 1.6 }}>
                    二套及以上不显示“买 vs 租”对比 ——
                    你的决策逻辑是投资回报率而非居住成本，建议结合租金回报率 + 增值预期单独评估。
                  </p>
                </div>
              </section>
            )}

            {/* CTA */}
            <section style={{ marginTop: 8 }}>
              {/* Lead-sharing consent — must be explicit (unchecked by default) per PDPA s.13 */}
              <label
                id="lead-consent-box"
                htmlFor="lead-consent-checkbox"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: "#FAF8F2",
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  color: C.gray500,
                  lineHeight: 1.6,
                }}
              >
                <input
                  id="lead-consent-checkbox"
                  type="checkbox"
                  checked={leadConsent}
                  onChange={(e) => setLeadConsent(e.target.checked)}
                  style={{ marginTop: 3, accentColor: C.primary, cursor: "pointer" }}
                />
                <span>
                  我同意 LionHome 与一位匹配的合作中介分享我的测算结果和联系方式，
                  仅用于本次购房咨询。详见{" "}
                  <a
                    href="/legal/data-sharing"
                    style={{ color: C.primary, textDecoration: "underline" }}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    信息分享说明
                  </a>
                  。
                </span>
              </label>
              <BtnPrimary onClick={handleWhatsApp}>找顾问帮我看这个区间的房</BtnPrimary>
              <div style={{ height: 12 }} />
              <BtnSecondary onClick={resetAll}>换一组参数再测</BtnSecondary>
            </section>

            {/* Footer note */}
            <section
              style={{ marginTop: 24, paddingLeft: 16, borderLeft: `2px solid ${C.primary}` }}
            >
              <p style={{ fontSize: 12, color: C.gray500, fontWeight: 300, lineHeight: 1.7 }}>
                基于 {RESIDENCY_LABEL[residency]} · {propsLabel} · {form.age} 岁 · 月入{" "}
                {incomeLabel} · {downPaymentLabel} 测算。
                <br />
                ABSD {Math.round(cb.absd_rate * 100)}% · LTV {Math.round(cb.ltv_cap * 100)}% · TDSR
                55% · 利率 {rate.toFixed(2)}% / 压力 4%（MAS 标准）。税率与法规以 IRAS / MAS
                最新公告为准。
              </p>
            </section>

            {/* Legal links */}
            <section
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${C.border}`,
                display: "flex",
                gap: 16,
                fontSize: 11,
                color: C.gray400,
                fontWeight: 300,
                flexWrap: "wrap",
              }}
            >
              <a
                href="/legal/terms"
                style={{ color: C.gray500, textDecoration: "underline" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                使用条款
              </a>
              <a
                href="/legal/privacy"
                style={{ color: C.gray500, textDecoration: "underline" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                隐私政策
              </a>
              <a
                href="/legal/data-sharing"
                style={{ color: C.gray500, textDecoration: "underline" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                信息分享说明
              </a>
              <span style={{ marginLeft: "auto" }}>© LionHome</span>
            </section>
          </div>
        </div>
        <Toast visible={toastVisible} />
      </>
    );
  }

  return null;
}
