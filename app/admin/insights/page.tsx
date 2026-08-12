"use client";

import { useCallback, useEffect, useState } from "react";

/** Where the admin key lives. Browser-local only — never sent in a URL. */
const KEY_STORAGE = "lh_admin_key";

const WINDOWS = [7, 30, 90, 365] as const;

type Bucket = { label: string; count: number };

type Insights = {
  window_days: number;
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

/** Horizontal bar row. Width is relative to the largest count in its group. */
function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-neutral-600" title={label}>
        {label}
      </span>
      <div className="h-5 flex-1 rounded-sm bg-neutral-100">
        <div
          className="h-full rounded-sm bg-emerald-800 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-neutral-700 tabular-nums">{count}</span>
    </div>
  );
}

function BarGroup({ title, rows }: { title: string; rows: Bucket[] }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {total === 0 ? (
        <p className="text-sm text-neutral-400">暂无数据</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <Bar key={r.label} label={r.label} count={r.count} max={max} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

/** Daily volume as a bare column chart — enough to spot a trend or a dead week. */
function DailyChart({ rows }: { rows: { date: string; count: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-400">暂无数据</p>;
  }
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="flex h-32 items-end gap-1 overflow-x-auto">
      {rows.map((r) => (
        <div key={r.date} className="flex min-w-[10px] flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-emerald-800"
            style={{ height: `${max > 0 ? (r.count / max) * 100 : 0}%` }}
            title={`${r.date}: ${r.count}`}
          />
          <span className="origin-top-left rotate-45 text-[9px] whitespace-nowrap text-neutral-400">
            {r.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

function toRows(map: Record<string, number>, labels: Record<string, string>): Bucket[] {
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([k, count]) => ({ label: labels[k] ?? k, count }));
}

export default function InsightsPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore a previously entered key. Runs once, client-side only.
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
    try {
      const res = await fetch(`/api/admin/v1/calculator-runs?days=${days}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const json = await res.json();
      if (!json.ok) {
        // A bad key is the common case — clear it so the prompt comes back.
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
  }, [adminKey, days]);

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

  if (!adminKey) {
    return (
      <section className="mx-auto max-w-sm space-y-4 pt-16">
        <h1 className="text-xl font-semibold">测算数据看板</h1>
        <p className="text-sm text-neutral-600">
          输入 admin 密钥。密钥只保存在这台设备的浏览器里，不会出现在网址中。
        </p>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveKey()}
          placeholder="ADMIN_API_SECRET"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          autoFocus
        />
        <button
          type="button"
          onClick={saveKey}
          className="w-full rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          disabled={!keyInput.trim()}
        >
          确定
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">测算数据看板</h1>
          <p className="text-sm text-neutral-600">匿名测算记录的聚合视图</p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                days === w
                  ? "bg-emerald-800 text-white"
                  : "border border-neutral-300 text-neutral-700"
              }`}
            >
              {w}天
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={forgetKey}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-500 underline"
          >
            登出
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-neutral-500">加载中…</p> : null}

      {data ? (
        <>
          {data.total_runs === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              这个时间窗内还没有测算记录。匿名保存是 2026-08-10 上线的，在那之前的测算没有留下数据。
            </p>
          ) : null}

          {data.truncated ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              达到单次查询上限（5000 条），统计只覆盖该窗口内最近的 5000 次测算。
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="测算次数"
              value={String(data.total_runs)}
              hint={`近 ${data.window_days} 天`}
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

          <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-900">每日测算量</h3>
            <DailyChart rows={data.runs_by_day} />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
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
        </>
      ) : null}
    </section>
  );
}
