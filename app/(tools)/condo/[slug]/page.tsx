import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getReportData } from "@/lib/condo/report";
import { CondoReportView } from "./report-view";

export const runtime = "nodejs";

type LoadResult =
  | { status: "ok"; report: NonNullable<Awaited<ReturnType<typeof getReportData>>> }
  | { status: "missing" }
  | { status: "unavailable" };

/**
 * Dedupe the DB read across generateMetadata + the page render (one request).
 *
 * "missing" and "unavailable" are kept apart on purpose: the repo now throws on
 * a DB error rather than returning null, so an outage renders as an outage
 * instead of telling the visitor the project does not exist.
 */
const loadReport = cache(async (slug: string): Promise<LoadResult> => {
  try {
    const db = await getSupabaseServerClient();
    const report = await getReportData(db, slug);
    return report ? { status: "ok", report } : { status: "missing" };
  } catch (err) {
    console.error("[condo/[slug]] report load failed:", err);
    return { status: "unavailable" };
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadReport(slug);
  if (loaded.status !== "ok") {
    return { title: "楼盘决策报告 | 狮城家", robots: { index: false } };
  }
  const report = loaded.report;
  const p = report.project;
  return {
    title: `${p.name} 决策报告 — PSF/学区/转售分析 | 狮城家`,
    description: `${p.name}（${p.district ?? ""}）决策报告：${report.verdict.label}。近 12 月成交 PSF、地段、适配度，一页看懂值不值得入候选。`,
  };
}

/** Cold-start / not-found fallback — never a half-baked report (SPEC §6.3). */
function NotFound({ slug }: { slug: string }) {
  return (
    <main
      className="mx-auto max-w-[640px] px-4 py-20 text-center"
      style={{ background: "#FCFBF9" }}
    >
      <h1 className="mb-2 font-serif text-2xl font-semibold" style={{ color: "#1A1C1A" }}>
        这个盘我们还没收录
      </h1>
      <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-gray-600">
        「{slug}」暂未收录，或还在准备数据。要不要按区找几个近似的？
      </p>
      {/* /condo is not a route — only /condo/search and /condo/[slug] exist, so
          this CTA used to dead-end on the framework 404 and break the whole
          fallback path it was built for. */}
      <Link
        href="/condo/search"
        className="inline-flex h-12 items-center justify-center rounded-[4px] px-6 font-medium text-white"
        style={{ background: "#2F4F3D" }}
      >
        按区浏览楼盘
      </Link>
    </main>
  );
}

/** A database outage is not "we have not covered this project" (§12-⑤). */
function Unavailable() {
  return (
    <main
      className="mx-auto max-w-[640px] px-4 py-20 text-center"
      style={{ background: "#FCFBF9" }}
    >
      <h1 className="mb-2 font-serif text-2xl font-semibold" style={{ color: "#1A1C1A" }}>
        暂时打不开这份报告
      </h1>
      <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-gray-600">
        我们这边出了点问题，不是这个盘没有收录。请稍后重试。
      </p>
      <Link
        href="/condo/search"
        className="inline-flex h-12 items-center justify-center rounded-[4px] px-6 font-medium text-white"
        style={{ background: "#2F4F3D" }}
      >
        返回楼盘搜索
      </Link>
    </main>
  );
}

export default async function CondoReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadReport(slug);
  if (loaded.status === "unavailable") return <Unavailable />;
  if (loaded.status === "missing") return <NotFound slug={slug} />;
  return <CondoReportView report={loaded.report} />;
}
