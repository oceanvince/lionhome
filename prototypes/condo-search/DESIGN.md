# DESIGN.md — Condo Search 决策报告

> 由 web-design skill（Phase B）产出。继承 LionHome「Quiet Luxury」设计系统（见 prototypes/c·e·f、[app/globals.css](../../app/globals.css)），为 Condo Search（[docs/CONDO_SEARCH_SPEC.md](../../docs/CONDO_SEARCH_SPEC.md)）新增决策报告专属组件。
>
> 适用页面：搜索结果页（search.html）、决策报告页（report.html）。

---

## 1. Visual Theme & Atmosphere

- **设计哲学**：理性、克制、可信。这是一个「替用户做决策准备」的工具，不是营销页——**信息密度优先于视觉炫技**，每个分数、每句结论都能点开看「怎么算的」。
- **氛围关键词**：Quiet Luxury · 编辑感 · 政府数据的冷静 · 衬线标题的分量感
- **一句话定调**：像一份印刷讲究的私人投资简报——结论先行、留白充足、数字说话、不确定性摊开。
- **交互档位**：**L1（精致静态）+ 局部 L2**。优雅 hover、柔和入场、tab 切换、「怎么算的」展开。**禁止** L3 重特效——PRD §13 硬性要求移动端 LCP < 2s、地图懒加载，炫技即违规。

---

## 2. Color Palette & Roles

完整继承现有 `@theme`，新增「结论徽章 / 评分档位 / 适配度」三组语义色。所有色带 RGB 辅助值便于 rgba。

```css
@theme {
  /* ── 继承：品牌基底 ───────────────────────────── */
  --color-primary: #2f4f3d; /* rgb(47,79,61)   主色·按钮·强调 */
  --color-primary-soft: #eaefeb; /* rgb(234,239,235) 选中底·浅强调 */
  --color-charcoal: #1a1c1a; /* rgb(26,28,26)   正文 */
  --color-offwhite: #fcfbf9; /* rgb(252,251,249) 页面底 */
  --color-cream: #f5f1e8; /* rgb(245,241,232) 卡片/分区底 */
  --color-border: #e5e5e5; /* rgb(229,229,229) 描边 */
  --color-warn: #8b3a1f; /* rgb(139,58,31)   警示文字 */
  --color-warn-soft: #f8efe8; /* rgb(248,239,232) 警示底 */

  /* ── 新增：结论徽章（三档软措辞，PRD §4.1.2）──── */
  --color-verdict-green: #2f6b4a; /* 值得入候选 Worth shortlisting */
  --color-verdict-green-soft: #e7f0ea;
  --color-verdict-amber: #b07a1e; /* 值得比较 Worth comparing */
  --color-verdict-amber-soft: #f7f0e0;
  --color-verdict-orange: #b5562a; /* 谨慎比较 Compare carefully */
  --color-verdict-orange-soft: #f7ece4;

  /* ── 新增：评分档位（雷达/维度卡，PRD §4.2）───── */
  --color-band-strong: #2f6b4a; /* 优秀 ≥7 Strong */
  --color-band-good: #5c8a6b; /* 良好 ≥5 */
  --color-band-fair: #b07a1e; /* 一般 ≥3 Mixed */
  --color-band-poor: #b5562a; /* 偏弱 <3 Caution */
  --color-band-na: #b8b8b0; /* 数据不足/即将上线 Missing（灰显）*/

  /* ── 新增：适配度（购买力，PRD §4.1.6）────────── */
  --color-fit-in: #2f6b4a; /* 在预算内 */
  --color-fit-over: #b07a1e; /* 略超 */

  --font-serif: "Noto Serif SC", Georgia, serif;
  --font-sans: "Noto Sans SC", "Inter", system-ui, sans-serif;
}
```

**角色约定**：

- 结论徽章配色**只**用 verdict-_ 三色，不复用 band-_，避免「结论」与「单维分数」语义混淆。
- 灰显（退出/租赁「即将上线」）一律用 `band-na`，雷达图上以 12% 透明度浅填。
- warn 系仅用于「数据诚实度」标注（数据覆盖低、相似盘估算），不滥用于普通提示。

---

## 3. Typography Rules

```html
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600&family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

| 层级            | 字体          | 字号/行高/字重                       | 用途                     |
| --------------- | ------------- | ------------------------------------ | ------------------------ |
| Display         | Noto Serif SC | 30–36px / 1.15 / 600                 | 报告页楼盘名「一眼看懂」 |
| H1              | Noto Serif SC | 24px / 1.25 / 600                    | 区块标题                 |
| H2              | Noto Serif SC | 18–20px / 1.3 / 600                  | 维度卡标题、Tab 内标题   |
| 评分数字        | Noto Serif SC | 40–56px / 1 / 600，`tabular-nums`    | 盈利分等大数字           |
| Body            | Noto Sans SC  | 15–16px / **1.75** / 400             | 一句话结论、解释         |
| Label / eyebrow | Noto Sans SC  | 12–13px / 1.5 / 500，`tracking-wide` | 标签、角标、信任条       |
| Caption         | Noto Sans SC  | 11–12px / 1.5 / 300–400              | 免责、数据来源           |

- **中文护栏**：正文行高 ≥ 1.7、`letter-spacing: 0.02em`、正文 ≥ 15px。数字统一 `font-variant-numeric: tabular-nums` 防跳动。
- **禁止字体**：不引入第三套西文展示字体；中英混排让 Noto 在前、Inter 兜底。
- **标题装饰**：Quiet Luxury 调性——标题**一律纯色 charcoal/primary，禁渐变、禁投影**（依 text-decoration-rules：克制衬线风格不加文字特效）。唯一例外：盈利分大数字可用 `band-*` 纯色着色表达档位。

---

## 4. Component Stylings

继承 prototype f 的 `.btn-primary / .btn-secondary / .seg / .radio-card`，新增决策报告组件。所有交互元素含 default / hover / active / focus / disabled。

### 4.1 按钮（继承）

```css
.btn-primary {
  @apply bg-primary hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-[4px] px-6 py-4 font-medium text-white transition-colors;
  min-height: 56px;
}
.btn-primary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.btn-primary:disabled {
  @apply cursor-not-allowed opacity-40;
}
.btn-secondary {
  @apply border-border text-charcoal w-full rounded-[4px] border bg-white px-6 py-4 font-medium transition-colors hover:bg-gray-50;
  min-height: 56px;
}
```

### 4.2 结论徽章 `.verdict-badge`（PRD §4.1.2）

```css
.verdict-badge {
  @apply inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium;
}
.verdict-badge.is-green {
  color: var(--color-verdict-green);
  background: var(--color-verdict-green-soft);
}
.verdict-badge.is-amber {
  color: var(--color-verdict-amber);
  background: var(--color-verdict-amber-soft);
}
.verdict-badge.is-orange {
  color: var(--color-verdict-orange);
  background: var(--color-verdict-orange-soft);
}
/* 前缀圆点用 currentColor */
```

三档文案固定：🟢 值得入候选 / 🟡 值得比较 / 🟠 谨慎比较（emoji 仅徽章内允许，正文禁用）。

### 4.3 维度评分卡 `.dim-card`（PRD §4.2）

```css
.dim-card {
  @apply border-border rounded-[4px] border bg-white p-5 transition-all;
}
.dim-card:hover {
  @apply border-gray-300;
}
.dim-card.is-coming {
  @apply bg-cream/50 border-dashed;
} /* 即将上线灰显 */
.dim-card .score {
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.dim-card .band-pill {
  @apply rounded-full px-2 py-0.5 text-xs font-medium;
}
.explain-toggle {
  @apply text-primary inline-flex cursor-pointer items-center gap-1 text-sm hover:underline;
} /* 「怎么算的？」 */
.explain-body {
  @apply border-border mt-3 border-t pt-3 text-sm leading-relaxed text-gray-600;
}
```

### 4.4 数据诚实度标注 `.honesty-tag`（PRD §4.3，设计红线）

```css
.honesty-tag {
  @apply inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-xs;
  color: var(--color-warn);
  background: var(--color-warn-soft);
}
```

触发即显示，文案如「相似盘估算」「数据覆盖低」「新盘」。这是**信任的核心**，不可省略。

### 4.5 适配度模块 `.fit-bar`（PRD §4.1.6，与四维同级）

```css
.fit-bar {
  @apply relative h-2 rounded-full bg-gray-100;
} /* 舒适区间轨道 */
.fit-bar .comfort {
  @apply absolute h-full rounded-full;
  background: var(--color-primary-soft);
}
.fit-bar .marker {
  @apply absolute -top-1 h-4 w-1 rounded-full;
} /* 本盘起价位置 */
.fit-dot {
  @apply inline-block h-2 w-2 rounded-full;
} /* 在预算内/略超 */
```

### 4.6 项目卡片 `.project-card`（PRD §3.2，搜索结果）

```css
.project-card {
  @apply border-border cursor-pointer rounded-[4px] border bg-white p-5 transition-all;
}
.project-card:hover {
  @apply border-gray-300 shadow-sm;
}
.project-card .psf {
  font-variant-numeric: tabular-nums;
}
.card-action {
  @apply border-border hover:text-primary hover:border-primary flex h-9 w-9 items-center justify-center rounded-full border bg-white text-gray-500 transition-colors;
}
.card-action.is-on {
  @apply text-primary border-primary bg-primary-soft;
} /* 收藏/对比选中 */
```

### 4.7 Tab 条 `.report-tab`（PRD §4.4，继承 .seg 思路但下划线式）

```css
.report-tab {
  @apply cursor-pointer border-b-2 border-transparent px-1 py-3 text-sm font-medium whitespace-nowrap text-gray-500 transition-colors;
}
.report-tab:hover {
  @apply text-charcoal;
}
.report-tab.active {
  @apply text-primary border-primary;
}
```

### 4.8 关键指标条 `.metric`（PRD §4.1.5）

```css
.metric {
  @apply flex flex-col gap-0.5;
}
.metric .v {
  @apply text-charcoal text-base font-medium;
  font-variant-numeric: tabular-nums;
}
.metric .k {
  @apply text-xs font-light text-gray-500;
}
```

### 4.9 市场状态标签 `.regime-tag`（PRD §4.2，带 tooltip）

```css
.regime-tag {
  @apply border-border inline-flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-600;
}
```

---

## 5. Layout Principles

- **容器**：移动端 `max-width:430px` 单列（继承现有原型）；报告页桌面 `max-width:1120px` **两栏**——左 720px 内容流、右 360px 伴随地图（PRD §4.5）。搜索结果桌面 2–3 列 grid。
- **间距梯度**：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48（4px 基准，呼应 4px 圆角）。区块间 32–48，卡片内 20。
- **网格**：搜索结果 `grid gap-4`，移动 1 列 / `md:` 2 列 / `lg:` 3 列。
- **首屏即决策**（PRD §13 红线）：报告页首屏**只**渲染决策快照（Block 1），维度详情/Tab/地图在其下，地图懒加载不计入 LCP。

---

## 6. Depth & Elevation

克制阴影体系，Quiet Luxury 不堆叠重投影：

```css
--shadow-sm: 0 1px 2px rgba(26, 28, 26, 0.04); /* 卡片 hover */
--shadow-md: 0 4px 16px rgba(26, 28, 26, 0.06); /* 弹层/吸底 CTA */
--shadow-card: 0 1px 3px rgba(26, 28, 26, 0.05); /* 默认卡片几乎不投影，靠 border 分隔 */
```

- 默认靠 **1px border** 划分层次，hover 才加 `shadow-sm`。
- 吸底 CTA 卡 `shadow-md` + 顶部 1px border。

---

## 7. Animation & Interaction（L1 + 局部 L2）

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.enter {
  animation: fadeInUp 0.4s ease-out both;
} /* 入场：区块依次淡入上移 */
.enter-2 {
  animation-delay: 0.08s;
}
.enter-3 {
  animation-delay: 0.16s;
}
```

- **入场（L1）**：决策快照各元素 `fadeInUp` stagger（≤ 160ms 内完成，不拖慢 LCP 观感）。
- **Hover（L1）**：卡片 border 变深 + 轻 shadow；徽章/按钮 `transition-colors`。
- **展开（L2）**：「怎么算的？」用 `max-height` + `opacity` 过渡（200ms ease），不用 JS 测高也可 grid-rows trick。
- **Tab 切换（L2）**：下划线 `border-color` 过渡 + 内容区淡入。
- **雷达图**：首次进入 `stroke-dashoffset` 描边动画 + 顶点 scale-in（一次性，≤ 600ms）。
- **地图（性能红线）**：移动端默认折叠，点击才 `初始化地图库`，占位用静态缩略图。
- **降级**：`@media (prefers-reduced-motion: reduce){ *{animation:none!important; transition:none!important} }`。

---

## 8. Do's and Don'ts（≥ 8 条）

**Do**

1. ✅ 结论先行：首屏给一句话结论 + 徽章，再给支撑分数。
2. ✅ 每个分数旁必有「怎么算的？」展开入口（PRD §4.1 红线）。
3. ✅ 数据不足时**显式**挂 `.honesty-tag`（相似盘估算/数据覆盖低/新盘）。
4. ✅ 价格一律表述为「近 12 月成交 PSF 区间的算术换算」并标注非估价。
5. ✅ 退出/租赁两维灰显 + 「即将上线」，且**不参与**结论徽章计算。
6. ✅ 数字用 `tabular-nums`；金额用 S$ + 千分位。
7. ✅ 报告页底部常驻合规免责条款。
8. ✅ 触摸目标 ≥ 44×44px；首屏只渲染决策快照保 LCP。

**Don't**

1. ❌ 不出现「估值 / 这套值 S$X / valuation / 强烈推荐 / 别买」等措辞（PRD §11 红线，可被检索 lint）。
2. ❌ 标题不加渐变/投影/描边（Quiet Luxury 禁文字特效）。
3. ❌ 不展示空列表或半截报告——冷启动/零结果走「按区浏览 + 留资」兜底。
4. ❌ 不用 L3 重特效（WebGL/scroll-jacking/custom cursor）——违反 LCP 红线。
5. ❌ 不把结论徽章色（verdict-_）和单维档位色（band-_）混用。
6. ❌ 不出现无法解释的黑箱分数。
7. ❌ Emoji 仅限结论徽章前缀，正文/按钮禁用。
8. ❌ 移动端 ≤ 600px 不得横向溢出；地图不得在首屏同步加载。

---

## 9. Responsive Behavior

| 断点                 | 搜索结果页                     | 决策报告页                                       |
| -------------------- | ------------------------------ | ------------------------------------------------ |
| **< 640px (mobile)** | 单列卡片，搜索框吸顶，Tab 横滑 | 单列；地图**默认折叠懒加载**；CTA 吸底；Tab 横滑 |
| **640–1024px (md)**  | 2 列 grid                      | 单列加宽，地图内联折叠                           |
| **≥ 1024px (lg)**    | 3 列 grid                      | **两栏**：左内容 720 + 右伴随地图 360（sticky）  |

- 触摸目标 ≥ 44×44px；卡片操作按钮 36px 视觉 + 44px 命中区。
- 兼容微信 / 小红书 / iOS Safari / Android Chrome 内置浏览器（PRD §13）；320–1920px 无溢出。
- `viewport-fit=cover` + 吸底 CTA 留 `env(safe-area-inset-bottom)`。

---

> **复用约定**：本文件 = LionHome 设计系统在「决策报告」场景的扩展层。新增组件优先沉淀回 [components/ui](../../components/ui)（button/radio-card/segmented-control 已存在）；落 Next.js 时把 `@theme` 合并进 [app/globals.css](../../app/globals.css)，prototype 仅作视觉验证。
