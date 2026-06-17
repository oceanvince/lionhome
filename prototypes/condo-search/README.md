# Prototype · Condo Search 楼盘决策报告

按 [docs/CONDO_SEARCH_SPEC.md](../../docs/CONDO_SEARCH_SPEC.md) 实现的**可点击前端原型**，用 [web-design skill](../../.claude/skills/web-design) 的 Phase B→C 流程产出。

继承 LionHome「Quiet Luxury」设计系统（primary `#2F4F3D` · Noto Serif/Sans SC · 4px 圆角 · Tailwind v4 CDN），新增决策报告专属组件。完整规范见同目录 [DESIGN.md](./DESIGN.md)。

## 文件

| 文件 | 内容 | 对应 PRD |
|------|------|----------|
| [DESIGN.md](./DESIGN.md) | 设计规范（9 章节，继承 + 扩展） | Phase B 产物 |
| [search.html](./search.html) | 搜索结果页：搜索框 + 自动补全 + 项目卡片列表 + 零结果兜底 | §3 |
| [report.html](./report.html) | 决策报告页 `/condo/{slug}`：决策快照 + 四维评分 + 适配度 + 详情 Tab + 伴随地图 + CTA + 合规免责 | §4 |

浏览器直接打开 `search.html`，点搜索建议或卡片 → `report.html`。

## 页面间交互（已串联）

- **搜索 → 报告**：卡片 / 自动补全 / 热门标签均带 `?slug=` 跳转（`goReport(slug)`），带淡出转场
- **报告页按 slug 动态渲染**：标题、结论徽章、一句话结论、**四维雷达（按分数实时算多边形）**、关键指标、PSF、适配度区间条、盈利/地段两维（分数/档位/解释/子因子/诚实度标注）、各 Tab 内容——三个楼盘（the-gazania / jadescape / normanton-park）各不相同
- **报告 → 其它**：返回搜索（`history.back`，带转场）、适配度/价格 Tab → 购买力计算器（prototype f）、深度报告 / 约顾问 / 对比 / 收藏 / 提醒 / 数据反馈均有 toast 反馈
- **降级**：`prefers-reduced-motion` 下转场直接跳转、动画关闭
- 直接打开 `report.html`（无 slug）默认渲染 the-gazania

## 已落地的 PRD 设计红线

- ✅ **结论先行**：报告页首屏即「值得入候选」徽章 + 一句话结论（模板拼装措辞）
- ✅ **可解释**：每个分数都有「怎么算的？」展开子因子（§4.1 红线）
- ✅ **数据诚实度**（§4.3）：相似盘估算 / 新盘 / 户型 excluded / 数据覆盖低 等 `honesty-tag`
- ✅ **退出/租赁灰显**「即将上线」，雷达图浅色，**不参与结论**（§4.2 口径统一）
- ✅ **适配度与四维同级**（§4.1.6）：购买力区间条 + ABSD 身份负担，接购买力计算器
- ✅ **合规措辞红线**（§11）：无「估值/这套值/valuation」，PSF 标注「非估价·算术换算」，底部常驻 CEA 免责
- ✅ **性能**（§13）：首屏只渲染决策快照，地图懒加载（点击才初始化），`prefers-reduced-motion` 降级
- ✅ **响应式**：移动 430px 单列 + 吸底 CTA；桌面两栏（内容 720 + 伴随地图 360 sticky）

## 与现有原型/代码的关系

- 复用 prototype f 的 token、`.btn-primary/.seg/.radio-card` 等组件语言
- 适配度模块跳转 [prototype f](../f/index.html)（购买力计算器）
- 落 Next.js 时：`@theme` 合并进 [app/globals.css](../../app/globals.css)，组件沉淀回 [components/ui](../../components/ui)

## 已知占位（真实环境需替换）

- 地图为 SVG 占位 → 接 OneMap / Mapbox，随 Tab 切换图层
- 数据均为 mock（The Gazania / Jadescape 等）→ 接 `projects` / `project_scores` 表
- 雷达图为静态 SVG → 接 `ProjectScore` 四维数据动态渲染
