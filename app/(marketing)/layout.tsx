/**
 * 只提供 <main> landmark，不约束宽度 —— 首页要和 calculator 一样走
 * 430px 单列的全出血布局，内容页各自套自己的容器。
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh">{children}</main>;
}
