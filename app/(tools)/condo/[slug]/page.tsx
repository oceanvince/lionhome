import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getReportData } from "@/lib/condo/report";
import { CondoReportView } from "./report-view";

export const runtime = "nodejs";

/** Dedupe the DB read across generateMetadata + the page render (one request). */
const loadReport = cache(async (slug: string) => {
  const db = await getSupabaseServerClient();
  return getReportData(db, slug);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) {
    return { title: "楼盘决策报告 | 狮城家", robots: { index: false } };
  }
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
      <Link
        href="/condo"
        className="inline-flex h-12 items-center justify-center rounded-[4px] px-6 font-medium text-white"
        style={{ background: "#2F4F3D" }}
      >
        按区浏览楼盘
      </Link>
    </main>
  );
}

export default async function CondoReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await loadReport(slug);
  if (!report) return <NotFound slug={slug} />;
  return <CondoReportView report={report} />;
}
