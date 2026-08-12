export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Colors are inlined against the project's design tokens: `@theme` in globals.css
 * replaces Tailwind's default palette, so `bg-neutral-50` and friends are no-ops.
 */
const BORDER = "#E5E5E5";
const SIDEBAR_BG = "#FAFAF9";
const LABEL = "#6B7280";
const LINK = "#1A1C1A";

const NAV = [
  { href: "/admin", label: "概览" },
  { href: "/admin/insights", label: "测算数据" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "#fff" }}>
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: `1px solid ${BORDER}`,
          background: SIDEBAR_BG,
          padding: 16,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: LABEL,
            textTransform: "uppercase",
          }}
        >
          Lead OS
        </p>
        <nav style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                borderRadius: 4,
                padding: "6px 8px",
                fontSize: 13,
                color: LINK,
                textDecoration: "none",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: 24 }}>{children}</main>
    </div>
  );
}
