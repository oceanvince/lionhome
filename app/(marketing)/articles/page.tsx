export default function ArticlesPage() {
  return <Placeholder title="文章列表" subtitle="Module 6 — Content Decision Center" />;
}

function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mx-auto max-w-screen-md space-y-2 px-4 py-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-neutral-600">{subtitle}</p>
      <p className="text-xs text-neutral-500">Scaffold placeholder — content not implemented.</p>
    </section>
  );
}
