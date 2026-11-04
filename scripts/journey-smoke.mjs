#!/usr/bin/env node
/*
 * End-to-end smoke test for the marketplace journey and its supporting routes.
 * Usage: BASE_URL=http://localhost:3000 node scripts/journey-smoke.mjs
 * Requires a running server with a seeded database (the first request seeds it).
 * Creates a new customer account per run; no existing data is modified except the new order.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
// 1x1 PNG used only as a placeholder document image in the professional application.
const TINY_PNG = "data:image/png;base64,iVBORw0KGgo=";
let cookie = "";

function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function absorbCookies(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const m = raw.match(/arena_session=([^;]+)/);
    if (m) cookie = `arena_session=${m[1]}`;
  }
}

async function api(method, path, body, { as, anonymous = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (anonymous) {
    // no cookie at all
  } else if (as) headers.cookie = as;
  else if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  if (!as && !anonymous) absorbCookies(res);
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, error: json?.error };
}

async function login(identifier, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password }), redirect: "manual" });
  const raw = res.headers.getSetCookie?.() ?? [];
  const m = raw.map((c) => c.match(/arena_session=([^;]+)/)).find(Boolean);
  return m ? `arena_session=${m[1]}` : "";
}

async function page(path, withCookie = "") {
  const res = await fetch(`${BASE}${path}`, { headers: withCookie ? { cookie: withCookie } : {}, redirect: "manual" });
  return { status: res.status, text: await res.text(), location: res.headers.get("location") };
}

const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const phone = `0912${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

// ---------- 1. Registration and phone verification ----------
const reg = await api("POST", "/auth/register", { fullName: "مشتری آزمایشی", phone, password: "Test1234", acceptTerms: true });
check("register customer", reg.status === 201, reg.error?.message ?? "");
const verify = await api("POST", "/auth/verify-phone", { code: reg.data?.devCode });
check("verify phone", verify.status === 200, verify.error?.message ?? "");

// ---------- 2. Homepage data, search and suggestions ----------
const cats = await api("GET", "/catalog/categories");
check("category tree (20 parents)", cats.data?.length === 20, `count=${cats.data?.length}`);
const s1 = await api("GET", `/search?q=${encodeURIComponent("نشتی")}`);
check("search: partial Persian term", (s1.data?.total ?? 0) > 0, `total=${s1.data?.total}`);
const s2 = await api("GET", `/search?q=${encodeURIComponent("کولر")}`);
check("search: synonym (کولر)", (s2.data?.total ?? 0) > 0, `total=${s2.data?.total}`);
const sug = await api("GET", `/search/suggest?q=${encodeURIComponent("نشت")}`);
check("search suggestions", (sug.data?.services?.length ?? 0) > 0);

// ---------- 3. Service detail and booking ----------
const svcPage = await page("/services/leak-fix");
check("service detail page renders", svcPage.status === 200 && svcPage.text.includes("رفع نشتی آب"));
const bookingBody = {
  serviceSlug: "leak-fix",
  answers: { problemType: "نشتی لوله", location: "آشپزخانه", waterStopped: "خیر، فقط نشتی دارد", problemDescription: "زیر سینک نشتی دارد", urgency: "عادی (طی ۲ تا ۳ روز آینده)" },
  attachments: [],
  address: { title: "منزل", city: "تهران", region: "شمال تهران", addressLine: "خیابان ولیعصر، پلاک ۱۰", details: "واحد ۲", isDefault: false },
  scheduledDate: tomorrow,
  timeSlot: "10-12",
  urgent: false,
  flexible: false,
  notes: "",
  saveAddress: true,
};
const invalid = await api("POST", "/orders", { ...bookingBody, answers: { ...bookingBody.answers, problemDescription: "" } });
check("booking validation returns field errors", invalid.status === 422 && !!invalid.error?.fieldErrors?.problemDescription, invalid.error?.message ?? "");
const created = await api("POST", "/orders", bookingBody);
check("create order", created.status === 201 && !!created.data?.id, created.error?.message ?? "");
const oid = created.data?.id;

await new Promise((r) => setTimeout(r, 7000));
let det = await api("GET", `/orders/${oid}`);
check("demo offers arrive for the order", (det.data?.offers?.length ?? 0) >= 1 && det.data?.order?.status === "offers_received", `offers=${det.data?.offers?.length}`);

// A new professional applies (pending), is approved by admin, then answers the customer's request with a real offer.
const adminEarly = await login("09120000000", "Admin1234");
const tree = await api("GET", "/catalog/categories");
const leakCategoryId = tree.data?.flatMap((p) => p.children).find((c) => c.slug === "leak-repair")?.id;
const proPhone = `0913${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
const apply = await api("POST", "/pro/register", {
  fullName: "متخصص آزمایشی", phone: proPhone, password: "Test1234", headline: "متخصص نشتی آزمایشی",
  bio: "تجربه ده‌ساله در نشت‌یابی و تعمیر لوله‌های ساختمان با تجهیزات استاندارد.",
  categoryIds: [leakCategoryId], skills: ["نشت‌یابی"], experienceYears: 10, serviceAreas: ["تهران"],
  workingDays: ["sat", "sun", "mon"], workingFrom: "08:00", workingTo: "20:00", minPrice: 200000, hourlyRate: 120000,
  documents: [{ type: "national_card", name: "کارت-ملی.png", dataUrl: TINY_PNG }, { type: "certificate", name: "گواهی.png", dataUrl: TINY_PNG }],
  acceptTerms: true,
}, { anonymous: true });
check("professional application stored", apply.status === 201 && !!apply.data?.user?.id, apply.error?.message ?? "");
const proCookieNew = await login(proPhone, "Test1234");
const pendingRequests = await api("GET", "/pro/requests", undefined, { as: proCookieNew });
check("pending professional receives no requests", pendingRequests.status === 200 && Array.isArray(pendingRequests.data) && pendingRequests.data.length === 0);
const approve = await api("POST", `/admin/professionals/${apply.data?.user?.id}/decision`, { decision: "approve", notes: "مدارک بررسی شد" }, { as: adminEarly });
check("admin approves professional", approve.status === 200, approve.error?.message ?? "");
const requests = await api("GET", "/pro/requests", undefined, { as: proCookieNew });
check("approved professional sees the customer request", requests.data?.some((r) => r.id === oid), `count=${requests.data?.length}`);
const offerRes = await api("POST", `/pro/requests/${oid}/offer`, { price: 260000, arrivalMinutes: 45, description: "نشت‌یابی و رفع نشتی با تعویض اتصالات و آزمون فشار." }, { as: proCookieNew });
check("professional submits offer", offerRes.status === 201, offerRes.error?.message ?? "");
det = await api("GET", `/orders/${oid}`);
check("customer sees 2+ offers including the real one", (det.data?.offers?.length ?? 0) >= 2 && det.data?.offers?.some((o) => o.professional?.fullName === "متخصص آزمایشی"), `offers=${det.data?.offers?.length}`);
const chosen = det.data?.offers?.find((o) => o.professional?.userId === apply.data?.user?.id);
const sel = await api("POST", `/orders/${oid}/select-offer`, { offerId: chosen?.id });
check("select professional", sel.data?.status === "professional_selected", sel.error?.message ?? "");
const init = await api("POST", `/orders/${oid}/payment/init`);
check("sandbox payment init", !!init.data?.providerRef, init.error?.message ?? "");
const pay = await api("POST", `/orders/${oid}/payment/verify`, { outcome: "success" });
check("sandbox payment success confirms order", pay.data?.status === "paid", pay.error?.message ?? "");
det = await api("GET", `/orders/${oid}`);
check("order is confirmed and paid", det.data?.order?.status === "confirmed" && det.data?.order?.paymentStatus === "paid");

const confirmPage = await page(`/booking/order/${oid}`, cookie);
check("confirmation page /booking/order/[id] (refresh-safe)", confirmPage.status === 200);
const bookingGuest = await page(`/booking/order/${oid}`);
check("confirmation page redirects guests to login", bookingGuest.status >= 300 && bookingGuest.status < 400 && (bookingGuest.location ?? "").includes("/login"), bookingGuest.location ?? "");
const invoice = await page(`/account/orders/${oid}/invoice`, cookie);
check("invoice page renders with order code", invoice.status === 200 && /AR-\d+/.test(invoice.text));

// ---------- 4. Customer dashboard ----------
const list = await api("GET", "/orders");
check("dashboard lists the order", list.data?.some((o) => o.id === oid));
const notif = await api("GET", "/notifications");
check("notifications created", (notif.data?.items?.length ?? 0) > 0);
const wallet = await api("GET", "/wallet");
check("wallet records the payment", wallet.data?.transactions?.some((t) => t.type === "customer_payment"));
const favKeys = await api("GET", "/favorites/keys");
check("favourites state endpoint (signed in)", favKeys.data?.signedIn === true && Array.isArray(favKeys.data?.keys));
const toggleProFav = await api("POST", "/favorites/toggle", { targetType: "professional", targetId: "00000000-0000-0000-0000-000000000000" });
check("professional favourite toggle accepts pro ids", toggleProFav.status === 200 || toggleProFav.status === 404, `status=${toggleProFav.status}`);

for (const p of ["/account", "/account/orders", `/account/orders/${oid}`, "/account/addresses", "/account/favorites", "/account/reviews", "/account/notifications", "/account/wallet", "/account/profile", "/account/messages"]) {
  const r = await page(p, cookie);
  check(`GET ${p}`, r.status === 200, `status=${r.status}`);
}

// ---------- 5. Public content, SEO ----------
const newsOk = await api("POST", "/newsletter", { email: `reader${Date.now()}@example.com` });
check("newsletter subscription", newsOk.status === 201, newsOk.error?.message ?? "");
const newsBad = await api("POST", "/newsletter", { email: "not-an-email" });
check("newsletter rejects invalid email", newsBad.status === 422 && !!newsBad.error?.fieldErrors?.email);
const blog = await page("/blog");
check("blog index", blog.status === 200);
const post = await page("/blog/how-to-choose-plumber");
check("published blog post", post.status === 200);
const draft = await page("/blog/draft-smart-home-guide");
check("draft blog post is hidden", draft.status === 404, `status=${draft.status}`);
const about = await page("/pages/about");
check("static page /pages/about", about.status === 200);
const missingPage = await page("/pages/does-not-exist");
check("missing static page is 404", missingPage.status === 404);
const sitemap = await page("/sitemap.xml");
check("sitemap.xml", sitemap.status === 200 && sitemap.text.includes("<urlset"));
const robots = await page("/robots.txt");
check("robots.txt", robots.status === 200 && robots.text.includes("Sitemap"));

// ---------- 6. Professional ----------
const proCookie = await login("09120000002", "Demo1234");
check("professional login", proCookie.length > 0);
const proOffers = await api("GET", "/pro/offers", undefined, { as: proCookie });
check("professional sees own offers", proOffers.status === 200 && Array.isArray(proOffers.data));
const proProfile = await api("GET", "/pro/profile", undefined, { as: proCookie });
check("professional profile includes portfolio", Array.isArray(proProfile.data?.profile?.portfolio));
const proNotifPage = await page("/pro/notifications", proCookie);
check("professional notifications page", proNotifPage.status === 200);
const proProfilePage = await page("/pro/profile", proCookie);
check("professional profile page", proProfilePage.status === 200);
const customerOnPro = await api("GET", "/pro/offers", undefined, { as: cookie });
check("customer blocked from professional API", customerOnPro.status === 403, `status=${customerOnPro.status}`);

// ---------- 7. Admin ----------
const adminCookie = await login("09120000000", "Admin1234");
check("admin login", adminCookie.length > 0);
const adminOrder = await api("GET", `/admin/orders/${oid}`, undefined, { as: adminCookie });
check("admin order detail API", adminOrder.status === 200 && Array.isArray(adminOrder.data?.offers), adminOrder.error?.message ?? "");
const adminUser = await api("GET", `/admin/users/${reg.data?.user?.id}`, undefined, { as: adminCookie });
check("admin user detail API", adminUser.status === 200);
const svcs = await api("GET", "/admin/services", undefined, { as: adminCookie });
const sample = svcs.data?.find((s) => s.slug === "leak-fix");
check("admin service list includes content fields", Array.isArray(sample?.benefits) && sample.benefits.length > 0);
if (sample) {
  // Mirrors the admin form: the full record is resent, so benefits and SEO must survive an edit.
  const body = {
    categoryId: sample.categoryId, slug: sample.slug, title: sample.title, shortDescription: sample.shortDescription, description: sample.description,
    benefits: sample.benefits, steps: sample.steps, requirements: sample.requirements, priceFactors: sample.priceFactors, keywords: sample.keywords,
    basePrice: sample.basePrice, durationMinutes: sample.durationMinutes, formFamily: sample.formFamily, questions: sample.questions, faqs: sample.faqs,
    seoTitle: sample.seoTitle, seoDescription: sample.seoDescription, tone: sample.tone, isPopular: sample.isPopular, isActive: sample.isActive,
  };
  const saved = await api("PUT", `/admin/services/${sample.id}`, body, { as: adminCookie });
  const after = (await api("GET", "/admin/services", undefined, { as: adminCookie })).data?.find((s) => s.slug === "leak-fix");
  check("admin service save preserves benefits/steps/SEO", saved.status === 200 && after?.benefits?.length === sample.benefits.length && after?.steps?.length === sample.steps.length, saved.error?.message ?? "");
}
const contentBanners = await api("GET", "/admin/content/banners", undefined, { as: adminCookie });
check("admin banners list", Array.isArray(contentBanners.data));
const adminProList = await api("GET", "/admin/professionals?status=verified", undefined, { as: adminCookie });
check("admin professional list", Array.isArray(adminProList.data));
const adminOverview = await api("GET", "/admin/overview", undefined, { as: cookie });
check("customer blocked from admin API", adminOverview.status === 403, `status=${adminOverview.status}`);
const adminPage = await page("/admin/catalog", adminCookie);
check("admin catalog page", adminPage.status === 200);

// ---------- 8. Guards ----------
const anon = await api("GET", "/orders", undefined, { anonymous: true });
check("anonymous customer API is 401", anon.status === 401, `status=${anon.status}`);

// ---------- 9. Authentication hardening and business rules ----------
const rlIdentifier = `0919${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
const attempts = [];
for (let i = 0; i < 9; i++) {
  const r = await api("POST", "/auth/login", { identifier: rlIdentifier, password: "Wrong1234" }, { anonymous: true });
  attempts.push(r.status);
}
check("login rate limit: 8 failures then 429", attempts.slice(0, 8).every((s) => s === 401) && attempts[8] === 429, attempts.join(","));

const pwWrong = await api("POST", "/me/password", { currentPassword: "Wrong1234", newPassword: "Changed1234" });
check("password change rejects wrong current password", pwWrong.status === 422, `status=${pwWrong.status}`);
const pwOk = await api("POST", "/me/password", { currentPassword: "Test1234", newPassword: "Changed1234" });
check("password change succeeds", pwOk.status === 200, pwOk.error?.message ?? "");
const relog = await login(phone, "Changed1234");
check("login with the new password", relog.length > 0);
const oldPwd = await login(phone, "Test1234");
check("old password no longer works", oldPwd.length === 0);

const bookDate = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
const bookA = await api("POST", "/orders", { ...bookingBody, scheduledDate: bookDate, timeSlot: "16-18" });
const bookB = await api("POST", "/orders", { ...bookingBody, scheduledDate: bookDate, timeSlot: "16-18" });
check("two bookings for the same slot can be created", bookA.status === 201 && bookB.status === 201);
const demoProId = apply.data?.user?.id;
const assignA = await api("POST", `/admin/orders/${bookA.data?.id}/assign`, { professionalId: demoProId }, { as: adminCookie });
check("admin assigns professional to first booking", assignA.status === 200, assignA.error?.message ?? "");
const assignB = await api("POST", `/admin/orders/${bookB.data?.id}/assign`, { professionalId: demoProId }, { as: adminCookie });
check("double booking is rejected (409)", assignB.status === 409, `status=${assignB.status}`);
const confirmUnpaid = await api("POST", `/admin/orders/${bookA.data?.id}/status`, { status: "confirmed" }, { as: adminCookie });
check("confirming an unpaid order is rejected (409)", confirmUnpaid.status === 409, `status=${confirmUnpaid.status}`);

const adminOffers = await api("GET", "/admin/offers?status=all", undefined, { as: adminCookie });
check("admin offers list", adminOffers.status === 200 && Array.isArray(adminOffers.data) && adminOffers.data.length > 0);
const adminAudit = await api("GET", "/admin/audit", undefined, { as: adminCookie });
check("admin activity log", adminAudit.status === 200 && Array.isArray(adminAudit.data));
const customerAdminOffers = await api("GET", "/admin/offers", undefined, { as: cookie });
check("customer blocked from admin offers", customerAdminOffers.status === 403, `status=${customerAdminOffers.status}`);

const securityPage = await page("/account/security", cookie);
check("customer security page", securityPage.status === 200);
const calendarPage = await page("/pro/calendar", proCookie);
check("professional calendar page", calendarPage.status === 200);
const offersPage = await page("/admin/offers", adminCookie);
check("admin offers page", offersPage.status === 200);
const logsPage = await page("/admin/logs", adminCookie);
check("admin activity log page", logsPage.status === 200);
const denied = await page("/access-denied");
check("access denied page", denied.status === 200);
const seededCategories = await api("GET", "/catalog/categories");
check("seed: 20 parent categories", seededCategories.data?.length === 20, `count=${seededCategories.data?.length}`);
const seededPros = await api("GET", "/admin/professionals?status=verified", undefined, { as: adminCookie });
check("seed: at least 20 verified professionals", (seededPros.data?.length ?? 0) >= 20, `count=${seededPros.data?.length}`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
