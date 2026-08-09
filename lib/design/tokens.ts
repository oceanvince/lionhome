/**
 * LionHome「Quiet Luxury」设计系统色板 —— 需要 JS 取值的内联样式统一从这里读。
 *
 * 同一组值以 CSS 变量的形式镜像在 app/globals.css 的 `@theme` 里，供用
 * Tailwind class 写的页面（首页等）使用。改色时两处必须一起改。
 * 设计规范见 prototypes/condo-search/DESIGN.md §2。
 */
export const C = {
  primary: "#2F4F3D",
  primarySoft: "#EAEFEB",
  charcoal: "#1A1C1A",
  offwhite: "#FCFBF9",
  cream: "#F5F1E8",
  border: "#E5E5E5",
  warn: "#8B3A1F",
  warnSoft: "#F8EFE8",
  /** 次级正文 —— 对应 @theme 的 --color-muted */
  gray500: "#6B7280",
  /** 说明 / 免责等三级文字 —— 对应 @theme 的 --color-faint */
  gray400: "#9CA3AF",
};

export const SERIF = "'Noto Serif SC', serif";
