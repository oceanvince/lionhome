"use client";

/**
 * Condo search page (SPEC §3 / SEARCH_TD §2.1). Search box + autocomplete,
 * sort/filter controls, result cards, and the cold_start / zero_result / none
 * fallback states. Consumes the two read APIs; no direct DB access.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ── palette (mirrors the detail page / DESIGN.md) ──────────────────── */
const C = {
  primary: "#2F4F3D",
  charcoal: "#1A1C1A",
  offwhite: "#FCFBF9",
  cream: "#F5F1E8",
  border: "#E5E5E5",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
};
const SERIF = "'Noto Serif SC', serif";
type VerdictTier = "green" | "amber" | "orange";
const VERDICT: Record<VerdictTier, { c: string; bg: string }> = {
  green: { c: "#2F6B4A", bg: "#E7F0EA" },
  amber: { c: "#B07A1E", bg: "#F7F0E0" },
  orange: { c: "#B5562A", bg: "#F7ECE4" },
};

type SortSpec = "profit" | "psf_asc" | "top_desc";

interface Card {
  slug: string;
  name: string;
  district: string | null;
  tenure: string | null;
  topYear: number | null;
  totalUnits: number | null;
  psfMin: number | null;
  psfMax: number | null;
  profitScore: number | null;
  profitConfidence: string | null;
  verdict: { tier: "green" | "amber" | "orange"; label: string; sentence: string };
}
interface Suggestion {
  slug: string;
  name: string;
  district: string | null;
}
type Fallback = "none" | "zero_result" | "cold_start";

const SORTS: { key: SortSpec; label: string }[] = [
  { key: "profit", label: "盈利分" },
  { key: "psf_asc", label: "PSF 低→高" },
  { key: "top_desc", label: "TOP 新→旧" },
];
const DISTRICTS = ["D05", "D19", "D20"]; // seed coverage; free-form also allowed

function fmtPsf(min: number | null, max: number | null) {
  if (min === null || max === null) return "暂无成交";
  return `S$${Math.round(min).toLocaleString()}–${Math.round(max).toLocaleString()} psf`;
}

function tagsOf(c: Card): string[] {
  return [
    c.tenure,
    c.topYear ? `${c.topYear} TOP` : null,
    c.totalUnits ? `${c.totalUnits} 户` : null,
  ].filter(Boolean) as string[];
}

export default function CondoSearchPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [district, setDistrict] = useState<string | null>(null);
  const [sort, setSort] = useState<SortSpec>("profit");

  const [cards, setCards] = useState<Card[]>([]);
  const [fallback, setFallback] = useState<Fallback>("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── results list (district + sort) ──────────────────────────────── */
  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ sort });
      if (district) qs.set("district", district);
      const res = await fetch(`/api/v1/condo/projects?${qs}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? "搜索暂不可用");
        setCards([]);
        return;
      }
      setCards(json.data.cards);
      setFallback(json.data.fallback ?? "none");
    } catch {
      setError("网络错误，请重试");
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [district, sort]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  /* ── autocomplete (debounced) ────────────────────────────────────── */
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/condo/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.ok) setSuggestions(json.data.results);
      } catch {
        /* autocomplete is best-effort */
      }
    }, 180);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.offwhite,
        color: C.charcoal,
        fontFamily: "'Noto Sans SC', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 80px" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, margin: "0 0 4px" }}>
          楼盘决策搜索
        </h1>
        <p style={{ color: C.gray500, fontSize: 14, margin: "0 0 24px" }}>
          搜一个盘，看它值不值得入候选 · 盈利分 + 一句话结论
        </p>

        {/* search box + autocomplete */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSug(true);
            }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="输入楼盘名 / 区（如 Gazania、D19）"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 16px",
              fontSize: 15,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "#fff",
              outline: "none",
            }}
          />
          {showSug && suggestions.length > 0 && (
            <ul
              style={{
                position: "absolute",
                zIndex: 10,
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                margin: 0,
                padding: 6,
                listStyle: "none",
                background: "#fff",
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,.08)",
              }}
            >
              {suggestions.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/condo/${s.slug}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 10px",
                      borderRadius: 7,
                      textDecoration: "none",
                      color: C.charcoal,
                      fontSize: 14,
                    }}
                  >
                    <span>{s.name}</span>
                    <span style={{ color: C.gray400 }}>{s.district}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* controls: sort + district */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
          <Segmented value={sort} onChange={setSort} options={SORTS} />
          <div style={{ display: "flex", gap: 6 }}>
            <Chip active={district === null} onClick={() => setDistrict(null)}>
              全部
            </Chip>
            {DISTRICTS.map((d) => (
              <Chip key={d} active={district === d} onClick={() => setDistrict(d)}>
                {d}
              </Chip>
            ))}
          </div>
        </div>

        {/* results */}
        {loading && <p style={{ color: C.gray500, fontSize: 14 }}>加载中…</p>}
        {!loading && error && <Notice title="搜索暂不可用" body={error} tone="warn" />}
        {!loading && !error && fallback === "cold_start" && (
          <Notice
            title="楼盘库正在建设中"
            body="收录还不够多，先按区浏览或留资，我们补齐后第一时间通知你。"
          />
        )}
        {!loading && !error && fallback === "zero_result" && (
          <Notice
            title="这个范围还没收录楼盘"
            body="换个区找找近似的？或留资，我们帮你盯着这个区的新盘。"
          />
        )}
        {!loading && !error && fallback === "none" && (
          <>
            <p style={{ color: C.gray500, fontSize: 13, margin: "0 0 12px" }}>
              {cards.length} 个楼盘
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              {cards.map((c) => (
                <ResultCard key={c.slug} card={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ── sub-components ──────────────────────────────────────────────────── */

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        gap: 3,
        background: C.cream,
        borderRadius: 9,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              padding: "7px 13px",
              fontSize: 13,
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              background: active ? "#fff" : "transparent",
              color: active ? C.primary : C.gray500,
              fontWeight: active ? 600 : 400,
              boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 12px",
        fontSize: 13,
        borderRadius: 7,
        cursor: "pointer",
        border: `1px solid ${active ? C.primary : C.border}`,
        background: active ? C.primary : "#fff",
        color: active ? "#fff" : C.charcoal,
      }}
    >
      {children}
    </button>
  );
}

function Notice({ title, body, tone }: { title: string; body: string; tone?: "warn" }) {
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 12,
        background: tone === "warn" ? "#F8EFE8" : C.cream,
        border: `1px solid ${C.border}`,
      }}
    >
      <p style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{title}</p>
      <p style={{ color: C.gray500, fontSize: 14, margin: 0 }}>{body}</p>
    </div>
  );
}

function ResultCard({ card }: { card: Card }) {
  const v = VERDICT[card.verdict.tier];
  return (
    <Link
      href={`/condo/${card.slug}`}
      style={{
        display: "block",
        padding: "18px 20px",
        borderRadius: 14,
        background: "#fff",
        border: `1px solid ${C.border}`,
        textDecoration: "none",
        color: C.charcoal,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700 }}>{card.name}</span>
            <span style={{ color: C.gray400, fontSize: 13 }}>{card.district}</span>
            <span
              style={{
                padding: "2px 9px",
                fontSize: 12,
                borderRadius: 20,
                color: v.c,
                background: v.bg,
                fontWeight: 600,
              }}
            >
              {card.verdict.label}
            </span>
          </div>
          <p style={{ color: C.gray500, fontSize: 13, margin: "8px 0 0", lineHeight: 1.6 }}>
            {card.verdict.sentence}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {tagsOf(card).map((t) => (
              <span
                key={t}
                style={{
                  padding: "3px 9px",
                  fontSize: 12,
                  borderRadius: 6,
                  background: C.cream,
                  color: C.gray500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* profit score block */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div
            style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: v.c, lineHeight: 1 }}
          >
            {card.profitScore ?? "N/A"}
          </div>
          <div style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>盈利分</div>
          {card.profitConfidence === "estimated_similar" && (
            <div style={{ fontSize: 10, color: C.gray400, marginTop: 2 }}>相似盘估算</div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: C.gray500 }}>
        {fmtPsf(card.psfMin, card.psfMax)}
      </div>
    </Link>
  );
}
