type Params = Promise<{ id: string }>;

export default async function ResultPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Personalized Result</h1>
      <p className="text-sm text-neutral-600">Module 3 — session {id} (placeholder).</p>
    </section>
  );
}
