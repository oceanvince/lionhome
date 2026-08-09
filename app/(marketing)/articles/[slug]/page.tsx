type Params = Promise<{ slug: string }>;

export default async function ArticleDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  return (
    <section className="mx-auto max-w-screen-md space-y-2 px-4 py-8">
      <h1 className="text-2xl font-semibold">Article: {slug}</h1>
      <p className="text-sm text-neutral-600">Module 6 — Content detail (placeholder).</p>
    </section>
  );
}
