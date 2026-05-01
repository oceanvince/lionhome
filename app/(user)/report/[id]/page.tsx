type Params = Promise<{ id: string }>;

export default async function ReportPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Deep Property Report</h1>
      <p className="text-sm text-neutral-600">Module 4 — report {id} (placeholder).</p>
    </section>
  );
}
