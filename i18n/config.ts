export const locales = ["zh-CN"] as const;

export const defaultLocale = "zh-CN" satisfies (typeof locales)[number];

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  "zh-CN": "简体中文",
};
