// Script: take screenshots for /guide page
// Usage: node scripts/take_guide_screenshots.js

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "https://erp.staleks.kz";
const OUT_DIR = path.join(__dirname, "..", "frontend", "public", "guide");
const VIEWPORT = { width: 1440, height: 860 };

async function clickTab(page, labelPattern) {
  // Tabs are rendered as buttons with matching text
  await page.getByRole("button", { name: labelPattern }).click();
  await page.waitForTimeout(800);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // ── 01: Login page ─────────────────────────────────────────────────────────
  console.log("01 login page...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/01-login.png` });
  console.log("   saved 01-login.png");

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log("   logging in as technologist...");
  await page.fill("#username", "technologist");
  await page.fill("#password", "ChangeMe123!");
  await page.click('button[type="submit"]');

  // Wait for redirect to configurator (technologist role)
  await page.waitForURL(/configurator|dashboard/, { timeout: 15000 });
  if (!page.url().includes("configurator")) {
    await page.goto(`${BASE_URL}/configurator`, { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(2000); // Wait for data to load

  // ── 02: Типы дверей (default tab) ─────────────────────────────────────────
  console.log("02 door-types...");
  await page.screenshot({ path: `${OUT_DIR}/02-door-types.png` });
  console.log("   saved 02-door-types.png");

  // ── 03: Модели ─────────────────────────────────────────────────────────────
  console.log("03 models...");
  await page.getByRole("button", { name: "Модели" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/03-models.png` });
  console.log("   saved 03-models.png");

  // ── 04: Секции ─────────────────────────────────────────────────────────────
  console.log("04 sections...");
  await page.getByRole("button", { name: /Секции/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/04-sections.png` });
  console.log("   saved 04-sections.png");

  // ── 05: Поля ───────────────────────────────────────────────────────────────
  console.log("05 fields...");
  await page.getByRole("button", { name: /Поля/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/05-fields.png` });
  console.log("   saved 05-fields.png");

  // ── 06: Видимость ──────────────────────────────────────────────────────────
  console.log("06 visibility...");
  await page.getByRole("button", { name: /Видимость/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/06-visibility.png` });
  console.log("   saved 06-visibility.png");

  // ── 07: Превью — заполненная форма ─────────────────────────────────────────
  console.log("07 preview filled...");
  await page.getByRole("button", { name: "Превью" }).click();
  await page.waitForTimeout(1500);

  // Try to select "Техническая" door type
  const techBtn = page
    .getByRole("button", { name: /Технич/ })
    .or(page.locator('button:has-text("Техническая")'))
    .first();
  if ((await techBtn.count()) > 0) {
    await techBtn.click();
    await page.waitForTimeout(500);
  }

  // Fill number inputs (height, width)
  const numInputs = page.locator('input[type="number"]');
  const count = await numInputs.count();
  if (count >= 2) {
    await numInputs.nth(0).fill("2050");
    await numInputs.nth(1).fill("860");
  } else if (count === 1) {
    await numInputs.nth(0).fill("2050");
  }
  await page.waitForTimeout(400);

  await page.screenshot({ path: `${OUT_DIR}/07-preview-filled.png` });
  console.log("   saved 07-preview-filled.png");

  // ── 08: Превью — правило видимости ─────────────────────────────────────────
  console.log("08 preview rule triggered...");
  // Find the "Кол-во створок" select and pick "2 створки"
  const selects = page.locator("select");
  const selCount = await selects.count();
  for (let i = 0; i < selCount; i++) {
    const options = await selects.nth(i).locator("option").allTextContents();
    const twoOption = options.find((o) => o.includes("2"));
    if (twoOption && options.some((o) => o.toLowerCase().includes("створ"))) {
      await selects.nth(i).selectOption({ label: twoOption });
      await page.waitForTimeout(800);
      break;
    }
  }
  await page.screenshot({ path: `${OUT_DIR}/08-preview-rule.png` });
  console.log("   saved 08-preview-rule.png");

  // ── 09: Услуги и финансы ───────────────────────────────────────────────────
  console.log("09 services...");
  await page.getByRole("button", { name: /Услуги/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/09-services.png` });
  console.log("   saved 09-services.png");

  await browser.close();
  console.log("\nAll screenshots saved to frontend/public/guide/");
}

run().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
