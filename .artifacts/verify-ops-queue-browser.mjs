/**
 * Browser verification for /ops/queue (Playwright).
 * Requires: dev server on http://localhost:3000, `npx playwright install chromium` once.
 */
import { chromium } from "playwright";

const BASE = process.env.OPS_QUEUE_BASE_URL ?? "http://localhost:3000";

async function waitNoLoading(page) {
  await page.getByText("Loading…").waitFor({ state: "hidden", timeout: 60000 });
}

async function clickTab(page, label) {
  await page.getByRole("button", { name: label }).click();
  await page.getByText("Loading…").waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  await waitNoLoading(page);
}

function panel(page) {
  return page.getByTestId("ops-queue-panel");
}

async function assertTabContent(page, emptyMessage) {
  const root = panel(page);
  const table = root.getByRole("columnheader", { name: "Call ID" });
  const empty = root.getByText(emptyMessage);
  /** 테이블 영역의 로드 에러만 본다(전역 live region 오탐 방지). */
  const err = root.getByRole("alert").filter({ hasText: /\S/ });
  const hasTable = await table.isVisible().catch(() => false);
  const hasEmpty = await empty.isVisible().catch(() => false);
  const hasErr = await err.isVisible().catch(() => false);
  if (hasErr) {
    const t = await err.textContent();
    throw new Error(`Queue load error: ${t}`);
  }
  if (!hasTable && !hasEmpty) {
    throw new Error(`Expected table or empty: ${emptyMessage}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    await page.goto(`${BASE}/ops/queue`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("heading", { name: "Operations Queue" }).waitFor({ timeout: 30000 });
    results.push("page: Operations Queue heading visible");

    await waitNoLoading(page);
    await assertTabContent(page, "Failed queue is empty");
    results.push("tab Failed: loaded (table or empty)");

    await clickTab(page, "Needs Review");
    await assertTabContent(page, "No calls need review");
    results.push("tab Needs Review: loaded (table or empty)");

    await clickTab(page, "Retry Queue");
    await assertTabContent(page, "Retry queue is empty");
    results.push("tab Retry Queue: loaded (table or empty)");

    /** 네비 검증: row가 있는 탭에서 링크 클릭 */
    let navigated = false;
    for (const [label, emptyMsg] of [
      ["Failed", "Failed queue is empty"],
      ["Needs Review", "No calls need review"],
      ["Retry Queue", "Retry queue is empty"],
    ]) {
      await clickTab(page, label);
      await assertTabContent(page, emptyMsg);
      const firstCallLink = page.locator('a[href^="/calls/"]').first();
      if (await firstCallLink.isVisible()) {
        await firstCallLink.click();
        await page.waitForURL(/\/calls\/[0-9a-f-]{8,}/i, { timeout: 15000 });
        results.push(`nav: opened ${page.url()} (from tab ${label})`);
        await page.goBack({ waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Operations Queue" }).waitFor({ timeout: 15000 });
        await waitNoLoading(page);
        results.push("nav: returned to /ops/queue");
        navigated = true;
        break;
      }
    }
    if (!navigated) results.push("nav: skipped (no rows with /calls/ link in any tab)");

    /** 워크플로: 버튼이 보이는 첫 탭에서 실행 */
    let wfDone = false;
    for (const [label, emptyMsg] of [
      ["Failed", "Failed queue is empty"],
      ["Needs Review", "No calls need review"],
      ["Retry Queue", "Retry queue is empty"],
    ]) {
      await clickTab(page, label);
      await assertTabContent(page, emptyMsg);
      const wfBtn = page.getByRole("button", { name: "Re-run Workflow" }).first();
      if (await wfBtn.isVisible()) {
        const [resp] = await Promise.all([
          page.waitForResponse(
            (r) =>
              r.url().includes("/api/calls/") &&
              r.url().includes("/workflow") &&
              r.request().method() === "POST",
            { timeout: 60000 },
          ),
          wfBtn.click(),
        ]);
        results.push(`workflow: tab=${label} POST status ${resp.status()}`);
        const rootWf = panel(page);
        await rootWf.getByRole("status").waitFor({ state: "visible", timeout: 15000 });
        const banner = await rootWf.getByRole("status").textContent();
        results.push(`banner: ${String(banner).trim().slice(0, 120)}`);
        await waitNoLoading(page);
        results.push("refetch: Loading… cycle completed after workflow");
        wfDone = true;
        break;
      }
    }
    if (!wfDone) results.push("workflow: skipped (no rows in any tab)");

    /** 분석: 버튼이 보이는 첫 탭에서 실행 */
    let anDone = false;
    for (const [label, emptyMsg] of [
      ["Failed", "Failed queue is empty"],
      ["Needs Review", "No calls need review"],
      ["Retry Queue", "Retry queue is empty"],
    ]) {
      await clickTab(page, label);
      await assertTabContent(page, emptyMsg);
      const anBtn = page.getByRole("button", { name: "Re-run Analysis" }).first();
      if (await anBtn.isVisible()) {
        const [resp] = await Promise.all([
          page.waitForResponse(
            (r) =>
              r.url().includes("/api/calls/") &&
              r.url().includes("/analyze") &&
              r.request().method() === "POST",
            { timeout: 180000 },
          ),
          anBtn.click(),
        ]);
        results.push(`analyze: tab=${label} POST status ${resp.status()}`);
        const rootAn = panel(page);
        await rootAn.getByRole("status").waitFor({ state: "visible", timeout: 5000 });
        const banner2 = await rootAn.getByRole("status").textContent();
        results.push(`banner(after analyze): ${String(banner2).trim().slice(0, 120)}`);
        await waitNoLoading(page);
        results.push("refetch: Loading… cycle completed after analyze");
        anDone = true;
        break;
      }
    }
    if (!anDone) results.push("analyze: skipped (no rows in any tab)");

    console.log("=== OPS QUEUE BROWSER VERIFY OK ===");
    for (const line of results) console.log(line);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("=== OPS QUEUE BROWSER VERIFY FAIL ===", e);
  process.exit(1);
});
