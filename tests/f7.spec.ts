import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const widths = [320, 375, 768, 1024, 1440];
const shotWidths = [375, 768, 1024, 1440];

async function openCheckoutWithItem(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("terra-hop-cart", JSON.stringify([
      { slug: "oversized-burgundy-hoodie", size: "M", qty: 1 },
    ]));
  });
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: /إتمام الطلب|Checkout/ })).toBeVisible();
}

for (const w of widths) {
  test(`no horizontal scroll at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

for (const w of widths) {
  test(`checkout has no horizontal scroll at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await openCheckoutWithItem(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

for (const w of shotWidths) {
  test(`screenshot at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/");
    await page.screenshot({ path: `review/screenshots/home-${w}.png`, fullPage: true });
  });
}

test("axe: zero violations on the homepage", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("keyboard: skip link is the first focusable element", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("mobile menu: opens, Escape closes, focus returns to Menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Close" })).toBeHidden();
  await expect(menu).toBeFocused();
});

test("category filter marks the current category and filters products", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hoodies" }).click();
  await expect(page.getByRole("button", { name: /Hoodies/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Black Oversized Hoodie" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Washed Grey Tee" })).toHaveCount(0);
});

test("signup: invalid email shows the error, valid email shows success", async ({ page }) => {
  await page.goto("/");
  const field = page.getByLabel("Email address");
  await field.fill("name@");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Error: enter a valid email address.")).toBeVisible();
  await field.fill("name@example.com");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Thank you. You are on the list.")).toBeVisible();
});

test("reduced motion: transitions are removed", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://localhost:3100/");
  const duration = await page.evaluate(() => {
    const el = document.querySelector("section ul li a div img:nth-child(2)");
    return el ? getComputedStyle(el).transitionDuration : "missing";
  });
  expect(["0s", "0.00001s"]).toContain(duration);
  await context.close();
});

test("320px reflow at 200 percent zoom equivalent (640 wide, scaled)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Drop" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stay in the loop." })).toBeVisible();
});

test("stand-in page and 404 link home", async ({ page }) => {
  await page.goto("/not-in-preview");
  await expect(page.getByText("This page is not part of the preview yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});
