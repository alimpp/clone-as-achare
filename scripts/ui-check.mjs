#!/usr/bin/env node
/*
 * Responsive and console check across viewport widths.
 *   BASE_URL=http://localhost:3000 WIDTHS=320,390,768,1024,1440 node scripts/ui-check.mjs
 * Requires the `playwright` package and an installed Chromium (npx playwright install --with-deps chromium).
 * Reports horizontal page overflow, elements that extend past the viewport edge without a scrollable
 * ancestor, and browser errors. Body-level clipping does not excuse an overflow.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const WIDTHS = (process.env.WIDTHS ?? "320,390,768,1024,1440").split(",").map(Number);
const PUBLIC = [
  "/",
  "/categories",
  "/categories/plumbing",
  "/services/leak-fix",
  `/search?q=${encodeURIComponent("نشتی")}`,
  "/booking/leak-fix",
  "/login",
  "/register",
  "/become-a-pro",
  "/blog",
  "/pages/about",
];
const ACCOUNTS = [
  { role: "customer", phone: "09120000001", password: "Demo1234", paths: ["/account", "/account/orders", "/account/addresses", "/account/security", "/account/wallet"] },
  { role: "professional", phone: "09120000002", password: "Demo1234", paths: ["/pro", "/pro/calendar", "/pro/profile", "/pro/earnings"] },
  { role: "admin", phone: "09120000000", password: "Admin1234", paths: ["/admin", "/admin/offers", "/admin/logs", "/admin/catalog", "/admin/orders"] },
];

/** Runs inside the page: finds overflow and the elements responsible. */
function measure(vw) {
  const doc = document.documentElement;
  const wide = doc.scrollWidth - doc.clientWidth;
  const offenders = [];
  const hasScrollableAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "hidden" || ox === "scroll" || ox === "clip") return true;
      p = p.parentElement;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.position === "fixed" || style.display === "none") continue;
    if (r.right > vw + 1 || r.left < -1) {
      if (hasScrollableAncestor(el)) continue;
      const cls = String(el.getAttribute("class") ?? "").split(" ").slice(0, 4).join(" ");
      const text = (el.textContent ?? "").trim().slice(0, 24);
      offenders.push(`${el.tagName.toLowerCase()} ${Math.round(r.left)}..${Math.round(r.right)} [${cls}] "${text}"`);
    }
    if (offenders.length >= 4) break;
  }
  return { wide, offenders };
}

const browser = await chromium.launch();
const rows = [];
let consoleErrors = 0;

async function inspect(page, path, width) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 140));
  };
  const onPageError = (e) => errors.push(e.message.slice(0, 140));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  let status = "?";
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30_000 });
    status = response ? response.status() : "no-response";
  } catch (e) {
    status = `nav-error: ${String(e.message).slice(0, 60)}`;
  }
  await page.waitForTimeout(350);
  const result = await page.evaluate(measure, width);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  const relevant = errors.filter((e) => !/status of (401|404)/.test(e));
  consoleErrors += relevant.length;
  rows.push({ width, path, status, overflowPx: result.wide, offenders: result.offenders, errors: relevant.slice(0, 2) });
}

for (const width of WIDTHS) {
  const height = width < 600 ? 800 : 900;
  const isMobile = width < 768;
  const options = { viewport: { width, height }, locale: "fa-IR", isMobile, hasTouch: isMobile, reducedMotion: "reduce" };

  const anon = await browser.newContext(options);
  const ap = await anon.newPage();
  for (const path of PUBLIC) await inspect(ap, path, width);
  await anon.close();

  for (const account of ACCOUNTS) {
    const ctx = await browser.newContext(options);
    const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { identifier: account.phone, password: account.password } });
    if (login.status() !== 200) {
      rows.push({ width, path: `login ${account.role}`, status: login.status(), overflowPx: 0, offenders: [], errors: ["login failed"] });
      await ctx.close();
      continue;
    }
    const p = await ctx.newPage();
    for (const path of account.paths) await inspect(p, path, width);
    await ctx.close();
  }
}

await browser.close();

const problems = rows.filter((r) => r.status !== 200 || r.overflowPx > 1 || r.offenders.length > 0 || r.errors.length > 0);
console.log(`Checked ${rows.length} page views across ${WIDTHS.length} widths: ${rows.length - problems.length} clean, ${problems.length} with findings.`);
for (const r of problems) console.log(JSON.stringify(r));
console.log(`Browser errors (excluding expected 401/404): ${consoleErrors}`);
process.exit(problems.length === 0 ? 0 : 1);
