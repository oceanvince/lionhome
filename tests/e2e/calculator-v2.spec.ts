import { test, expect } from "@playwright/test";

// V2 calculator. The /compute route falls back to seed tax rates when no DB is
// present, so the questionnaire → result flow runs without Supabase.

async function fillStep1(page: import("@playwright/test").Page, identity: string, props: string) {
  await page.goto("/calculator");
  await page.getByRole("button", { name: "开始测算" }).click();
  await page.getByText(identity, { exact: true }).click();
  await page.getByText(props, { exact: true }).click();
  await page.getByRole("button", { name: "下一步" }).click();
}

test("SC first-home: completes 7-question flow and shows three price tiers", async ({ page }) => {
  await fillStep1(page, "新加坡公民", "0 套");

  // Step 2 — income / cash / CPF (unique labels to avoid cash/CPF collisions)
  await page.getByText("20,000 – 25,000", { exact: true }).click();
  await page.getByText("50 – 80 万", { exact: true }).click();
  await page.getByText("30 – 60 万", { exact: true }).click();
  await page.getByRole("button", { name: "下一步" }).click();

  // Step 3 — timeline
  await page.getByText("1 年内", { exact: true }).click();
  await page.getByRole("button", { name: "生成评估" }).click();

  // Result
  await expect(page.getByText("您的理性购房决策")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("舒适区")).toBeVisible();
  await expect(page.getByText("平衡区")).toBeVisible();
  await expect(page.getByText("压力区")).toBeVisible();
  // Block 3 break-even shows for first property
  await expect(page.getByText("③ 那这套房买不买划算？")).toBeVisible();
});

test("switching tier updates the cash-breakdown midpoint", async ({ page }) => {
  await fillStep1(page, "新加坡公民", "0 套");
  await page.getByText("20,000 – 25,000", { exact: true }).click();
  await page.getByText("50 – 80 万", { exact: true }).click();
  await page.getByText("30 – 60 万", { exact: true }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByText("1 年内", { exact: true }).click();
  await page.getByRole("button", { name: "生成评估" }).click();

  await expect(page.getByText("您的理性购房决策")).toBeVisible({ timeout: 15_000 });
  const midpointBefore = await page.getByText(/（区间中点）测算。/).textContent();
  await page.getByText("压力区").click();
  const midpointAfter = await page.getByText(/（区间中点）测算。/).textContent();
  expect(midpointAfter).not.toBe(midpointBefore);
});

test("second property hides the buy-vs-rent block", async ({ page }) => {
  await fillStep1(page, "新加坡公民", "2 套及以上");
  await page.getByText("20,000 – 25,000", { exact: true }).click();
  await page.getByText("50 – 80 万", { exact: true }).click();
  await page.getByText("30 – 60 万", { exact: true }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByText("1 年内", { exact: true }).click();
  await page.getByRole("button", { name: "生成评估" }).click();

  await expect(page.getByText("您的理性购房决策")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("③ 那这套房买不买划算？")).toHaveCount(0);
  await expect(page.getByText(/二套及以上不显示/)).toBeVisible();
});

test("foreigner skips the CPF question", async ({ page }) => {
  await fillStep1(page, "外籍·有工作许可", "0 套");
  await expect(page.getByText("家庭税前月收入（含配偶）")).toBeVisible();
  await expect(page.getByText("CPF OA 余额（可粗估）")).toHaveCount(0);
});
