import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coupons, newsletterSubscribers, professionalProfiles, users, verificationCodes } from "@/db/schema";
import { ApiError, createSession, destroySession, generateOtp, getCurrentUser, hashPassword, requireUser, revokeAllSessions, revokeOtherSessions, verifyPassword, type SessionUser } from "@/lib/auth";
import { assertNotLimited, clearFailures, consumeRateLimit, deliverOtp, recordFailure } from "@/lib/security";
import * as account from "@/lib/account";
import * as admin from "@/lib/admin";
import * as catalog from "@/lib/catalog";
import * as orders from "@/lib/orders";
import * as pro from "@/lib/pro";
import { ensureSeeded } from "@/lib/seed";
import { ORDER_STATUSES, toEnglishDigits, normalizeFa, type Role } from "@/lib/domain";
import * as v from "@/lib/validation";

/*
 * REST API router. The catch-all Next.js route (src/app/api/[...path]/route.ts)
 * delegates every request here. Each route: method + path pattern -> handler.
 * Handlers validate input with Zod, enforce authentication/roles, and call the
 * service layer (src/lib/*). Responses use the envelope { data } or { error }.
 */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Ctx {
  params: Record<string, string>;
  body: unknown;
  query: URLSearchParams;
  user: () => Promise<SessionUser>;
}

interface Route {
  method: Method;
  parts: string[];
  handler: (ctx: Ctx) => Promise<unknown>;
  status?: number;
}

const CUSTOMER: Role[] = ["customer"];
const PRO: Role[] = ["professional"];
const ADMIN: Role[] = ["admin"];

function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join(".") || "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new ApiError(422, result.error.issues[0]?.message ?? "اطلاعات ارسالی نامعتبر است", "validation", fieldErrors);
  }
  return result.data as z.output<S>;
}

function num(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, "شناسه نامعتبر است", "bad_request");
  return n;
}

function bodyObject(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function r(method: Method, pattern: string, handler: Route["handler"], status?: number): Route {
  return { method, parts: pattern.split("/").filter(Boolean), handler, status };
}

function sanitizeUser(user: SessionUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    phoneVerified: user.phoneVerified,
  };
}

/**
 * Creates and delivers a verification code. The code is stored hashed-by-expiry only in the
 * verification table; it is returned to the caller only when the sandbox echo is enabled.
 */
async function issueCode(phone: string, purpose: "verify" | "reset"): Promise<string | null> {
  consumeRateLimit(`otp-send:${phone}`, 5, 10 * 60_000);
  const code = generateOtp();
  await db.insert(verificationCodes).values({ phone, code, purpose, expiresAt: new Date(Date.now() + 10 * 60_000) });
  const delivery = await deliverOtp(phone, code);
  return delivery.devCode;
}

async function consumeCode(phone: string, purpose: "verify" | "reset", code: string): Promise<boolean> {
  assertNotLimited(`otp-verify:${phone}`, 6, 10 * 60_000);
  const [row] = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phone, phone),
        eq(verificationCodes.purpose, purpose),
        eq(verificationCodes.code, code),
        isNull(verificationCodes.usedAt),
        gt(verificationCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationCodes.id))
    .limit(1);
  if (!row) {
    recordFailure(`otp-verify:${phone}`, 10 * 60_000);
    return false;
  }
  await db.update(verificationCodes).set({ usedAt: new Date() }).where(eq(verificationCodes.id, row.id));
  return true;
}

function parseKind(kind: string | undefined): v.ContentKind {
  if (kind && (v.contentKinds as readonly string[]).includes(kind)) return kind as v.ContentKind;
  throw new ApiError(404, "بخش موردنظر یافت نشد", "not_found");
}

const favoriteSchema = z.object({
  targetType: z.enum(["service", "professional"]),
  targetId: z.string().min(1).max(64),
});

const adminDisputeSchema = z.object({
  disputeStatus: z.enum(["none", "open", "resolved"]),
  note: z.string().trim().max(800).default(""),
});

const routes: Route[] = [
  // ---------- Auth ----------
  r(
    "POST",
    "auth/register",
    async ({ body }) => {
      const input = parse(v.registerSchema, body);
      consumeRateLimit(`register:${input.phone}`, 5, 60 * 60_000);
      const conditions = [eq(users.phone, input.phone)];
      if (input.email) conditions.push(eq(users.email, input.email));
      const [taken] = await db.select({ id: users.id }).from(users).where(or(...conditions)).limit(1);
      if (taken) throw new ApiError(409, "کاربری با این شماره یا ایمیل وجود دارد", "duplicate", { phone: "شماره یا ایمیل تکراری است" });
      const [created] = await db
        .insert(users)
        .values({ fullName: input.fullName, phone: input.phone, email: input.email, passwordHash: await hashPassword(input.password), role: "customer" })
        .returning();
      await createSession(created!.id);
      const devCode = await issueCode(input.phone, "verify");
      return { user: sanitizeUser({ ...created!, role: "customer" } as SessionUser), devCode };
    },
    201,
  ),

  r("POST", "auth/login", async ({ body }) => {
    const input = parse(v.loginSchema, body);
    const identifier = normalizeFa(input.identifier);
    assertNotLimited(`login:${identifier}`, 8, 15 * 60_000);
    const phoneCandidate = identifier.replace(/[\s-]/g, "");
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.phone, phoneCandidate), eq(users.email, identifier)))
      .limit(1);
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      recordFailure(`login:${identifier}`, 15 * 60_000);
      throw new ApiError(401, "شماره/ایمیل یا رمز عبور اشتباه است", "invalid_credentials");
    }
    clearFailures(`login:${identifier}`);
    if (user.status !== "active") throw new ApiError(403, "حساب کاربری شما مسدود شده است", "suspended");
    await createSession(user.id);
    return { user: sanitizeUser({ ...user, email: user.email, avatarUrl: user.avatarUrl } as SessionUser) };
  }),

  r("POST", "auth/logout", async () => {
    await destroySession();
    return { ok: true };
  }),

  r("GET", "auth/me", async () => {
    const user = await getCurrentUser();
    return { user: user ? sanitizeUser(user) : null };
  }),

  r("POST", "auth/verify-phone/send", async ({ user }) => {
    const me = await user();
    return { devCode: await issueCode(me.phone, "verify") };
  }),

  r("POST", "auth/verify-phone", async ({ body, user }) => {
    const me = await user();
    const input = parse(v.verifyCodeSchema, body);
    if (!(await consumeCode(me.phone, "verify", input.code))) {
      throw new ApiError(422, "کد وارد‌شده نامعتبر یا منقضی است", "validation", { code: "کد نامعتبر است" });
    }
    await db.update(users).set({ phoneVerified: true, updatedAt: new Date() }).where(eq(users.id, me.id));
    return { ok: true };
  }),

  r("POST", "auth/otp", async ({ body }) => {
    const input = parse(v.otpRequestSchema, body);
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone)).limit(1);
    // Same response for unknown numbers to avoid account enumeration.
    const devCode = exists ? await issueCode(input.phone, "reset") : null;
    return { sent: true, devCode };
  }),

  r("POST", "auth/reset-password", async ({ body }) => {
    const input = parse(v.resetPasswordSchema, body);
    if (!(await consumeCode(input.phone, "reset", input.code))) {
      throw new ApiError(422, "کد وارد‌شده نامعتبر یا منقضی است", "validation", { code: "کد نامعتبر است" });
    }
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone)).limit(1);
    if (!target) throw new ApiError(404, "کاربری با این شماره یافت نشد", "not_found");
    await db.update(users).set({ passwordHash: await hashPassword(input.password), updatedAt: new Date() }).where(eq(users.id, target.id));
    await revokeAllSessions(target.id);
    return { ok: true };
  }),

  // ---------- Catalog & search ----------
  r("GET", "catalog/categories", async () => catalog.getCategoryTree()),

  r("GET", "search", async ({ query }) => {
    const min = query.get("min");
    const max = query.get("max");
    return catalog.searchServices(query.get("q") ?? "", {
      sort: (query.get("sort") ?? undefined) as catalog.ServiceFilters["sort"],
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
    });
  }),

  r("GET", "search/suggest", async ({ query }) => catalog.suggestSearch(query.get("q") ?? "")),

  r("GET", "favorites/keys", async () => {
    const me = await getCurrentUser();
    return { signedIn: Boolean(me), keys: me ? await account.favoriteKeys(me.id) : [] };
  }),

  r("POST", "newsletter", async ({ body }) => {
    const input = parse(z.object({ email: z.email("ایمیل معتبر نیست").max(120, "ایمیل بیش از حد طولانی است") }), body);
    await db.insert(newsletterSubscribers).values({ email: input.email.trim().toLowerCase() }).onConflictDoNothing();
    return { ok: true };
  }, 201),

  r("GET", "pro/offers", async () => orders.listProOffers(await requireUser(PRO))),

  r("GET", "admin/orders/:id", async ({ params }) => {
    await requireUser(ADMIN);
    return admin.getAdminOrderDetail(num(params.id));
  }),

  r("GET", "meta/order-statuses", async () => ORDER_STATUSES),

  r("POST", "coupons/validate", async ({ body, user }) => {
    await requireUser(CUSTOMER);
    const input = parse(v.couponSchema, body);
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, input.code.toUpperCase())).limit(1);
    if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())) {
      throw new ApiError(422, "کد تخفیف معتبر نیست یا منقضی شده است", "validation", { couponCode: "کد نامعتبر" });
    }
    if (input.amount < coupon.minTotal) {
      throw new ApiError(422, `حداقل مبلغ سفارش برای این کد ${toEnglishDigits(String(coupon.minTotal))} تومان است`, "validation");
    }
    const discount = Math.min(coupon.maxAmount, Math.floor((input.amount * coupon.percent) / 100));
    return { code: coupon.code, percent: coupon.percent, discount };
  }),

  // ---------- Customer orders ----------
  r("GET", "orders", async ({ query, user }) => {
    const me = await requireUser(CUSTOMER);
    return orders.listCustomerOrders(me.id, { status: query.get("status") ?? undefined, q: query.get("q") ?? undefined });
  }),

  r(
    "POST",
    "orders",
    async ({ body }) => {
      const me = await requireUser(CUSTOMER);
      const order = await orders.createOrder(me, parse(v.bookingSchema, body));
      return { id: order.id, code: order.code };
    },
    201,
  ),

  r("GET", "orders/:id", async ({ params }) => {
    const me = await requireUser(CUSTOMER);
    return orders.getCustomerOrderDetail(me.id, num(params.id));
  }),

  r("POST", "orders/:id/select-offer", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.selectOfferSchema, body);
    const order = await orders.selectOffer(me, num(params.id), input.offerId);
    return { status: order.status };
  }),

  r("POST", "orders/:id/payment/init", async ({ params }) => {
    const me = await requireUser(CUSTOMER);
    return orders.initPayment(me, num(params.id));
  }),

  r("POST", "orders/:id/payment/verify", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.paymentSchema, body);
    return orders.verifyPayment(me, num(params.id), input.outcome);
  }),

  r("POST", "orders/:id/cancel", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.cancelSchema, body);
    const order = await orders.cancelOrder(me, num(params.id), input.reason);
    return { status: order.status };
  }),

  r("POST", "orders/:id/reschedule", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.rescheduleSchema, body);
    const order = await orders.rescheduleOrder(me, num(params.id), input.scheduledDate, input.timeSlot);
    return { scheduledAt: order.scheduledAt, timeSlot: order.timeSlot };
  }),

  r(
    "POST",
    "orders/:id/review",
    async ({ params, body }) => {
      const me = await requireUser(CUSTOMER);
      const input = parse(v.reviewSchema, body);
      return orders.createReview(me, num(params.id), input.rating, input.comment);
    },
    201,
  ),

  r("PUT", "reviews/:id", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.reviewSchema, body);
    return orders.updateReview(me, num(params.id), input.rating, input.comment);
  }),

  r("POST", "orders/:id/dispute", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.disputeSchema, body);
    return orders.openDispute(me, num(params.id), input.note);
  }),

  // ---------- Account (any authenticated user) ----------
  r("POST", "me/password", async ({ body }) => {
    const me = await requireUser();
    const input = parse(v.passwordChangeSchema, body);
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
    if (!row || !(await verifyPassword(input.currentPassword, row.hash))) {
      throw new ApiError(422, "رمز عبور فعلی اشتباه است", "validation", { currentPassword: "رمز عبور فعلی اشتباه است" });
    }
    await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date() }).where(eq(users.id, me.id));
    await revokeOtherSessions(me.id);
    return { ok: true };
  }),

  r("PATCH", "me", async ({ body }) => {
    const me = await requireUser();
    const input = parse(v.profileUpdateSchema, body);
    return account.updateProfile(me.id, { fullName: input.fullName, email: input.email ?? null, avatarUrl: input.avatarUrl ?? null });
  }),

  r("GET", "addresses", async () => account.listAddresses((await requireUser(CUSTOMER)).id)),

  r(
    "POST",
    "addresses",
    async ({ body }) => {
      const me = await requireUser(CUSTOMER);
      const input = parse(v.addressSchema, body);
      return account.upsertAddress(me.id, { ...input, details: input.details ?? "", isDefault: input.isDefault ?? false });
    },
    201,
  ),

  r("PUT", "addresses/:id", async ({ params, body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(v.addressSchema, body);
    return account.upsertAddress(me.id, { ...input, details: input.details ?? "", isDefault: input.isDefault ?? false }, num(params.id));
  }),

  r("DELETE", "addresses/:id", async ({ params }) => {
    await account.deleteAddress((await requireUser(CUSTOMER)).id, num(params.id));
    return { ok: true };
  }),

  r("POST", "addresses/:id/default", async ({ params }) => {
    await account.setDefaultAddress((await requireUser(CUSTOMER)).id, num(params.id));
    return { ok: true };
  }),

  r("GET", "favorites", async () => account.listFavorites((await requireUser(CUSTOMER)).id)),

  r("POST", "favorites/toggle", async ({ body }) => {
    const me = await requireUser(CUSTOMER);
    const input = parse(favoriteSchema, body);
    return account.toggleFavorite(me.id, input.targetType, input.targetId);
  }),

  r("GET", "notifications", async () => account.listNotifications((await requireUser()).id)),

  r("POST", "notifications/read", async ({ body }) => {
    const me = await requireUser();
    const id = bodyObject(body).id;
    await account.markNotificationsRead(me.id, typeof id === "number" ? id : undefined);
    return { ok: true };
  }),

  r("GET", "wallet", async () => account.getWallet((await requireUser()).id)),

  r(
    "POST",
    "wallet/deposit",
    async ({ body }) => {
      const me = await requireUser(CUSTOMER);
      const input = parse(v.depositSchema, body);
      await account.depositWallet(me.id, input.amount);
      return { ok: true };
    },
    201,
  ),

  r("GET", "conversations", async () => account.listConversations(await requireUser())),

  r("GET", "conversations/:orderId", async ({ params }) => account.getConversation(await requireUser(), num(params.orderId))),

  r(
    "POST",
    "conversations/:orderId/messages",
    async ({ params, body }) => {
      const me = await requireUser();
      const input = parse(v.messageSchema, body);
      return account.sendMessage(me, num(params.orderId), input.body, input.attachment ?? null);
    },
    201,
  ),

  // ---------- Professional ----------
  r(
    "POST",
    "pro/register",
    async ({ body }) => {
      const created = await pro.registerProfessional(parse(v.proRegisterSchema, body));
      await createSession(created.id);
      return { user: { id: created.id, fullName: created.fullName, role: "professional" as const } };
    },
    201,
  ),

  r("GET", "pro/dashboard", async () => pro.getProDashboard(await requireUser(PRO))),

  r("GET", "pro/requests", async () => {
    const me = await requireUser(PRO);
    const [profile] = await db
      .select({ status: professionalProfiles.verificationStatus })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.userId, me.id))
      .limit(1);
    if (profile?.status !== "verified") return [];
    return orders.listProRequests(me);
  }),

  r(
    "POST",
    "pro/requests/:id/offer",
    async ({ params, body }) => {
      const me = await requireUser(PRO);
      const input = parse(v.offerSchema, { ...bodyObject(body), orderId: num(params.id) });
      return orders.submitOffer(me, input);
    },
    201,
  ),

  r("POST", "pro/requests/:id/decline", async ({ params }) => orders.declineRequest(await requireUser(PRO), num(params.id))),

  r("GET", "pro/jobs", async () => orders.listProJobs(await requireUser(PRO))),

  r("POST", "pro/jobs/:id/status", async ({ params, body }) => {
    const me = await requireUser(PRO);
    const input = parse(v.statusUpdateSchema, body);
    const order = await orders.changeOrderStatus(me, num(params.id), input.status, input.note);
    return { status: order.status };
  }),

  r("GET", "pro/profile", async () => pro.getProProfile((await requireUser(PRO)).id)),

  r("PATCH", "pro/profile", async ({ body }) => {
    const me = await requireUser(PRO);
    const input = parse(v.proProfileSchema, body);
    const raw = bodyObject(body).categoryIds;
    const categoryIds = Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isInteger(n)) : undefined;
    return pro.updateProProfile(me.id, { ...input, categoryIds });
  }),

  r("GET", "pro/earnings", async () => pro.getProEarnings(await requireUser(PRO))),

  r(
    "POST",
    "pro/withdrawals",
    async ({ body }) => {
      const me = await requireUser(PRO);
      const input = parse(v.withdrawalSchema, body);
      return pro.requestWithdrawal(me, input.amount, input.iban);
    },
    201,
  ),

  r("GET", "pro/reviews", async () => pro.listProReviews((await requireUser(PRO)).id)),

  r("POST", "pro/reviews/:id/reply", async ({ params, body }) => {
    const me = await requireUser(PRO);
    const input = parse(v.replySchema, body);
    return pro.replyToReview(me.id, num(params.id), input.reply);
  }),

  // ---------- Admin (enforced on every endpoint) ----------
  r("GET", "admin/overview", async () => {
    await requireUser(ADMIN);
    return admin.getAdminOverview();
  }),

  r("GET", "admin/reports", async () => {
    await requireUser(ADMIN);
    return admin.getReports();
  }),

  r("GET", "admin/users", async ({ query }) => {
    await requireUser(ADMIN);
    return admin.listUsers({ q: query.get("q") ?? undefined, role: query.get("role") ?? undefined, status: query.get("status") ?? undefined });
  }),

  r("GET", "admin/users/:id", async ({ params }) => {
    await requireUser(ADMIN);
    return admin.getUserDetail(params.id ?? "");
  }),

  r("PATCH", "admin/users/:id", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const input = parse(v.adminUserUpdateSchema, body);
    const updated = await admin.updateUserByAdmin(me, params.id ?? "", input);
    return { id: updated.id, role: updated.role, status: updated.status };
  }),

  r("GET", "admin/professionals", async ({ query }) => {
    await requireUser(ADMIN);
    return admin.listProfessionals(query.get("status") ?? undefined);
  }),

  r("POST", "admin/professionals/:id/decision", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const input = parse(v.professionalDecisionSchema, body);
    return admin.decideProfessional(me, params.id ?? "", input.decision, input.notes);
  }),

  r("GET", "admin/categories", async () => {
    await requireUser(ADMIN);
    return admin.listAdminCategories();
  }),

  r(
    "POST",
    "admin/categories",
    async ({ body }) => {
      const me = await requireUser(ADMIN);
      return admin.upsertCategory(me, parse(v.categoryInputSchema, body));
    },
    201,
  ),

  r("PUT", "admin/categories/:id", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    return admin.upsertCategory(me, { ...parse(v.categoryInputSchema, body), id: num(params.id) });
  }),

  r("DELETE", "admin/categories/:id", async ({ params }) => admin.deleteCategory(await requireUser(ADMIN), num(params.id))),

  r("GET", "admin/services", async ({ query }) => {
    await requireUser(ADMIN);
    return admin.listAdminServices(query.get("q") ?? undefined);
  }),

  r(
    "POST",
    "admin/services",
    async ({ body }) => {
      const me = await requireUser(ADMIN);
      return admin.upsertService(me, parse(v.serviceInputSchema, body));
    },
    201,
  ),

  r("PUT", "admin/services/:id", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    return admin.upsertService(me, { ...parse(v.serviceInputSchema, body), id: num(params.id) });
  }),

  r("DELETE", "admin/services/:id", async ({ params }) => admin.deleteService(await requireUser(ADMIN), num(params.id))),

  r("GET", "admin/orders", async ({ query }) => {
    await requireUser(ADMIN);
    return admin.listAdminOrders({ status: query.get("status") ?? undefined, q: query.get("q") ?? undefined });
  }),

  r("GET", "admin/pro-options", async ({ query }) => {
    await requireUser(ADMIN);
    const cat = query.get("categoryId");
    return admin.listProOptions(cat ? Number(cat) : undefined);
  }),

  r("POST", "admin/orders/:id/status", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const input = parse(v.statusUpdateSchema, body);
    const order = await orders.changeOrderStatus(me, num(params.id), input.status, input.note);
    return { status: order.status };
  }),

  r("POST", "admin/orders/:id/assign", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const proId = bodyObject(body).professionalId;
    if (typeof proId !== "string" || !proId) throw new ApiError(422, "متخصص را انتخاب کنید", "validation", { professionalId: "انتخاب متخصص الزامی است" });
    await orders.adminAssignProfessional(me, num(params.id), proId);
    return { ok: true };
  }),

  r("POST", "admin/orders/:id/cancel", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const input = parse(v.cancelSchema, body);
    const order = await orders.adminCancelOrder(me, num(params.id), input.reason);
    return { status: order.status };
  }),

  r("POST", "admin/orders/:id/dispute", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const input = parse(adminDisputeSchema, body);
    return orders.adminUpdateDispute(me, num(params.id), input.disputeStatus, input.note);
  }),

  r("GET", "admin/offers", async ({ query }) => {
    await requireUser(ADMIN);
    return admin.listAdminOffers(query.get("status") ?? undefined);
  }),

  r("GET", "admin/finance", async () => {
    await requireUser(ADMIN);
    return admin.getFinance();
  }),

  r("POST", "admin/withdrawals/:id", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const decision = bodyObject(body).decision;
    if (decision !== "approve" && decision !== "reject") throw new ApiError(422, "تصمیم نامعتبر است", "validation");
    return admin.decideWithdrawal(me, num(params.id), decision);
  }),

  r("GET", "admin/content/:kind", async ({ params }) => {
    await requireUser(ADMIN);
    return admin.listContent(parseKind(params.kind));
  }),

  r(
    "POST",
    "admin/content/:kind",
    async ({ params, body }) => {
      const me = await requireUser(ADMIN);
      return admin.upsertContent(me, parseKind(params.kind), body);
    },
    201,
  ),

  r("DELETE", "admin/content/:kind/:id", async ({ params }) => {
    const me = await requireUser(ADMIN);
    return admin.deleteContent(me, parseKind(params.kind), num(params.id));
  }),

  r("GET", "admin/reviews", async () => {
    await requireUser(ADMIN);
    return admin.listAllReviews();
  }),

  r("POST", "admin/reviews/:id/moderate", async ({ params, body }) => {
    const me = await requireUser(ADMIN);
    const status = bodyObject(body).status;
    if (status !== "published" && status !== "hidden") throw new ApiError(422, "وضعیت نامعتبر است", "validation");
    return admin.moderateReview(me, num(params.id), status);
  }),

  r("GET", "admin/audit", async () => {
    await requireUser(ADMIN);
    return admin.listAudit();
  }),
];

function matchRoute(parts: string[], path: string[]): Record<string, string> | null {
  if (parts.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(path[i]!);
    else if (part !== path[i]) return null;
  }
  return params;
}

async function readBody(req: Request): Promise<unknown> {
  if (req.method === "GET" || req.method === "DELETE") return undefined;
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "بدنه درخواست معتبر JSON نیست", "bad_request");
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { message: error.message, code: error.code, fieldErrors: error.fieldErrors } }, { status: error.status });
  }
  console.error("[api] unhandled error", error);
  return Response.json({ error: { message: "خطای داخلی سرور رخ داد. لطفاً دوباره تلاش کنید.", code: "internal" } }, { status: 500 });
}

/** Dispatches a request to the matching route. Used by the catch-all Next.js route handler. */
export async function handleApi(req: Request, path: string[]): Promise<Response> {
  try {
    await ensureSeeded();
    const method = req.method.toUpperCase() as Method;
    const url = new URL(req.url);

    const pathMatches = routes.filter((rt) => matchRoute(rt.parts, path) !== null);
    if (!pathMatches.length) throw new ApiError(404, "مسیر API یافت نشد", "not_found");

    const route = pathMatches.find((rt) => rt.method === method);
    if (!route) throw new ApiError(405, "روش درخواست برای این مسیر مجاز نیست", "method_not_allowed");

    const params = matchRoute(route.parts, path) ?? {};
    const body = await readBody(req);
    const result = await route.handler({ params, body, query: url.searchParams, user: () => requireUser() });
    return Response.json({ data: result ?? null }, { status: route.status ?? 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
