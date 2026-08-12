export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[16rem_1fr]">
      <aside className="border-r border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Lead OS</p>
        <nav className="mt-3 flex flex-col gap-1 text-sm">
          <a href="/admin" className="rounded px-2 py-1.5 text-neutral-700 hover:bg-neutral-100">
            概览
          </a>
          <a
            href="/admin/insights"
            className="rounded px-2 py-1.5 text-neutral-700 hover:bg-neutral-100"
          >
            测算数据
          </a>
        </nav>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
