import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
const net = [];

page.on("request", (r) => {
  if (r.url().includes("/api/review/")) {
    net.push({ t: "req", m: r.method(), u: r.url(), b: r.postData() || "" });
  }
});
page.on("response", async (r) => {
  if (r.url().includes("/api/review/")) {
    let txt = "";
    try {
      txt = await r.text();
    } catch {
      txt = "";
    }
    net.push({ t: "res", s: r.status(), u: r.url(), body: txt.slice(0, 180) });
  }
});

const col = async (name) => {
  const sec = page.locator("section").filter({ has: page.getByRole("heading", { name }) }).first();
  const s = await sec.locator("span").first().innerText().catch(() => "-");
  return Number(s) || 0;
};
const msg = async () => page.locator("main p.text-amber-300").first().innerText().catch(() => "");
const snap = async () => ({
  raw: await col("RAW"),
  review: await col("REVIEW"),
  failed: await col("FAILED"),
  passed: await col("PASSED"),
  message: await msg(),
});
const mark = () => net.length;
const slice = (i) => net.slice(i);
const result = [];
const forcedFailedSampleId = "1ef9cdbe-2b6d-4d0b-9111-9dad784b577d";

await page.goto("http://localhost:3000/file-review", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

{
  const before = await snap();
  const i = mark();
  const card = page.locator("article").filter({ hasText: "qa-raw-sample-20260323.m4a" }).first();
  const exists = (await card.count()) > 0;
  if (exists) {
    await card.getByRole("button", { name: "분석" }).click({ timeout: 10000 });
  }
  await page.waitForTimeout(2500);
  const after = await snap();
  result.push({ case: "1 RAW->분석->REVIEW", executed: exists, before, after, network: slice(i) });
}

let passCardId = "";
{
  const before = await snap();
  const i = mark();
  const btn = page.getByRole("button", { name: "✔ 통과" }).first();
  const exists = (await btn.count()) > 0;
  if (exists) {
    passCardId = (await btn.locator("xpath=ancestor::article[1]").getAttribute("data-card-id")) || "";
    await btn.click({ timeout: 10000 });
  }
  await page.waitForTimeout(2200);
  const after = await snap();
  result.push({ case: "2 REVIEW->통과->PASSED", executed: exists, cardId: passCardId, before, after, network: slice(i) });
}

let failedSampleId = "";
{
  const before = await snap();
  const i = mark();
  const btn = page.getByRole("button", { name: "✖ 실패" }).first();
  const exists = (await btn.count()) > 0;
  if (exists) {
    failedSampleId = (await btn.locator("xpath=ancestor::article[1]").getAttribute("data-card-id")) || "";
    await btn.click({ timeout: 10000 });
  }
  await page.waitForTimeout(2200);
  const after = await snap();
  result.push({ case: "3 REVIEW->실패->FAILED", executed: exists, cardId: failedSampleId, before, after, network: slice(i) });
}

{
  const before = await snap();
  const i = mark();
  let executed = false;
  const targetId = forcedFailedSampleId || failedSampleId;
  if (targetId) {
    const card = page.locator(`article[data-card-id="${targetId}"]`);
    if ((await card.count()) > 0) {
      const rbtn = card.getByRole("button", { name: "🔁 재분석" });
      if ((await rbtn.count()) > 0) {
        await rbtn.click({ timeout: 10000 });
        executed = true;
      }
    }
  }
  await page.waitForTimeout(2500);
  const after = await snap();
  result.push({ case: "4 FAILED->재분석->REVIEW", executed, cardId: targetId, before, after, network: slice(i) });
}

{
  const before = await snap();
  const i = mark();
  const btn = page.getByRole("button", { name: "✔ 통과" }).first();
  const exists = (await btn.count()) > 0;
  if (exists) {
    await btn.click({ timeout: 10000 });
    await btn.click({ force: true, timeout: 10000 }).catch(() => {});
  }
  await page.waitForTimeout(2200);
  const after = await snap();
  const n = slice(i);
  const postCount = n.filter((x) => x.t === "req" && x.m === "POST" && x.u.includes("/api/review/calls/")).length;
  result.push({ case: "5 연속 클릭 중복 방지", executed: exists, before, after, reviewPostCount: postCount, network: n });
}

console.log(JSON.stringify(result, null, 2));
await browser.close();
