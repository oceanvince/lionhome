"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { CalcOutputs } from "@/lib/tax";
import {
  buildApiPayload,
  INCOME_BUCKETS,
  CASH_BUCKETS,
  CPF_BUCKETS,
  DEBT_BUCKETS,
  isForeigner,
} from "@/lib/calculator/bucket-maps";
import type {
  CalculatorFormState,
  ResidencyOption,
  PropertyPurpose,
  PropertyTypePref,
  Timeline,
  LoanTenure,
} from "@/lib/calculator/form-types";
import { INITIAL_FORM } from "@/lib/calculator/form-types";

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────── */

function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
function fmtS(n: number) {
  return `S$ ${fmt(n)}`;
}
function monthlyMortgage(P: number, annualRate: number, years: number) {
  if (P <= 0) return 0;
  if (annualRate === 0) return P / (years * 12);
  const i = annualRate / 12;
  const N = years * 12;
  return (P * i * Math.pow(1 + i, N)) / (Math.pow(1 + i, N) - 1);
}

/* ─────────────────────────────────────────────────────────────────────
   PRIMITIVES — matching prototype classes exactly
───────────────────────────────────────────────────────────────────── */

/** btn-primary */
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
      className="btn-primary"
      style={{
        width: "100%",
        background: "#2F4F3D",
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
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** btn-secondary */
function BtnSecondary({
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
        background: "#fff",
        color: "#1A1C1A",
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
        border: "1px solid #E5E5E5",
        transition: "background 0.15s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** back button — step-back-btn */
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
        border: "1px solid #E5E5E5",
        borderRadius: "50%",
        background: "transparent",
        color: "#1A1C1A",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {/* ph-thin ph-arrow-left equivalent */}
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

/** identity card */
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
        border: `1px solid ${selected ? "#2F4F3D" : "#E5E5E5"}`,
        borderRadius: 4,
        background: selected ? "#EAEFEB" : "#fff",
        boxShadow: selected ? "0 0 0 1px #2F4F3D" : "none",
        cursor: "pointer",
        minHeight: 88,
        transition: "all 0.15s",
        textAlign: "left",
      }}
    >
      <span
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: selected ? "#2F4F3D" : "#1A1C1A",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 300,
          color: "#6B7280",
          marginTop: 2,
        }}
      >
        {sub}
      </span>
    </div>
  );
}

/** radio card */
function RadioCard({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
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
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        border: `1px solid ${selected ? "#2F4F3D" : "#E5E5E5"}`,
        borderRadius: 4,
        background: selected ? "#EAEFEB" : "#fff",
        boxShadow: selected ? "0 0 0 1px #2F4F3D" : "none",
        cursor: "pointer",
        minHeight: 56,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 16, color: "#1A1C1A" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 300, color: "#9CA3AF" }}>{sub}</span>
    </div>
  );
}

/** segmented control */
function SegWrap<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "#F3F4F6",
        borderRadius: 4,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              background: active ? "#fff" : "transparent",
              color: active ? "#2F4F3D" : "#6B7280",
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

/* ─────────────────────────────────────────────────────────────────────
   SCROLL PICKER
   All structural styles are inline to avoid Tailwind v4 box-sizing
   interference. The ::before/::after selection lines become real <div>s.
   Items keep CSS classes for .is-center toggle via imperative DOM.
───────────────────────────────────────────────────────────────────── */

function ScrollPicker({
  items,
  selectedIndex,
  onChange,
  suffix,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
  suffix?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const ITEM_H = 60; // fallback; actual height read from DOM where possible

  // Read the rendered height of the first picker-item (inline height wins over CSS class).
  // Using actual DOM height prevents ITEM_H mismatch from causing wrong snap corrections.
  function itemHeight(el: HTMLElement): number {
    return (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? ITEM_H;
  }

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // rAF: layout is complete, offsetHeight is valid
    requestAnimationFrame(() => {
      const h = itemHeight(list);
      list.scrollTop = selectedIndex * h;
      markCenter(list, selectedIndex);
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markCenter(el: HTMLElement, idx: number) {
    el.querySelectorAll(".picker-item").forEach((item, i) => {
      item.classList.toggle("is-center", i === idx);
    });
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const h = itemHeight(el);
    const idx = Math.round(el.scrollTop / h);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    markCenter(el, clamped);

    // Do NOT manually scrollTo here — scroll-snap-type:y mandatory handles centering.
    // We only need to fire onChange after the snap settles.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(clamped), 200);
  }

  return (
    <div
      style={{
        position: "relative",
        height: 220,
        maxWidth: 240,
        marginLeft: "auto",
        marginRight: "auto",
        overflow: "hidden",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)",
      }}
    >
      {/* Selection band lines — ±30px = ITEM_H/2 = 60/2 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(50% - 30px)",
          height: 1,
          background: "#E5E5E5",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(50% + 30px)",
          height: 1,
          background: "#E5E5E5",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Scrollable list.
          height: 220, padding: 80px → content area = 60px = ITEM_H (border-box).
          maxScrollTop = (n−1)×60, every item reachable.
          Items also get height inline to guarantee it regardless of CSS class resolution. */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          height: 220,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          padding: "80px 0",
          overscrollBehavior: "contain",
        } as React.CSSProperties}
      >
        {items.map((label, i) => (
          <div
            key={i}
            className="picker-item"
            style={{
              height: ITEM_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
            } as React.CSSProperties}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Suffix label */}
      {suffix && (
        <span
          style={{
            position: "absolute",
            top: "calc(50% - 12px)",
            right: 16,
            fontSize: 13,
            color: "#9CA3AF",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   INPUT LABEL — text-xs font-medium text-gray-500 mb-3 (no uppercase)
───────────────────────────────────────────────────────────────────── */

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 500,
        color: "#6B7280",
        marginBottom: 12,
      }}
    >
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   BRAND LOGO
───────────────────────────────────────────────────────────────────── */

function BrandLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3 L20 8 V19 C20 19.6 19.6 20 19 20 H5 C4.4 20 4 19.6 4 19 V8 Z"
          stroke="#2F4F3D"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8 20 V13 H16 V20" stroke="#2F4F3D" strokeWidth="1.5" />
      </svg>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#1A1C1A",
          letterSpacing: "0.05em",
        }}
      >
        狮城家 LionHome
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CONSULT DRAWER — matches prototype's 即刻咨询 drawer
───────────────────────────────────────────────────────────────────── */

function ConsultDrawer({
  open,
  onClose,
  outputs,
  sessionId,
  taxRatesVersion,
  runId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  outputs: CalcOutputs | null;
  sessionId: string;
  taxRatesVersion: string;
  runId: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    if (!name || !phone) {
      alert("请填写姓名和手机号");
      return;
    }
    const fullPhone = phone.startsWith("+") ? phone : `+65${phone}`;

    // Link layer1 contact info to the already-saved run (non-blocking)
    if (outputs) {
      const storedInputs = (() => {
        try {
          return JSON.parse(sessionStorage.getItem("lh_calc_inputs") ?? "{}");
        } catch {
          return {};
        }
      })();
      fetch("/api/v1/calculator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: storedInputs,
          outputs,
          tax_rates_version: taxRatesVersion,
          session_id: sessionId,
          ...(runId ? { run_id: runId } : {}),
          layer1: { name, phone: fullPhone },
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            try {
              localStorage.setItem("lh_run_id", data.data.run_id);
            } catch { /* ignore */ }
          }
        })
        .catch(() => { /* ignore */ });
    }

    onClose();
    setName("");
    setPhone("");
    setMessage("");
    onSuccess();
  }

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(26,28,26,0.4)",
          backdropFilter: "blur(4px)",
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderRadius: "16px 16px 0 0",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontFamily: "'Noto Serif SC', serif",
                fontSize: 20,
                fontWeight: 600,
                color: "#1A1C1A",
              }}
            >
              即刻咨询
            </h3>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9CA3AF",
                fontSize: 24,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          <p
            style={{
              fontSize: 14,
              fontWeight: 300,
              color: "#6B7280",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            留下您的联系方式，理财顾问将在 24 小时内联系您解读测算结果。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <InputLabel>您的称呼</InputLabel>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：陈先生"
                style={{
                  width: "100%",
                  borderBottom: "1px solid #E5E5E5",
                  padding: "12px 0",
                  fontSize: 16,
                  outline: "none",
                  fontFamily: "inherit",
                  background: "transparent",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <InputLabel>手机号码</InputLabel>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    borderBottom: "1px solid #E5E5E5",
                    padding: "12px 8px 12px 0",
                    fontSize: 16,
                    color: "#6B7280",
                  }}
                >
                  +65
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="8123 4567"
                  style={{
                    flex: 1,
                    borderBottom: "1px solid #E5E5E5",
                    padding: "12px 0",
                    fontSize: 16,
                    outline: "none",
                    fontFamily: "inherit",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            <div>
              <InputLabel>留言（可选）</InputLabel>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="例如：希望了解 PR 二套购房策略"
                style={{
                  width: "100%",
                  border: "1px solid #E5E5E5",
                  borderRadius: 4,
                  padding: "8px 12px",
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <BtnPrimary onClick={handleSubmit} disabled={!name || !phone}>
              提交
            </BtnPrimary>
          </div>

          <p
            style={{
              fontSize: 11,
              fontWeight: 300,
              color: "#9CA3AF",
              textAlign: "center",
              marginTop: 16,
              lineHeight: 1.6,
            }}
          >
            提交即表示您同意我们的隐私政策。
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   INFO MODAL
───────────────────────────────────────────────────────────────────── */

function InfoModal({
  info,
  onClose,
}: {
  info: { title: string; body: string } | null;
  onClose: () => void;
}) {
  if (!info) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(26,28,26,0.4)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "88%",
          maxWidth: 360,
          background: "#fff",
          borderRadius: 6,
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 16,
              fontWeight: 600,
              color: "#1A1C1A",
            }}
          >
            {info.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9CA3AF",
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
              marginLeft: 8,
            }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 14, fontWeight: 300, color: "#4B5563", lineHeight: 1.7 }}>
          {info.body}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────────── */

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
        background: "#1A1C1A",
        color: "#fff",
        fontSize: 14,
        padding: "12px 20px",
        borderRadius: 4,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      ✓ 提交成功，顾问将在 24 小时内联系您
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────── */

type View = "hero" | "step1" | "step2" | "step3" | "loading" | "result";

const AGE_ITEMS = Array.from({ length: 45 }, (_, i) => String(21 + i));
const LOADING_TEXTS = [
  "计算最新政策下的印花税 (ABSD)...",
  "测算最高贷款成数 (LTV)...",
  "评估总偿债比率 (TDSR)...",
  "生成预算区间...",
];

// Shared page container style for step pages
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

// Section title (h4 in result page)
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#1A1C1A",
  marginBottom: 16,
  letterSpacing: "0.025em",
  fontFamily: "'Noto Serif SC', serif",
};

export default function CalculatorPage() {
  const [view, setView] = useState<View>("hero");
  const [form, setForm] = useState<CalculatorFormState>(INITIAL_FORM);
  const [ageBucket, setAgeBucket] = useState(14); // age 35
  const [outputs, setOutputs] = useState<CalcOutputs | null>(null);
  const [taxVersion, setTaxVersion] = useState("");
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [displayRate, setDisplayRate] = useState(1.65);
  const [calcTenure, setCalcTenure] = useState(25);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [info, setInfo] = useState<{ title: string; body: string } | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [runId, setRunId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(
    <K extends keyof CalculatorFormState>(key: K, val: CalculatorFormState[K]) =>
      setForm((f) => ({ ...f, [key]: val })),
    []
  );

  function showToast() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  function goTo(v: View) {
    setView(v);
    window.scrollTo(0, 0);
  }

  /* ─── Submit ─────────────────────────────────────────────────── */
  async function handleSubmit() {
    goTo("loading");
    setLoadingIdx(0);
    const interval = setInterval(
      () => setLoadingIdx((i) => Math.min(i + 1, LOADING_TEXTS.length - 1)),
      800
    );

    const payload = buildApiPayload({ ...form, age: 21 + ageBucket });

    try {
      const res = await fetch("/api/v1/calculator/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      clearInterval(interval);

      if (json.ok) {
        setOutputs(json.data.outputs);
        setTaxVersion(json.data.tax_rates_version);
        setCalcTenure(form.tenure);
        try {
          sessionStorage.setItem("lh_calc_outputs", JSON.stringify(json.data.outputs));
          sessionStorage.setItem("lh_calc_inputs", JSON.stringify(payload));
          sessionStorage.setItem("lh_tax_version", json.data.tax_rates_version);
          sessionStorage.setItem("lh_session_id", sessionId);
        } catch { /* ignore */ }
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

  /* ─── Save report to DB, return run_id ─────────────────────── */
  async function saveReport(): Promise<string | null> {
    if (!outputs) return null;
    setSaving(true);
    try {
      const storedInputs = (() => {
        try { return JSON.parse(sessionStorage.getItem("lh_calc_inputs") ?? "{}"); }
        catch { return {}; }
      })();
      const res = await fetch("/api/v1/calculator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: storedInputs,
          outputs,
          tax_rates_version: taxVersion,
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const id = data.data.run_id as string;
        setRunId(id);
        try { localStorage.setItem("lh_run_id", id); } catch { /* ignore */ }
        return id;
      }
      return null;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }

  /* ─── WhatsApp CTA: save first, then open with run_id ───────── */
  async function handleWhatsAppCTA() {
    if (!outputs) return;
    const id = runId ?? await saveReport();
    const text = id
      ? `Hi 狮城家，我的报告编号是 ${id}，请帮我生成定制购房参考报告。`
      : `Hi 狮城家，请帮我生成一份定制购房参考报告。`;
    window.open(
      `https://api.whatsapp.com/send?phone=6580565348&text=${encodeURIComponent(text)}`,
      "_blank"
    );
  }

  /* ─── Consult CTA: save first, then open drawer ─────────────── */
  async function handleConsultCTA() {
    if (!outputs) return;
    if (!runId) await saveReport();
    setConsultOpen(true);
  }

  /* ─── RESULT computed values ────────────────────────────────── */
  const price = outputs?.max_price ?? 0;
  const loan = outputs?.loan_amount ?? 0;
  const rate = displayRate / 100;
  const monthlyBase = Math.round(monthlyMortgage(loan, rate, calcTenure));
  const monthlyStress = Math.round(monthlyMortgage(loan, 0.04, calcTenure));
  const totalInterest = Math.round(monthlyBase * calcTenure * 12 - loan);
  const cash5 = Math.round(price * 0.05);
  const downCpf = outputs?.down_payment.cpf ?? 0;
  const downCash = outputs?.down_payment.cash ?? 0;
  const cashExtra = Math.max(0, downCash - cash5);
  const feesTotal =
    (outputs?.bsd ?? 0) + (outputs?.absd ?? 0) + 500 + (outputs?.legal_fees_est ?? 0);
  const absdRate = outputs?.absd_rate ?? 0;

  /* ═══════════════════════════════════════════════════════════════
     VIEWS
  ═══════════════════════════════════════════════════════════════ */

  /* ── HERO ──────────────────────────────────────────────────── */
  if (view === "hero") {
    return (
      <div
        key="hero"
        className="calc-view-enter"
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
          background: "#FCFBF9",
          // no horizontal padding at root level (matches prototype)
        }}
      >
        {/* Top brand strip */}
        <div
          style={{
            flexShrink: 0,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: "max(20px, env(safe-area-inset-top))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <BrandLogo />
        </div>

        {/* Visual hero block (cream) */}
        <div
          style={{
            flexShrink: 0,
            padding: "48px 20px 40px",
            marginTop: 24,
            marginLeft: 20,
            marginRight: 20,
            borderRadius: 6,
            position: "relative",
            overflow: "hidden",
            background: "#F5F1E8",
          }}
        >
          {/* Decorative circles */}
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              opacity: 0.3,
            }}
          >
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="#2F4F3D" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="26" stroke="#2F4F3D" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="14" stroke="#2F4F3D" strokeWidth="0.5" />
            </svg>
          </div>

          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#2F4F3D",
              fontWeight: 500,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            购房力测算
          </p>
          <h1
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontWeight: 600,
              color: "#1A1C1A",
              lineHeight: 1.05,
              fontSize: 38,
              marginBottom: 16,
            }}
          >
            我的购房
            <br />
            预算是多少？
          </h1>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 300 }}>3 分钟测算</span>
            <span
              style={{ width: 4, height: 4, borderRadius: "50%", background: "#D1D5DB" }}
            />
            <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 300 }}>无需注册</span>
          </div>
        </div>

        {/* Value bullets */}
        <div
          style={{
            flex: 1,
            paddingLeft: 28,
            paddingRight: 28,
            paddingTop: 32,
            paddingBottom: 8,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {[
            { title: "精确到税金", sub: "基于 IRAS 最新 BSD/ABSD 累进税率" },
            { title: "考虑您的真实身份", sub: "PR 二套、外籍首套，税率天差地别" },
            { title: "压力测试 +2pp", sub: "看清未来利率波动下的真实月供" },
          ].map(({ title, sub }) => (
            <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#EAEFEB",
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
                    stroke="#2F4F3D"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div
                  style={{ fontSize: 14, fontWeight: 500, color: "#1A1C1A", marginBottom: 2 }}
                >
                  {title}
                </div>
                <div
                  style={{ fontSize: 12, color: "#6B7280", fontWeight: 300, lineHeight: 1.6 }}
                >
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            flexShrink: 0,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 16,
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          }}
        >
          <BtnPrimary onClick={() => goTo("step1")}>开始测算</BtnPrimary>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 12,
              color: "#9CA3AF",
              marginTop: 12,
              fontWeight: 300,
            }}
          >
            {/* lock icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>您的数据已被加密处理</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 1 — 个人信息 ──────────────────────────────────────── */
  if (view === "step1") {
    const showCpfHide = isForeigner(form.residency);
    void showCpfHide; // used in step2
    return (
      <div key="step1" className="calc-view-enter" style={STEP_PAGE}>
        {/* Step header */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <BackBtn onClick={() => goTo("hero")} />
          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.1em",
              color: "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            步骤 1 / 3 · 个人信息
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 24,
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: 8,
              color: "#1A1C1A",
            }}
          >
            关于您的身份
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#6B7280",
              marginBottom: 28,
              fontWeight: 300,
            }}
          >
            这三项决定您的印花税率和贷款成数。
          </p>

          {/* Residency */}
          <div style={{ marginBottom: 24 }}>
            <InputLabel>主申请人身份</InputLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(
                [
                  { value: "sc", title: "新加坡公民", sub: "ABSD 0% 起" },
                  { value: "pr", title: "永久居民 (PR)", sub: "ABSD 5% 起" },
                  {
                    value: "foreigner_wp",
                    title: "外籍·有工作许可",
                    sub: "EP/SP/WP/DP · ABSD 60%",
                  },
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

          {/* Age picker */}
          <div style={{ marginTop: 28, marginBottom: 24 }}>
            <InputLabel>主申请人年龄</InputLabel>
            <ScrollPicker
              items={AGE_ITEMS}
              selectedIndex={ageBucket}
              onChange={setAgeBucket}
              suffix="岁"
            />
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, fontWeight: 300 }}>
              年龄 + 贷款年限 ≤ 65 时可享 75% LTV。
            </p>
          </div>

          {/* Existing properties */}
          <div style={{ marginTop: 28 }}>
            <InputLabel>目前持有住宅数（含全球）</InputLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(
                [
                  { value: 0 as const, label: "0 套", sub: "首次置业" },
                  { value: 1 as const, label: "1 套", sub: "第二套买家" },
                  { value: 2 as const, label: "2 套及以上", sub: "多套持有" },
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
        </div>

        <div style={{ marginTop: 24, paddingTop: 16 }}>
          <BtnPrimary onClick={() => goTo("step2")}>下一步</BtnPrimary>
        </div>
      </div>
    );
  }

  /* ── STEP 2 — 收入情况 ──────────────────────────────────────── */
  if (view === "step2") {
    const hideCpf = isForeigner(form.residency);
    return (
      <div key="step2" className="calc-view-enter" style={STEP_PAGE}>
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <BackBtn onClick={() => goTo("step1")} />
          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.1em",
              color: "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            步骤 2 / 3 · 收入情况
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 24,
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: 8,
              color: "#1A1C1A",
            }}
          >
            您的收入与资产
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, fontWeight: 300 }}>
            用于测算贷款额度与首付能力。
          </p>

          <div style={{ marginBottom: 24 }}>
            <InputLabel>家庭年税前总收入（含花红）</InputLabel>
            <ScrollPicker
              items={INCOME_BUCKETS.map((b) => b.label)}
              selectedIndex={form.incomeBucket}
              onChange={(i) => setField("incomeBucket", i)}
            />
          </div>

          <div style={{ marginTop: 28, marginBottom: 24 }}>
            <InputLabel>可动用现金存款（不含 CPF）</InputLabel>
            <ScrollPicker
              items={CASH_BUCKETS.map((b) => b.label)}
              selectedIndex={form.cashBucket}
              onChange={(i) => setField("cashBucket", i)}
            />
          </div>

          {!hideCpf && (
            <div style={{ marginTop: 28, marginBottom: 24 }}>
              <InputLabel>CPF 普通户头 (OA) 余额</InputLabel>
              <ScrollPicker
                items={CPF_BUCKETS.map((b) => b.label)}
                selectedIndex={form.cpfBucket}
                onChange={(i) => setField("cpfBucket", i)}
              />
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, fontWeight: 300 }}>
                私宅至少 5% 须以现金支付，余下可由 CPF 补足。
              </p>
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <InputLabel>每月固定债务还款（车贷 / 卡 min / 学生贷）</InputLabel>
            <ScrollPicker
              items={DEBT_BUCKETS.map((b) => b.label)}
              selectedIndex={form.debtBucket}
              onChange={(i) => setField("debtBucket", i)}
            />
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16 }}>
          <BtnPrimary onClick={() => goTo("step3")}>下一步</BtnPrimary>
        </div>
      </div>
    );
  }

  /* ── STEP 3 — 买房预期 ──────────────────────────────────────── */
  if (view === "step3") {
    return (
      <div key="step3" className="calc-view-enter" style={STEP_PAGE}>
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <BackBtn onClick={() => goTo("step2")} />
          <span
            style={{
              fontSize: 12,
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.1em",
              color: "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            步骤 3 / 3 · 买房预期
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 24,
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: 8,
              color: "#1A1C1A",
            }}
          >
            您的购房计划
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, fontWeight: 300 }}>
            帮助我们理解您的购房动机。
          </p>

          {/* Purpose */}
          <div style={{ marginBottom: 24 }}>
            <InputLabel>购房目的</InputLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(
                [
                  { value: "self", label: "自住", sub: "家人居住" },
                  { value: "invest", label: "投资", sub: "出租或资本增值" },
                  {
                    value: "upgrade",
                    label: "升级换房",
                    sub: "出售现有住宅，购置更大/更好的房产",
                  },
                ] as { value: PropertyPurpose; label: string; sub: string }[]
              ).map(({ value, label, sub }) => (
                <RadioCard
                  key={value}
                  label={label}
                  sub={sub}
                  selected={form.purpose === value}
                  onClick={() => setField("purpose", value)}
                />
              ))}
            </div>
          </div>

          {/* Property type */}
          <div style={{ marginTop: 28, marginBottom: 24 }}>
            <InputLabel>房产类型偏好</InputLabel>
            <SegWrap<PropertyTypePref>
              options={[
                { label: "新楼盘", value: "new_launch" },
                { label: "二手房", value: "resale" },
                { label: "两者均可", value: "either" },
              ]}
              value={form.propertyType}
              onChange={(v) => setField("propertyType", v)}
            />
          </div>

          {/* Timeline */}
          <div style={{ marginTop: 28, marginBottom: 24 }}>
            <InputLabel>购入预期时间</InputLabel>
            <SegWrap<Timeline>
              options={[
                { label: "3 个月内", value: "3m" },
                { label: "6 个月内", value: "6m" },
                { label: "1 年内", value: "1y" },
                { label: "仅了解", value: "explore" },
              ]}
              value={form.timeline}
              onChange={(v) => setField("timeline", v)}
            />
          </div>

          {/* Tenure */}
          <div style={{ marginTop: 28 }}>
            <InputLabel>期望贷款年限</InputLabel>
            <SegWrap<string>
              options={[
                { label: "20 年", value: "20" },
                { label: "25 年", value: "25" },
                { label: "30 年", value: "30" },
              ]}
              value={String(form.tenure)}
              onChange={(v) => setField("tenure", Number(v) as LoanTenure)}
            />
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, fontWeight: 300 }}>
              年龄 + 年限 ≤ 65 时可享 75% LTV。
            </p>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16 }}>
          <BtnPrimary onClick={handleSubmit}>生成评估报告</BtnPrimary>
        </div>
      </div>
    );
  }

  /* ── LOADING ────────────────────────────────────────────────── */
  if (view === "loading") {
    return (
      <div
        key="loading"
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ position: "relative", width: 64, height: 64, marginBottom: 28 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid #E5E5E5",
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid #2F4F3D",
                borderTop: "1px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
          <h3
            style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 8,
              color: "#1A1C1A",
            }}
          >
            正在深度测算
          </h3>
          <p style={{ fontSize: 14, color: "#6B7280", fontWeight: 300 }}>
            {LOADING_TEXTS[loadingIdx]}
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── RESULT ─────────────────────────────────────────────────── */
  if (view === "result" && outputs) {
    const ltvPct = Math.round((outputs.ltv_cap ?? 0.75) * 100);

    return (
      <>
        <div
          key="result"
          className="calc-view-enter"
          style={{
            width: "100%",
            maxWidth: 430,
            margin: "0 auto",
            background: "#FCFBF9",
            minHeight: "100dvh",
            // NO padding — all sections handle their own
          }}
        >
          {/* Hero cream — NO back button, matches prototype */}
          <div
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 32,
              paddingTop: "max(48px, env(safe-area-inset-top))",
              background: "#F5F1E8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "#2F4F3D",
                fontWeight: 500,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              您的购房参考预算
            </div>
            <div
              style={{
                fontFamily: "'Noto Serif SC', serif",
                fontWeight: 600,
                color: "#1A1C1A",
                lineHeight: 1.2,
                fontSize: 38,
                whiteSpace: "nowrap",
              }}
            >
              S$&nbsp;{fmt(price)}
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#6B7280",
                fontWeight: 300,
              }}
            >
              基于您的输入测算，仅作初步参考
            </div>
          </div>

          {/* Body — scrolls under sticky footer */}
          <div
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 28,
              paddingBottom: 160, // space for sticky footer
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* 房产成本明细 */}
            <section>
              <h4 style={SECTION_TITLE}>房产成本明细</h4>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: 4,
                  padding: 20,
                  fontSize: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* 房屋单价 */}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6B7280", fontWeight: 300 }}>房屋单价</span>
                  <span style={{ fontWeight: 500, color: "#1A1C1A" }}>{fmtS(price)}</span>
                </div>

                {/* 首付 */}
                <div style={{ borderTop: "1px solid #E5E5E5", paddingTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#1A1C1A" }}>首付（含 CPF）</span>
                    <span style={{ fontWeight: 500, color: "#1A1C1A" }}>
                      {fmtS(downCash + downCpf)}
                    </span>
                  </div>
                  <div
                    style={{
                      paddingLeft: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}>
                      <span>5% 现金（必须）</span>
                      <span>{fmtS(cash5)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}>
                      <span>CPF OA 可付</span>
                      <span>{fmtS(downCpf)}</span>
                    </div>
                    {cashExtra > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          color: "#6B7280",
                        }}
                      >
                        <span>现金补充</span>
                        <span>{fmtS(cashExtra)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 税费 */}
                <div style={{ borderTop: "1px solid #E5E5E5", paddingTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "#1A1C1A" }}>税费</span>
                    <span style={{ fontWeight: 500, color: "#1A1C1A" }}>{fmtS(feesTotal)}</span>
                  </div>
                  <div
                    style={{
                      paddingLeft: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}
                    >
                      <span>BSD 买方印花税</span>
                      <span>{fmtS(outputs.bsd)}</span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}
                    >
                      <span>ABSD 额外印花税</span>
                      <span>{fmtS(outputs.absd)}</span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}
                    >
                      <span>抵押印花</span>
                      <span>S$ 500</span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", color: "#6B7280" }}
                    >
                      <span>律师 + 估价</span>
                      <span>{fmtS(outputs.legal_fees_est)}</span>
                    </div>
                  </div>
                </div>

                {/* 贷款本金 */}
                <div
                  style={{
                    borderTop: "1px solid #E5E5E5",
                    paddingTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontWeight: 500, color: "#1A1C1A" }}>
                    贷款本金 ({ltvPct}% LTV)
                  </span>
                  <span style={{ fontWeight: 500, color: "#1A1C1A" }}>{fmtS(loan)}</span>
                </div>

                {/* 利息总支出 */}
                <div
                  style={{
                    borderTop: "1px solid #E5E5E5",
                    paddingTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontWeight: 500, color: "#1A1C1A" }}>利息总支出</span>
                  <span style={{ fontWeight: 500, color: "#1A1C1A" }}>{fmtS(totalInterest)}</span>
                </div>

                {/* 总成本 */}
                <div
                  style={{
                    borderTop: "1px solid #E5E5E5",
                    paddingTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 16,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#1A1C1A" }}>总成本</span>
                  <span style={{ fontWeight: 600, color: "#2F4F3D" }}>
                    {fmtS(price + feesTotal + totalInterest)}
                  </span>
                </div>
              </div>
            </section>

            {/* 月供试算器 */}
            <section>
              <h4 style={SECTION_TITLE}>月供试算器</h4>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: 4,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {/* 利率 */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 8,
                    }}
                  >
                    <label style={{ fontSize: 12, color: "#6B7280", fontWeight: 300 }}>
                      利率（年化）
                      <button
                        onClick={() =>
                          setInfo({
                            title: "利率说明",
                            body: "我们使用 2026 年 5 月新加坡三大银行（DBS/OCBC/UOB）公寓首套房贷的市场平均利率作为估算基准。您的实际利率会根据贷款金额、个人信用、银行促销等因素有所不同，通常浮动在 1.40% - 1.85% 之间。",
                          })
                        }
                        style={{
                          fontSize: 10,
                          color: "#2F4F3D",
                          textDecoration: "underline",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          marginLeft: 4,
                        }}
                      >
                        说明
                      </button>
                    </label>
                    <span
                      style={{
                        fontFamily: "'Noto Serif SC', serif",
                        fontWeight: 600,
                        color: "#1A1C1A",
                        fontSize: 18,
                      }}
                    >
                      {displayRate.toFixed(2)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.4}
                    max={1.85}
                    step={0.05}
                    value={displayRate}
                    onChange={(e) => setDisplayRate(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#2F4F3D", cursor: "pointer" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: "#9CA3AF",
                      fontWeight: 300,
                      marginTop: 4,
                    }}
                  >
                    <span>1.40%</span>
                    <span>1.85%</span>
                  </div>
                </div>

                {/* 贷款年限 */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 8,
                    }}
                  >
                    <label style={{ fontSize: 12, color: "#6B7280", fontWeight: 300 }}>
                      贷款年限
                    </label>
                    <span
                      style={{
                        fontFamily: "'Noto Serif SC', serif",
                        fontWeight: 600,
                        color: "#1A1C1A",
                        fontSize: 18,
                      }}
                    >
                      {calcTenure} 年
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={calcTenure}
                    onChange={(e) => setCalcTenure(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#2F4F3D", cursor: "pointer" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: "#9CA3AF",
                      fontWeight: 300,
                      marginTop: 4,
                    }}
                  >
                    <span>5 年</span>
                    <span>30 年</span>
                  </div>
                </div>

                {/* 月供 */}
                <div style={{ borderTop: "1px solid #E5E5E5", paddingTop: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 300 }}>
                      预估月供
                    </span>
                    <div>
                      <span
                        style={{
                          fontFamily: "'Noto Serif SC', serif",
                          fontWeight: 600,
                          color: "#1A1C1A",
                          fontSize: 24,
                        }}
                      >
                        S$&nbsp;{fmt(monthlyBase)}
                      </span>
                      <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 300, marginLeft: 4 }}>
                        / 月
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 300 }}>
                    ⓘ 实际批贷以 4% 压力测试月供{" "}
                    <span style={{ color: "#1A1C1A" }}>S$ {fmt(monthlyStress)}</span> 为准 (MAS 要求){" "}
                    <button
                      onClick={() =>
                        setInfo({
                          title: "为何按 4% 压力测试？",
                          body: "新加坡金管局 (MAS) 要求所有银行批贷时使用 4% 中期压力利率测算 TDSR (总偿债比率上限 55%)。本工具的参考预算基于此压力测试，以确保您的预算在利率上行时仍可承担。当前显示月供基于实际市场利率，仅作直观参考。",
                        })
                      }
                      style={{
                        fontSize: 10,
                        color: "#2F4F3D",
                        textDecoration: "underline",
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                      }}
                    >
                      详细
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 付款时间表 accordion */}
            <section>
              <button
                onClick={() => setScheduleOpen(!scheduleOpen)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1C1A" }}>
                  📅 完整付款时间表
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    transform: scheduleOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="#1A1C1A"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {scheduleOpen && (
                <div
                  style={{
                    marginTop: 12,
                    background: "#fff",
                    border: "1px solid #E5E5E5",
                    borderRadius: 4,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    fontSize: 14,
                  }}
                >
                  {[
                    {
                      day: "DAY 0",
                      title: "选定房 · OTP 定金",
                      body: `现金 1% = ${fmtS(Math.round(price * 0.01))}。卖方签发购房意向书 (OTP)，您锁定房产 14 天。`,
                    },
                    {
                      day: "DAY 14",
                      title: "行使 OTP · 现金 + 印花税",
                      body: `现金 4% = ${fmtS(Math.round(price * 0.04))}，BSD ${fmtS(outputs.bsd)}，ABSD ${fmtS(outputs.absd)}。共需现金约 ${fmtS(Math.round(price * 0.04) + outputs.bsd + outputs.absd)}。`,
                    },
                    {
                      day: "2-3 月内",
                      title: "完成贷款审批 · 律师交接",
                      body: `银行审核您的 TDSR/LTV，律师协助过户。律师 + 估价费 ~${fmtS(outputs.legal_fees_est)}。`,
                    },
                    {
                      day: "交房",
                      title: "余款支付 · 钥匙交付",
                      body: `CPF OA ${fmtS(downCpf)} 转付 + 现金补充 ${fmtS(cashExtra)} + 贷款 ${fmtS(loan)}。开始月供 ${fmtS(monthlyBase)}。`,
                    },
                  ].map(({ day, title, body }, idx) => (
                    <div
                      key={day}
                      style={{
                        display: "flex",
                        gap: 12,
                        ...(idx > 0
                          ? { borderTop: "1px solid #E5E5E5", paddingTop: 16 }
                          : {}),
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.1em",
                          color: "#2F4F3D",
                          fontWeight: 500,
                          paddingTop: 2,
                          width: 64,
                          flexShrink: 0,
                        }}
                      >
                        {day}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            color: "#1A1C1A",
                            marginBottom: 4,
                          }}
                        >
                          {title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6B7280",
                            fontWeight: 300,
                            lineHeight: 1.6,
                          }}
                        >
                          {body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Identity-specific note */}
            <section
              style={{
                borderLeft: "2px solid #2F4F3D",
                paddingLeft: 16,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <p style={{ fontSize: 12, color: "#6B7280", fontWeight: 300, lineHeight: 1.7 }}>
                {absdRate === 0
                  ? "作为新加坡公民首次置业，您无需缴纳 ABSD，享有最优贷款条件。"
                  : absdRate === 0.05
                    ? "作为 PR 首次置业，您的 ABSD 为 5%。若您与外籍配偶联名购买首套主居所，可申请 ABSD 退税，详情请咨询顾问。"
                    : `您的 ABSD 税率为 ${Math.round(absdRate * 100)}%，建议在购房前充分了解税费影响并咨询专业顾问。`}
              </p>
            </section>
          </div>

          {/* Footer CTAs — sticky bottom-0, matches prototype */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 20,
              padding: "16px 20px",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              background: "#fff",
              borderTop: "1px solid #E5E5E5",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Primary: 保存并获取定制报告 → save to DB then open WhatsApp with run_id */}
            <BtnPrimary onClick={handleWhatsAppCTA} disabled={saving}>
              {saving ? "保存中…" : "保存并获取定制报告"}
            </BtnPrimary>
            {/* Secondary: 即刻咨询 → save to DB then open consult drawer */}
            <BtnSecondary onClick={handleConsultCTA} disabled={saving}>即刻咨询</BtnSecondary>
          </div>
        </div>

        {/* Overlays */}
        <ConsultDrawer
          open={consultOpen}
          onClose={() => setConsultOpen(false)}
          outputs={outputs}
          sessionId={sessionId}
          taxRatesVersion={taxVersion}
          runId={runId}
          onSuccess={showToast}
        />
        <InfoModal info={info} onClose={() => setInfo(null)} />
        <Toast visible={toastVisible} />
      </>
    );
  }

  return null;
}
