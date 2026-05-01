export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[16rem_1fr]">
      <aside className="border-r border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Lead OS</p>
        <p className="mt-2 text-sm text-neutral-600">Sidebar navigation — placeholder.</p>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
