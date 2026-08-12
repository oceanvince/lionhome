"use client";

import { useCallback, useEffect, useState } from "react";

/** Where the admin key lives. Browser-local only — never sent in a URL. */
const KEY_STORAGE = "lh_admin_key";

const WINDOWS = [7, 30, 90, 365] as const;

/**
 * Palette. `@theme` in globals.css replaces Tailwind's default color set, so
 * utilities like `bg-emerald-800` / `text-neutral-600` generate nothing here.
 * Colors are applied inline against the project's own design tokens instead.
 */
const C = {
  primary: "#2F4F3D",
  charcoal: "#1A1C1A",
  border: "#E5E5E5",
  track: "#F0F0EE",
  gray600: "#4B5563",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  warnBg: "#F8EFE8",
  warnText: "#8B3A1F",
  legacyBg: "#F5F1E8",
};

type Bucket = { label: string; count: number };

type RecentRun = {
  id: string;
  created_at: string;
  residency: string | null;
  age: number | null;
  monthly_income: number | null;
  available_cash: number | null;
  available_cpf: number | null;
  existing_properties: number | null;
  timeline: string | null;
  budget_midpoint: number | null;
  claimed: boolean;
  legacy: boolean;
};

type Insights = {
  window_days: number;
  from: string;
  to: string;
  total_runs: number;
  truncated: boolean;
  claimed_runs: number;
  claim_rate: number | null;
  medians: {
    monthly_income: number | null;
    available_cash: number | null;
    available_cpf: number | null;
    age: number | null;
    budget_midpoint: number | null;
  };
  distributions: {
    residency: Record<string, number>;
    timeline: Record<string, number>;
    existing_properties: Record<string, number>;
    monthly_income: Bucket[];
    available_cash: Bucket[];
    budget_midpoint: Bucket[];
  };
  runs_by_day: { date: string; count: number }[];
  recent: RecentRun[];
};

const RESIDENCY_LABEL: Record<string, string> = {
  citizen: "公民",
  pr: "PR",
  foreigner: "外籍",
  company: "公司",
  unknown: "未知",
};

const TIMELINE_LABEL: Record<string, string> = {
  "6m": "6 个月内",
  "1y": "1 年内",
  explore: "只是看看",
  unknown: "未填",
};

function sgd(n: number | null): string {
  if (n === null) return "—";
  return `S$ ${Math.round(n).toLocaleString("en-US")}`;
}

/** Compact money for dense table cells: 55 万 rather than S$ 550,000. */
function wan(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "0";
  return `${Math.round(n / 10_000)} 万`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdMinus(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Horizontal bar row. Width is relative to the largest count in its group. */
function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
      <span
        style={{
          width: 110,
          flexShrink: 0,
          color: C.gray600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={label}
      >
        {label}
      </span>
      <div style={{ height: 18, flex: 1, background: C.track, borderRadius: 2 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: C.primary,
            borderRadius: 2,
            transition: "width 0.3s ease-out",
          }}
        />
      </div>
      <span
        style={{
          width: 36,
          flexShrink: 0,
          textAlign: "right",
          color: C.charcoal,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section
      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, background: "#fff" }}
    >
      {title ? (
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.charcoal, marginBottom: 12 }}>
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function BarGroup({ title, rows }: { title: string; rows: Bucket[] }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card title={title}>
      {total === 0 ? (
        <p style={{ fontSize: 13, color: C.gray400 }}>暂无数据</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => (
            <Bar key={r.label} label={r.label} count={r.count} max={max} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, background: "#fff" }}
    >
      <p
        style={{
          fontSize: 11,
          letterSpacing: "0.05em",
          color: C.gray500,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          marginTop: 4,
          fontSize: 24,
          fontWeight: 600,
          color: C.charcoal,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {hint ? <p style={{ marginTop: 2, fontSize: 11, color: C.gray500 }}>{hint}</p> : null}
    </div>
  );
}

/**
 * Daily volume. Zero days are real bars of height 0 — the API fills gaps, so a
 * quiet stretch reads as quiet rather than being collapsed away.
 */
function DailyChart({ rows }: { rows: { date: string; count: number }[] }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: C.gray400 }}>暂无数据</p>;
  }
  const max = Math.max(...rows.map((r) => r.count));
  // Only label a handful of ticks, otherwise a 365-day window is unreadable.
  const step = Math.max(1, Math.ceil(rows.length / 12));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
        {rows.map((r) => (
          <div
            key={r.date}
            title={`${r.date}: ${r.count} 次`}
            style={{
              flex: 1,
              minWidth: 3,
              height: "100%",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                height: max > 0 ? `${Math.max((r.count / max) * 100, r.count > 0 ? 2 : 0)}%` : 0,
                background: r.count > 0 ? C.primary : "transparent",
                borderRadius: "2px 2px 0 0",
                transition: "height 0.3s ease-out",
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          gap: 2,
          marginTop: 6,
          fontSize: 10,
          color: C.gray400,
        }}
      >
        {rows.map((r, i) => (
          <span
            key={r.date}
            style={{ flex: 1, minWidth: 3, textAlign: "center", whiteSpace: "nowrap" }}
          >
            {i % step === 0 ? r.date.slice(5) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function toRows(map: Record<string, number>, labels: Record<string, string>): Bucket[] {
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([k, count]) => ({ label: labels[k] ?? k, count }));
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    fontSize: 13,
    borderRadius: 6,
    cursor: "pointer",
    background: active ? C.primary : "#fff",
    color: active ? "#fff" : C.gray600,
    border: `1px solid ${active ? C.primary : C.border}`,
  };
}

export default function InsightsPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  // `days` drives the quick presets; a non-null `range` overrides it.
  const [days, setDays] = useState<number>(30);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [fromInput, setFromInput] = useState(ymdMinus(30));
  const [toInput, setToInput] = useState(todayYmd());
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY_STORAGE);
      if (stored) setAdminKey(stored);
    } catch {
      /* private mode / storage disabled — fall through to the prompt */
    }
  }, []);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError(null);
    const qs = range ? `from=${range.from}&to=${range.to}` : `days=${days}`;
    try {
      const res = await fetch(`/api/admin/v1/calculator-runs?${qs}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const json = await res.json();
      if (!json.ok) {
        if (res.status === 401) {
          try {
            localStorage.removeItem(KEY_STORAGE);
          } catch {
            /* ignore */
          }
          setAdminKey(null);
          setError("密钥无效，请重新输入");
        } else {
          setError(json.error?.message ?? "加载失败");
        }
        setData(null);
        return;
      }
      setData(json.data as Insights);
    } catch {
      setError("网络错误");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [adminKey, days, range]);

  useEffect(() => {
    void load();
  }, [load]);

  function saveKey() {
    const k = keyInput.trim();
    if (!k) return;
    try {
      localStorage.setItem(KEY_STORAGE, k);
    } catch {
      /* ignore — key still held in memory for this session */
    }
    setAdminKey(k);
    setKeyInput("");
  }

  function forgetKey() {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
    setAdminKey(null);
    setData(null);
  }

  function applyPreset(w: number) {
    setRange(null);
    setDays(w);
  }

  function applyRange() {
    if (!fromInput || !toInput) return;
    // Tolerate a reversed pair rather than returning a confusing empty result.
    const [a, b] = fromInput <= toInput ? [fromInput, toInput] : [toInput, fromInput];
    setRange({ from: a, to: b });
  }

  if (!adminKey) {
    return (
      <section style={{ maxWidth: 360, margin: "64px auto 0", display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.charcoal }}>测算数据看板</h1>
        <p style={{ fontSize: 13, color: C.gray600, lineHeight: 1.6 }}>
          输入 admin 密钥。密钥只保存在这台设备的浏览器里，不会出现在网址中。
        </p>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveKey()}
          placeholder="ADMIN_API_SECRET"
          autoFocus
          style={{
            width: "100%",
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={saveKey}
          disabled={!keyInput.trim()}
          style={{
            width: "100%",
            background: C.primary,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 500,
            cursor: keyInput.trim() ? "pointer" : "not-allowed",
            opacity: keyInput.trim() ? 1 : 0.4,
          }}
        >
          确定
        </button>
        {error ? <p style={{ fontSize: 13, color: C.warnText }}>{error}</p> : null}
      </section>
    );
  }

  const hasLegacy = data?.recent.some((r) => r.legacy) ?? false;

  return (
    <section style={{ display: "grid", gap: 20 }}>
      <header
        style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: C.charcoal }}>测算数据看板</h1>
          <p style={{ fontSize: 13, color: C.gray500, marginTop: 2 }}>
            {data ? `${data.from} 至 ${data.to}` : "匿名测算记录的聚合视图"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => applyPreset(w)}
              style={btnStyle(range === null && days === w)}
            >
              {w}天
            </button>
          ))}
          <button type="button" onClick={() => void load()} style={btnStyle(false)}>
            刷新
          </button>
          <button
            type="button"
            onClick={forgetKey}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              color: C.gray500,
              background: "none",
              border: "none",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            登出
          </button>
        </div>
      </header>

      <Card>
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}
        >
          <span style={{ color: C.gray600 }}>自定义区间</span>
          <input
            type="date"
            value={fromInput}
            max={toInput}
            onChange={(e) => setFromInput(e.target.value)}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "5px 8px",
              fontSize: 13,
            }}
          />
          <span style={{ color: C.gray400 }}>至</span>
          <input
            type="date"
            value={toInput}
            min={fromInput}
            max={todayYmd()}
            onChange={(e) => setToInput(e.target.value)}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "5px 8px",
              fontSize: 13,
            }}
          />
          <button type="button" onClick={applyRange} style={btnStyle(range !== null)}>
            查询
          </button>
          {range ? (
            <button type="button" onClick={() => applyPreset(days)} style={btnStyle(false)}>
              清除
            </button>
          ) : null}
        </div>
      </Card>

      {error ? <p style={{ fontSize: 13, color: C.warnText }}>{error}</p> : null}
      {loading && !data ? <p style={{ fontSize: 13, color: C.gray500 }}>加载中…</p> : null}

      {data ? (
        <>
          {data.total_runs === 0 ? (
            <p
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 16,
                fontSize: 13,
                color: C.gray600,
                background: "#FAFAF9",
              }}
            >
              这个区间内没有测算记录。全量匿名保存是 2026-08-10 上线的，在那之前只有点击 WhatsApp
              分享的用户才会留下数据。
            </p>
          ) : null}

          {hasLegacy ? (
            <p
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                color: C.charcoal,
                background: C.legacyBg,
              }}
            >
              这个区间包含 2026-08-10 之前的记录（下方表格标为「旧」）。那些只有点了 WhatsApp
              分享的用户才会留下，是有偏样本，不代表全部访客。
            </p>
          ) : null}

          {data.truncated ? (
            <p
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                color: C.warnText,
                background: C.warnBg,
              }}
            >
              达到单次查询上限（5000 条），统计只覆盖该区间内最近的 5000 次测算。
            </p>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <Stat
              label="测算次数"
              value={String(data.total_runs)}
              hint={`共 ${data.window_days} 天`}
            />
            <Stat
              label="转化率"
              value={data.claim_rate === null ? "—" : `${(data.claim_rate * 100).toFixed(1)}%`}
              hint={`${data.claimed_runs} 人联系了顾问`}
            />
            <Stat label="预算中位数" value={sgd(data.medians.budget_midpoint)} hint="平衡区中点" />
            <Stat label="月收入中位数" value={sgd(data.medians.monthly_income)} />
            <Stat label="可动用现金中位数" value={sgd(data.medians.available_cash)} />
            <Stat label="CPF 中位数" value={sgd(data.medians.available_cpf)} />
            <Stat
              label="年龄中位数"
              value={data.medians.age === null ? "—" : `${data.medians.age} 岁`}
            />
          </div>

          <Card title="每日测算量">
            <DailyChart rows={data.runs_by_day} />
          </Card>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            <BarGroup title="预算分布" rows={data.distributions.budget_midpoint} />
            <BarGroup title="月收入分布" rows={data.distributions.monthly_income} />
            <BarGroup title="可动用现金分布" rows={data.distributions.available_cash} />
            <BarGroup
              title="身份构成"
              rows={toRows(data.distributions.residency, RESIDENCY_LABEL)}
            />
            <BarGroup
              title="购买时间意向"
              rows={toRows(data.distributions.timeline, TIMELINE_LABEL)}
            />
            <BarGroup
              title="已持有房产数"
              rows={toRows(data.distributions.existing_properties, { unknown: "未知" })}
            />
          </div>

          <Card>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 13,
                fontWeight: 600,
                color: C.charcoal,
                cursor: "pointer",
              }}
            >
              {showRaw ? "▾" : "▸"} 原始记录（{data.recent.length} 条
              {data.total_runs > data.recent.length ? `，共 ${data.total_runs}` : ""}）
            </button>
            {showRaw ? (
              data.recent.length === 0 ? (
                <p style={{ fontSize: 13, color: C.gray400, marginTop: 12 }}>暂无数据</p>
              ) : (
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <thead>
                      <tr style={{ color: C.gray500, textAlign: "left" }}>
                        {[
                          "时间",
                          "身份",
                          "年龄",
                          "月收入",
                          "现金",
                          "CPF",
                          "已有房",
                          "意向",
                          "预算",
                          "状态",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "6px 10px 6px 0",
                              fontWeight: 500,
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                      {data.recent.map((r) => (
                        <tr key={r.id} style={{ color: C.charcoal }}>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {r.created_at.slice(0, 16).replace("T", " ")}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {RESIDENCY_LABEL[r.residency ?? "unknown"] ?? r.residency}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {r.age ?? "—"}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {r.monthly_income === null
                              ? "—"
                              : `${Math.round(r.monthly_income).toLocaleString("en-US")}`}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {wan(r.available_cash)}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {wan(r.available_cpf)}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {r.existing_properties ?? "—"}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {TIMELINE_LABEL[r.timeline ?? "unknown"] ?? r.timeline}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {wan(r.budget_midpoint)}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px 6px 0",
                              borderBottom: `1px solid ${C.track}`,
                            }}
                          >
                            {r.claimed ? (
                              <span style={{ color: C.primary, fontWeight: 500 }}>已留资</span>
                            ) : null}
                            {r.legacy ? (
                              <span style={{ color: C.gray400, marginLeft: r.claimed ? 6 : 0 }}>
                                旧
                              </span>
                            ) : null}
                            {!r.claimed && !r.legacy ? (
                              <span style={{ color: C.gray400 }}>—</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </Card>
        </>
      ) : null}
    </section>
  );
}
