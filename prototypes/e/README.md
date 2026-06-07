# Prototype E — 场景 A：我看中了一套房

**目标：** 用户已经有具体心仪房价（如 Jadescape 185 万），想知道"买这套大概要多少现金、月供多少、扛不扛得住"。

源文件：[index.html](./index.html) — 可在浏览器直接打开，完整可点击交互原型。

## 包含 7 个 view

1. **Hero** — 二选一入口（"我看中了一套房" vs "我不知道能买多少"，后者跳到 prototype c/d）
2. **目标房价** — 滑块（50 – 500 万）+ 快捷预设（120/150/180/220/260 万）
3. **Step 1** — 身份 + 持有套数
4. **Step 2** — 收入 · 现金 · CPF（区间档位）
5. **Step 3** — 年龄 + 贷款年限
6. **Loading** — 计算动画（占位 ~2.4s）
7. **Result** — 三态切换（**可行 / 现金不足 / 月供超 TDSR**），右下角 demo bar 可切换演示

## 与 c/d 的关系

- 复用同一套设计 token（Quiet Luxury · #2F4F3D primary · Noto Serif/Sans SC · 4px radius）
- 移动端 max-width 430px
- 数据全是硬编码 demo，**不连后端**，仅用于设计评审
- 待 UX 确认后，将在 Next.js 主仓库 [app/(tools)/calculator/page.tsx](<../../app/(tools)/calculator/page.tsx>) 实现

## 关键设计点

- **入口岔口**：用户进来先选场景，不强塞流程
- **目标房价**：滑块 + 大字 + 预设 —— 让 1 秒能选完
- **Result 大字逻辑**：
  - 可行 → "需要现金 S$ XXX"（绿色 cream 底）
  - 不可行 → "还差 S$ XXX" 或 "月供超 S$ XXX/月"（暖色 warn 底）
- **诊断面板**：不可行时给 3 个出路（攒钱 / 降预算 / 延年限）
- **应急金提示**：买完后建议留 12 月家庭开销，独立卡片强调
