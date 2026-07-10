"use client";

import { useState } from "react";
import Link from "next/link";
import { BAND_LABEL_ZH, type Band, type ProjectScore, type Dimension } from "@/lib/project-scoring";
import type { CondoReport } from "@/lib/condo/types";

/* ── palette (mirrors prototypes/condo-search/DESIGN.md) ─────────────── */
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

const BAND_COLOR: Record<Band, string> = {
  excellent: "#2F6B4A",
  good: "#5C8A6B",
  fair: "#B07A1E",
  poor: "#B5562A",
  insufficient: "#B8B8B0",
};
const BAND_SOFT: Record<Band, string> = {
  excellent: "#E7F0EA",
  good: "#E7F0EA",
  fair: "#F7F0E0",
  poor: "#F7ECE4",
  insufficient: "#EFEFEC",
};
const VERDICT: Record<string, { c: string; bg: string }> = {
  green: { c: "#2F6B4A", bg: "#E7F0EA" },
  amber: { c: "#B07A1E", bg: "#F7F0E0" },
  orange: { c: "#B5562A", bg: "#F7ECE4" },
};

const COMPONENT_LABELS: Record<string, string> = {
  projectCagrPct: "本盘转售 CAGR",
  baselineCagrPct: "同区基准",
  deltaPp: "跑赢基准(pp)",
  resaleTxn12m: "近 12 月转售笔数",
  includedBedroomTypes: "计入户型",
  excludedBedroomTypes: "不计入户型",
  nearestMrtWalkMin: "最近 MRT 步行(分)",
  schoolsWithin1km: "1km 内小学",
  amenityDensity: "配套密度",
  note: "说明",
  status: "状态",
};

const DIM_TITLE: Record<Dimension, string> = {
  profit: "盈利分 Profit",
  location: "地段分 Location",
  exit: "退出分 Exit",
  rental: "租赁分 Rental",
};
const DIM_SUB: Record<Dimension, string> = {
  profit: "近年同户型转售 vs 同区基准",
  location: "地铁通达 + 名校距离 + 配套",
  exit: "未来转售/退出的难易",
  rental: "租金回报 + 出租率 + 跨户型一致性",
};

function fmtPsf(min: number | null, max: number | null) {
  if (min === null || max === null) return "暂无成交";
  return `S$${Math.round(min).toLocaleString()} – ${Math.round(max).toLocaleString()}`;
}

/* ── 4-axis radar from real scores ──────────────────────────────────── */
const AXES: {
  dim: Dimension;
  vec: [number, number];
  label: string;
  anchor: "middle" | "start" | "end";
  lx: number;
  ly: number;
}[] = [
  { dim: "profit", vec: [0, -75], label: "盈利", anchor: "middle", lx: 110, ly: 20 },
  { dim: "location", vec: [80, 0], label: "地段", anchor: "start", lx: 196, ly: 109 },
  { dim: "exit", vec: [0, 75], label: "退出", anchor: "middle", lx: 110, ly: 196 },
  { dim: "rental", vec: [-80, 0], label: "租赁", anchor: "end", lx: 24, ly: 109 },
];
const CENTER = { x: 110, y: 105 };

function Radar({ scores }: { scores: ProjectScore[] }) {
  const byDim = (d: Dimension) => scores.find((s) => s.dimension === d);
  const vtx = (vec: [number, number], score: number) => [
    CENTER.x + (vec[0] * score) / 10,
    CENTER.y + (vec[1] * score) / 10,
  ];
  const points = AXES.map(({ dim, vec }) => {
    const s = byDim(dim)?.score;
    return vtx(vec, s ?? 1.6)
      .map((n) => n.toFixed(0))
      .join(",");
  }).join(" ");

  return (
    <svg viewBox="-40 0 300 200" width="260" style={{ maxWidth: "100%" }} aria-label="四维评分雷达">
      <g fill="none" stroke={C.border} strokeWidth="1">
        <polygon points="110,30 185,105 110,180 35,105" />
        <polygon points="110,55 160,105 110,155 60,105" opacity="0.6" />
      </g>
      <g stroke={C.border} strokeWidth="1">
        <line x1="110" y1="105" x2="110" y2="30" />
        <line x1="110" y1="105" x2="185" y2="105" />
        <line x1="110" y1="105" x2="110" y2="180" />
        <line x1="110" y1="105" x2="35" y2="105" />
      </g>
      <polygon points={points} fill="rgba(47,79,61,.12)" stroke={C.primary} strokeWidth="2" />
      {AXES.map(({ dim, vec }) => {
        const s = byDim(dim)?.score;
        const [x, y] = vtx(vec, s ?? 1.6);
        const color = s == null ? "#B8B8B0" : BAND_COLOR[byDim(dim)!.band];
        return <circle key={dim} cx={x} cy={y} r="3.4" fill={color} />;
      })}
      <g fontSize="11" fontFamily="Noto Sans SC" fill={C.charcoal}>
        {AXES.map(({ dim, label, anchor, lx, ly }) => {
          const s = byDim(dim)?.score;
          const txt = `${label} ${s == null ? "N/A" : s}`;
          return (
            <text
              key={dim}
              x={lx}
              y={ly}
              textAnchor={anchor}
              fill={s == null ? "#B8B8B0" : C.charcoal}
            >
              {txt}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

/* ── dimension card ─────────────────────────────────────────────────── */
function DimensionCard({ score }: { score: ProjectScore }) {
  const [open, setOpen] = useState(false);
  const coming = score.components?.status === "coming_soon";
  const color = BAND_COLOR[score.band];

  if (coming) {
    return (
      <div
        className="rounded-[4px] border border-dashed p-5"
        style={{ borderColor: C.border, background: "rgba(245,241,232,.5)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3
                className="text-base font-semibold"
                style={{ fontFamily: SERIF, color: C.gray500 }}
              >
                {DIM_TITLE[score.dimension]}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ background: "#B8B8B0" }}
              >
                即将上线
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: C.gray400 }}>
              {DIM_SUB[score.dimension]}
            </p>
          </div>
          <span
            className="text-[40px] font-semibold text-gray-300"
            style={{ fontFamily: SERIF, lineHeight: 1 }}
          >
            N/A
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: C.gray400 }}>
          该维度正在接入数据，<span className="font-medium">不参与本次结论</span>。
        </p>
      </div>
    );
  }

  const rows = Object.entries(score.components).filter(([k]) => k !== "status");

  return (
    <div className="rounded-[4px] border bg-white p-5" style={{ borderColor: C.border }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold" style={{ fontFamily: SERIF }}>
              {DIM_TITLE[score.dimension]}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color, background: BAND_SOFT[score.band] }}
            >
              {BAND_LABEL_ZH[score.band]}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: C.gray500 }}>
            {DIM_SUB[score.dimension]}
          </p>
        </div>
        <span
          className="text-[40px] font-semibold"
          style={{ fontFamily: SERIF, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
        >
          {score.score ?? "N/A"}
        </span>
      </div>

      {score.confidence !== "high" && (
        <span
          className="mt-3 inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px]"
          style={{ color: C.warn, background: C.warnSoft }}
        >
          {score.confidence === "estimated_similar" ? "相似盘估算" : "数据覆盖低，可靠性下降"}
        </span>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm hover:underline"
          style={{ color: C.primary }}
        >
          怎么算的？{open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div
          className="mt-3 space-y-1.5 border-t pt-3 text-sm"
          style={{ borderColor: C.border, color: C.gray500 }}
        >
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{COMPONENT_LABELS[k] ?? k}</span>
              <span className="font-medium">{String(v)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1.5" style={{ borderColor: C.border }}>
            <span>置信度</span>
            <span className="font-medium">{score.confidence}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── detail tabs ────────────────────────────────────────────────────── */
const TABS = [
  { key: "overview", label: "概览" },
  { key: "txn", label: "成交" },
  { key: "price", label: "价格" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function DetailTabs({ report }: { report: CondoReport }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const p = report.project;

  return (
    <section className="mt-12">
      <div className="overflow-x-auto border-b" style={{ borderColor: C.border }}>
        <div className="flex min-w-max gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap"
              style={{
                color: tab === t.key ? C.primary : C.gray500,
                borderColor: tab === t.key ? C.primary : "transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid gap-x-8 gap-y-3 pt-5 text-sm sm:grid-cols-2">
          {[
            ["产权", p.tenure ?? "—"],
            ["TOP", p.topYear ?? "—"],
            ["总户数", p.totalUnits ?? "—"],
            ["开发商", p.developer ?? "—"],
            ["区", p.district ?? "—"],
            ["最近 MRT", report.amenities.mrt[0]?.name ?? "—"],
          ].map(([k, v]) => (
            <div
              key={String(k)}
              className="flex justify-between border-b pb-2"
              style={{ borderColor: "#eee" }}
            >
              <span style={{ color: C.gray500 }}>{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "txn" && (
        <div className="pt-5">
          {report.transactions.length === 0 ? (
            <p className="text-sm" style={{ color: C.gray400 }}>
              暂无近 12 月成交记录。
            </p>
          ) : (
            <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead
                className="border-b text-xs"
                style={{ borderColor: C.border, color: C.gray500 }}
              >
                <tr className="text-left">
                  <th className="py-2 font-medium">日期</th>
                  <th className="text-right font-medium">面积</th>
                  <th className="text-right font-medium">PSF</th>
                  <th className="text-right font-medium">成交价</th>
                </tr>
              </thead>
              <tbody>
                {report.transactions.slice(0, 12).map((t, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "#eee" }}>
                    <td className="py-2.5">{t.txnDate}</td>
                    <td className="text-right">{Math.round(t.areaSqft)} sqft</td>
                    <td className="text-right">S${Math.round(t.psf).toLocaleString()}</td>
                    <td className="text-right font-medium">
                      S${(t.price / 1_000_000).toFixed(2)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "price" && (
        <div className="mt-5 rounded-[4px] border bg-white p-5" style={{ borderColor: C.border }}>
          <span
            className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px]"
            style={{ color: C.warn, background: C.warnSoft }}
          >
            非估价 · 算术换算
          </span>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: C.gray500 }}>
            以「近 12 月成交 PSF 区间 × 约 1000 sqft」换算，
            <span className="font-medium">不构成估价</span>。
          </p>
          <div
            className="mt-3 rounded-[4px] p-3 text-sm"
            style={{ background: "rgba(245,241,232,.5)" }}
          >
            <div className="text-xs" style={{ color: C.gray500 }}>
              3 房（~1000 sqft）换算总价
            </div>
            <div className="mt-0.5 text-lg font-semibold">
              {p.psfMin && p.psfMax
                ? `S$${((p.psfMin * 1000) / 1_000_000).toFixed(2)}M – ${((p.psfMax * 1000) / 1_000_000).toFixed(2)}M`
                : "暂无"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── main view ──────────────────────────────────────────────────────── */
export function CondoReportView({ report }: { report: CondoReport }) {
  const { project: p, verdict, scores } = report;
  const v = VERDICT[verdict.tier] ?? VERDICT.orange!;
  const mrt = report.amenities.mrt[0];

  return (
    <div style={{ background: C.offwhite, color: C.charcoal, minHeight: "100%" }}>
      <main className="mx-auto max-w-[760px] px-4 pb-24">
        {/* Block 1 · 决策快照 */}
        <section className="pt-8">
          <p className="text-xs tracking-wide" style={{ color: C.gray500 }}>
            {p.district ?? ""} · {p.tenure ?? ""}
          </p>
          <h1
            className="mt-1 text-[28px] leading-tight font-semibold md:text-[34px]"
            style={{ fontFamily: SERIF }}
          >
            {p.name} · 一眼看懂
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
              style={{ color: v.c, background: v.bg }}
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: v.c }} />
              {verdict.label}
            </span>
            <span className="text-xs" style={{ color: C.gray500 }}>
              仅由盈利 + 地段得出
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-[17px] leading-[1.8] md:text-lg">{verdict.sentence}</p>

          {/* radar + key metrics */}
          <div
            className="mt-6 grid items-center gap-6 rounded-[4px] border bg-white p-5 md:grid-cols-[260px_1fr] md:p-6"
            style={{ borderColor: C.border }}
          >
            <div className="flex flex-col items-center">
              <Radar scores={scores} />
              <div className="mt-1 flex gap-3 text-[11px]" style={{ color: C.gray500 }}>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: C.primary }} /> 已算
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#B8B8B0" }} />{" "}
                  即将上线
                </span>
              </div>
            </div>
            <div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {[
                  ["已 TOP", p.topYear ? `${p.topYear} 落成` : "—"],
                  [p.tenure ?? "—", "产权"],
                  [
                    mrt?.walkMinutes ? `${mrt.walkMinutes} 分钟` : "—",
                    mrt ? `步行至 ${mrt.name}` : "最近 MRT",
                  ],
                  [p.totalUnits ? `${p.totalUnits} 户` : "—", "总单位数"],
                ].map(([a, b], i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div
                      className="text-base font-medium"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {a}
                    </div>
                    <div className="text-xs" style={{ color: C.gray500 }}>
                      {b}
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-4 flex items-center justify-between border-t pt-4"
                style={{ borderColor: C.border }}
              >
                <div>
                  <div className="text-xs" style={{ color: C.gray500 }}>
                    近 12 月成交 PSF 区间
                  </div>
                  <div
                    className="text-lg font-semibold"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {fmtPsf(p.psfMin, p.psfMax)}
                  </div>
                </div>
                <span
                  className="rounded-[3px] px-1.5 py-0.5 text-[11px]"
                  style={{ color: C.warn, background: C.warnSoft }}
                >
                  非估价 · 算术换算
                </span>
              </div>
            </div>
          </div>

          {/* 适配度 CTA */}
          <div
            className="mt-4 rounded-[4px] border p-5"
            style={{ borderColor: C.border, background: "rgba(234,239,235,.6)" }}
          >
            <h3 className="text-base font-semibold" style={{ fontFamily: SERIF }}>
              这个盘对「你」合不合适
            </h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: C.gray500 }}>
              结合你的收入、现金、身份算出购买力，看本盘在不在你的舒适区间、ABSD 负担多少。
            </p>
            <Link
              href="/calculator"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-[4px] px-5 text-sm font-medium text-white"
              style={{ background: C.primary }}
            >
              测一下买不买得起 →
            </Link>
          </div>

          {/* 信任条 */}
          <div
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
            style={{ color: C.gray500 }}
          >
            <span>数据源 URA · OneMap</span>
            {report.snapshotDate && <span>数据快照 {report.snapshotDate}</span>}
            {report.scoreVersion && (
              <span style={{ color: C.gray400 }}>分数版本 {report.scoreVersion}</span>
            )}
          </div>
        </section>

        {/* Block 2 · 四维评分 */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold" style={{ fontFamily: SERIF }}>
            四维评分
          </h2>
          <p className="mt-1 mb-4 text-sm" style={{ color: C.gray500 }}>
            每维满分 10 · 优秀 ≥7 / 良好 ≥5 / 一般 ≥3 / 偏弱 &lt;3 · 每个分数都能点开看怎么算的
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {(["profit", "location", "exit", "rental"] as Dimension[]).map((dim) => {
              const s = scores.find((x) => x.dimension === dim);
              return s ? <DimensionCard key={dim} score={s} /> : null;
            })}
          </div>
        </section>

        {/* Block 3 · 详情 Tab */}
        <DetailTabs report={report} />

        {/* Block 5 · CTA */}
        <section
          className="mt-12 rounded-[4px] border bg-white p-5 md:p-6"
          style={{ borderColor: C.border }}
        >
          <h3 className="text-lg font-semibold" style={{ fontFamily: SERIF }}>
            下一步
          </h3>
          <p className="mt-1 mb-4 text-sm" style={{ color: C.gray500 }}>
            无需登录即可看完整报告；保存 / 深度报告 / 约顾问需登录。
          </p>
          <button
            className="flex w-full items-center justify-center rounded-[4px] px-6 font-medium text-white"
            style={{ background: C.primary, minHeight: 52 }}
          >
            要这个盘的深度报告（免费）
          </button>
        </section>

        {/* 合规免责 */}
        <footer className="mt-10 border-t pt-6" style={{ borderColor: C.border }}>
          {report.disclaimers.map((d, i) => (
            <p key={i} className="text-[11px] leading-relaxed" style={{ color: C.gray400 }}>
              {d}
            </p>
          ))}
        </footer>
      </main>
    </div>
  );
}
