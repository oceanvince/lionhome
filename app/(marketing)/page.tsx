import { getTranslations } from "next-intl/server";
import Link from "next/link";

/**
 * 首页 —— 沿用 calculator / condo 的「Quiet Luxury」设计系统
 * （prototypes/condo-search/DESIGN.md）：430px 单列、cream hero、
 * Noto Serif SC 标题、primary 深绿、4px 圆角。
 * 色值统一取自 globals.css 的 @theme（对应 lib/design/tokens.ts）。
 */
export default async function HomePage() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  /**
   * 已上线的排在前面，未上线的挂「即将上线」排在后面。
   * featured = 主路径的视觉强调，ready = 是否已上线，两者互相独立。
   */
  const entries = [
    {
      href: "/calculator",
      module: "Module 1",
      title: t("ctaCalculator"),
      sub: t("ctaCalculatorSub"),
      featured: true,
      ready: true,
    },
    {
      href: "/condo/search",
      module: "Module 4",
      title: t("ctaCondo"),
      sub: t("ctaCondoSub"),
      featured: false,
      ready: true,
    },
    {
      href: "/quiz",
      module: "Module 2",
      title: t("ctaQuiz"),
      sub: t("ctaQuizSub"),
      featured: false,
      ready: false,
    },
    {
      href: "/articles",
      module: "Module 6",
      title: t("ctaArticles"),
      sub: t("ctaArticlesSub"),
      featured: false,
      ready: false,
    },
  ];

  return (
    <div className="bg-offwhite mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      {/* 品牌行 —— 与 calculator hero 的 BrandLogo 同一组件语言 */}
      <div className="shrink-0 px-5 pt-[max(20px,env(safe-area-inset-top))]">
        <span className="inline-flex items-center gap-2">
          <span className="bg-primary size-2 rounded-full" />
          <span className="text-charcoal text-sm font-medium tracking-[0.02em]">
            {tCommon("brandName")}
          </span>
        </span>
      </div>

      {/* Hero */}
      <header className="bg-cream relative mx-5 mt-6 shrink-0 overflow-hidden rounded-[6px] px-5 pt-12 pb-10">
        <div className="text-primary absolute top-6 right-6 opacity-30" aria-hidden="true">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="26" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="14" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>

        <p className="text-primary mb-3 text-[11px] font-medium tracking-[0.2em] uppercase">
          {t("eyebrow")}
        </p>
        {/* 断行手写死，避免中文标题在 CJK 词中间折行（同 calculator hero）。
            32px 是 DESIGN.md §3 Display 档（30–36px）的下沿，取它是为了第二行
            在 375px 窄屏也放得下，不会掉出一个孤字。 */}
        <h1 className="text-charcoal font-serif text-[32px] leading-[1.1] font-semibold">
          {t("heroTitleLine1")}
          <br />
          {t("heroTitleLine2")}
        </h1>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-muted text-xs font-light">{t("heroMetaFree")}</span>
          <span className="size-1 rounded-full bg-neutral-300" />
          <span className="text-muted text-xs font-light">{t("heroMetaNoSignup")}</span>
        </div>
        <p className="text-muted mt-3 text-[11px] leading-relaxed font-light">
          {t("heroSubtitle")}
        </p>
      </header>

      {/* 入口 */}
      <nav aria-label={t("sectionTitle")} className="flex-1 px-5 pt-8 pb-6">
        <h2 className="text-charcoal mb-4 font-serif text-sm font-semibold">{t("sectionTitle")}</h2>
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className={`group block rounded-[4px] border p-5 transition-all ${
                  entry.featured
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:border-primary/40 bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-primary text-[11px] font-medium tracking-[0.2em] uppercase">
                    {entry.module}
                  </span>
                  {!entry.ready && (
                    <span className="text-faint border-border rounded-full border px-2 py-0.5 text-[10px] font-light">
                      {t("comingSoon")}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-charcoal text-base font-medium">{entry.title}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                    className={`shrink-0 transition-colors ${
                      entry.featured ? "text-primary" : "text-faint group-hover:text-primary"
                    }`}
                  >
                    <path
                      d="M7 4L13 10L7 16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="text-muted mt-1 text-xs leading-relaxed font-light">{entry.sub}</p>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 免责 + 法务链接 —— 与 calculator 结果页页脚一致 */}
      <footer className="border-border shrink-0 border-t px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p className="text-faint text-[11px] leading-relaxed font-light">{t("disclaimer")}</p>
        <div className="text-faint mt-3 flex flex-wrap items-center gap-4 text-[11px] font-light">
          <Link href="/legal/terms" className="text-muted underline">
            {tCommon("terms")}
          </Link>
          <Link href="/legal/privacy" className="text-muted underline">
            {tCommon("privacy")}
          </Link>
          <Link href="/legal/data-sharing" className="text-muted underline">
            {tCommon("dataSharing")}
          </Link>
          <span className="ml-auto">© {tCommon("appName")}</span>
        </div>
      </footer>
    </div>
  );
}
