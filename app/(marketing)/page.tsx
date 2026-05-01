import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-brand-600 text-sm font-medium">{tCommon("appName")}</p>
        <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{t("heroTitle")}</h1>
        <p className="text-base text-neutral-600">{t("heroSubtitle")}</p>
      </header>

      <nav aria-label="主要入口" className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/calculator"
          className="hover:border-brand-500 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow"
        >
          <span className="text-brand-600 block text-sm font-medium">Module 1</span>
          <span className="mt-1 block text-lg font-semibold">{t("ctaCalculator")}</span>
        </Link>
        <Link
          href="/quiz"
          className="hover:border-brand-500 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow"
        >
          <span className="text-brand-600 block text-sm font-medium">Module 2</span>
          <span className="mt-1 block text-lg font-semibold">{t("ctaQuiz")}</span>
        </Link>
        <Link
          href="/articles"
          className="hover:border-brand-500 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow"
        >
          <span className="text-brand-600 block text-sm font-medium">Module 6</span>
          <span className="mt-1 block text-lg font-semibold">{t("ctaArticles")}</span>
        </Link>
      </nav>

      <p className="text-xs text-neutral-500">
        Scaffold-only build. Modules will be wired in subsequent milestones.
      </p>
    </section>
  );
}
