import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  banners,
  blogPosts,
  categories,
  coupons,
  faqs,
  offers,
  orders,
  payments,
  professionalProfiles,
  reviews,
  services,
  staticPages,
  transactions,
  users,
} from "@/db/schema";
import { ApiError, revokeAllSessions, type SessionUser } from "./auth";
import { notify, recordAudit } from "./account";
import { CATEGORY_TONES, ORDER_STATUSES, formatPrice, type OrderStatus, type Role, type UserStatus } from "./domain";
import type { ContentKind } from "./validation";
import { contentInputSchemas, categoryInputSchema, serviceInputSchema } from "./validation";
import type { z } from "zod";

type CategoryInput = z.infer<typeof categoryInputSchema>;
type ServiceInput = z.infer<typeof serviceInputSchema>;

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// ---------- Overview & reports ----------

export async function getAdminOverview() {
  const userRows = await db.select({ role: users.role, status: users.status, createdAt: users.createdAt }).from(users);
  const orderRows = await db
    .select({ status: orders.status, paymentStatus: orders.paymentStatus, total: orders.total, createdAt: orders.createdAt })
    .from(orders);
  const txRows = await db.select({ type: transactions.type, amount: transactions.amount, status: transactions.status, createdAt: transactions.createdAt }).from(transactions);
  const pendingPros = await db.select({ id: professionalProfiles.userId }).from(professionalProfiles).where(eq(professionalProfiles.verificationStatus, "pending"));
  const pendingWithdrawals = txRows.filter((t) => t.type === "withdrawal" && t.status === "pending");

  const customers = userRows.filter((u) => u.role === "customer").length;
  const professionals = userRows.filter((u) => u.role === "professional").length;
  const completed = orderRows.filter((o) => o.status === "completed").length;
  const cancelled = orderRows.filter((o) => o.status === "cancelled").length;
  const pendingPayments = orderRows.filter((o) => o.paymentStatus === "pending" || o.paymentStatus === "failed").length;
  const gmv = txRows.filter((t) => t.type === "customer_payment").reduce((s, t) => s + t.amount, 0);
  const refunds = txRows.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0);
  const commission = txRows.filter((t) => t.type === "commission").reduce((s, t) => s + t.amount, 0);

  // Last 14 days (Tehran calendar) for the trend chart.
  const series: { day: string; orders: number; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * DAY_MS));
    const dayOrders = orderRows.filter((o) => dayKey(o.createdAt) === key);
    const dayRevenue = txRows.filter((t) => t.type === "customer_payment" && dayKey(t.createdAt) === key).reduce((s, t) => s + t.amount, 0);
    series.push({ day: key, orders: dayOrders.length, revenue: dayRevenue });
  }

  const activity = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10);
  const recentOrders = await db
    .select({ id: orders.id, code: orders.code, status: orders.status, total: orders.total, createdAt: orders.createdAt, serviceTitle: services.title })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .orderBy(desc(orders.createdAt))
    .limit(6);

  return {
    kpis: {
      customers,
      professionals,
      totalOrders: orderRows.length,
      completedOrders: completed,
      cancelledOrders: cancelled,
      gmv,
      commission,
      refunds,
      pendingPayments,
      pendingApprovals: pendingPros.length,
      pendingWithdrawals: pendingWithdrawals.length,
    },
    series,
    activity,
    recentOrders,
  };
}

export async function getReports() {
  const orderRows = await db
    .select({ status: orders.status, total: orders.total, createdAt: orders.createdAt, serviceId: orders.serviceId, serviceTitle: services.title })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id));
  const userRows = await db.select({ role: users.role, createdAt: users.createdAt }).from(users);
  const txRows = await db.select({ type: transactions.type, amount: transactions.amount, createdAt: transactions.createdAt }).from(transactions);

  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.now() - i * 30 * DAY_MS);
    const key = dayKey(d).slice(0, 7);
    months.push({ key, label: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "short", timeZone: "Asia/Tehran" }).format(d) });
  }


  const monthCount = (dates: Date[]) => months.map((m) => dates.filter((d) => dayKey(d).startsWith(m.key)).length);
  const customerGrowth = monthCount(userRows.filter((u) => u.role === "customer").map((u) => u.createdAt));
  const proGrowth = monthCount(userRows.filter((u) => u.role === "professional").map((u) => u.createdAt));
  const orderTrend = monthCount(orderRows.map((o) => o.createdAt));
  const revenueTrend = months.map((m) =>
    txRows.filter((t) => t.type === "customer_payment" && dayKey(t.createdAt).startsWith(m.key)).reduce((s, t) => s + t.amount, 0),
  );

  const statusCounts = ORDER_STATUSES.map((s) => ({ status: s, count: orderRows.filter((o) => o.status === s).length }));
  const total = orderRows.length;
  const cancelled = orderRows.filter((o) => o.status === "cancelled").length;
  const confirmedPlus = orderRows.filter((o) => ["confirmed", "on_the_way", "in_progress", "completed"].includes(o.status)).length;

  const serviceMap = new Map<string, { title: string; count: number; revenue: number }>();
  for (const o of orderRows) {
    const cur = serviceMap.get(String(o.serviceId)) ?? { title: o.serviceTitle, count: 0, revenue: 0 };
    cur.count += 1;
    if (["confirmed", "on_the_way", "in_progress", "completed"].includes(o.status)) cur.revenue += o.total;
    serviceMap.set(String(o.serviceId), cur);
  }
  const topServices = [...serviceMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  return {
    months: months.map((m) => m.label),
    customerGrowth,
    proGrowth,
    orderTrend,
    revenueTrend,
    statusCounts,
    rates: {
      cancellation: total ? cancelled / total : 0,
      conversion: total ? confirmedPlus / total : 0,
    },
    totals: {
      orders: total,
      revenue: txRows.filter((t) => t.type === "customer_payment").reduce((s, t) => s + t.amount, 0),
      refunds: txRows.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0),
    },
    topServices,
    definitions: {
      cancellation: "سفارش‌های لغوشده ÷ کل سفارش‌ها",
      conversion: "سفارش‌هایی که به تأیید یا اجرا رسیده‌اند ÷ کل درخواست‌ها",
    },
  };
}

// ---------- Users ----------

export async function listUsers(filter: { q?: string; role?: string; status?: string }) {
  const conditions = [];
  if (filter.role && filter.role !== "all") conditions.push(eq(users.role, filter.role as Role));
  if (filter.status && filter.status !== "all") conditions.push(eq(users.status, filter.status as UserStatus));
  if (filter.q) {
    const like = `%${filter.q}%`;
    conditions.push(or(ilike(users.fullName, like), ilike(users.phone, like), ilike(users.email, like))!);
  }
  const rows = await db
    .select()
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);
  return rows.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role,
    status: u.status,
    phoneVerified: u.phoneVerified,
    createdAt: u.createdAt,
  }));
}

export async function getUserDetail(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, "کاربر یافت نشد", "not_found");
  const [orderStats] = await db
    .select({ total: sql<number>`count(*)::int`, spent: sql<number>`coalesce(sum(${orders.total}),0)::int` })
    .from(orders)
    .where(eq(orders.customerId, userId));
  const recentOrders = await db
    .select({ id: orders.id, code: orders.code, status: orders.status, total: orders.total, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.customerId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(8);
  return { user, orderStats: orderStats ?? { total: 0, spent: 0 }, recentOrders };
}

export async function updateUserByAdmin(
  actor: SessionUser,
  userId: string,
  input: { fullName?: string; email?: string | null; role?: Role; status?: UserStatus },
) {
  if (userId === actor.id && (input.role && input.role !== "admin" || input.status === "suspended")) {
    throw new ApiError(409, "امکان تغییر نقش یا تعلیق حساب خودتان وجود ندارد", "forbidden");
  }
  const [updated] = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw new ApiError(404, "کاربر یافت نشد", "not_found");
  if (input.role === "professional") {
    const [p] = await db.select({ id: professionalProfiles.userId }).from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
    if (!p) {
      await db.insert(professionalProfiles).values({ userId, headline: "متخصص", bio: "", categoryIds: [], verificationStatus: "pending" });
    }
  }
  if (input.status === "suspended") await revokeAllSessions(userId);
  if (input.status) {
    await notify(userId, "booking", input.status === "suspended" ? "حساب شما تعلیق شد" : "حساب شما فعال شد", "برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.");
  }
  await recordAudit(actor.id, "user.update", "user", userId, JSON.stringify(input));
  return updated;
}

// ---------- Professionals ----------

export async function listProfessionals(status?: string) {
  const rows = await db
    .select({ user: users, profile: professionalProfiles })
    .from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(status && status !== "all" ? eq(professionalProfiles.verificationStatus, status as "pending" | "verified" | "rejected") : undefined)
    .orderBy(desc(professionalProfiles.updatedAt));
  const cats = await db.select().from(categories);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  return rows.map(({ user, profile }) => ({
    userId: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    status: user.status,
    headline: profile.headline,
    bio: profile.bio,
    experienceYears: profile.experienceYears,
    skills: profile.skills,
    serviceAreas: profile.serviceAreas,
    categories: profile.categoryIds.map((id) => catName.get(id) ?? "—"),
    documents: profile.documents,
    verificationStatus: profile.verificationStatus,
    verificationNotes: profile.verificationNotes,
    rating: profile.rating,
    reviewsCount: profile.reviewsCount,
    completedJobs: profile.completedJobs,
    pricing: profile.pricing,
    createdAt: user.createdAt,
  }));
}

export async function decideProfessional(actor: SessionUser, userId: string, decision: "approve" | "reject", notes: string) {
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
  if (!profile) throw new ApiError(404, "درخواست متخصص یافت نشد", "not_found");
  const status = decision === "approve" ? "verified" : "rejected";
  await db
    .update(professionalProfiles)
    .set({
      verificationStatus: status,
      verificationNotes: notes || (decision === "approve" ? "تأیید شد" : "رد شد"),
      documents: profile.documents.map((d) => ({ ...d, status: decision === "approve" ? ("approved" as const) : ("rejected" as const) })),
      updatedAt: new Date(),
    })
    .where(eq(professionalProfiles.userId, userId));
  await notify(
    userId,
    "booking",
    decision === "approve" ? "حساب متخصص شما تأیید شد" : "درخواست همکاری شما رد شد",
    decision === "approve" ? "اکنون می‌توانید به درخواست‌های مشتریان پیشنهاد دهید." : notes || "برای جزئیات بیشتر با پشتیبانی تماس بگیرید.",
    decision === "approve" ? "/pro/requests" : "/pro",
  );
  await recordAudit(actor.id, `professional.${decision}`, "professional", userId, notes);
  return { ok: true, status };
}

// ---------- Catalog ----------

export async function listAdminCategories() {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  const counts = await db
    .select({ categoryId: services.categoryId, c: sql<number>`count(*)::int` })
    .from(services)
    .groupBy(services.categoryId);
  const countMap = new Map(counts.map((c) => [c.categoryId, c.c]));
  return cats.map((c) => ({ ...c, serviceCount: countMap.get(c.id) ?? 0 }));
}

export async function upsertCategory(actor: SessionUser, input: CategoryInput) {
  const values = {
    parentId: input.parentId ?? null,
    slug: input.slug,
    name: input.name,
    description: input.description,
    iconKey: input.iconKey,
    tone: input.tone,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
  if (input.id) {
    const [row] = await db.update(categories).set(values).where(eq(categories.id, input.id)).returning();
    if (!row) throw new ApiError(404, "دسته‌بندی یافت نشد", "not_found");
    await recordAudit(actor.id, "category.update", "category", String(row.id), row.name);
    return row;
  }
  const [row] = await db.insert(categories).values(values).returning();
  await recordAudit(actor.id, "category.create", "category", String(row!.id), row!.name);
  return row!;
}

export async function deleteCategory(actor: SessionUser, id: number) {
  const [child] = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1);
  if (child) throw new ApiError(409, "ابتدا زیرمجموعه‌های این دسته را حذف کنید", "conflict");
  const [svc] = await db.select({ id: services.id }).from(services).where(eq(services.categoryId, id)).limit(1);
  if (svc) throw new ApiError(409, "این دسته خدمت دارد؛ ابتدا خدمات آن را منتقل یا حذف کنید", "conflict");
  await db.delete(categories).where(eq(categories.id, id));
  await recordAudit(actor.id, "category.delete", "category", String(id));
  return { ok: true };
}

export async function listAdminServices(q?: string) {
  const rows = await db
    .select({ service: services, category: categories })
    .from(services)
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .orderBy(asc(services.id));
  const filtered = q ? rows.filter((r) => r.service.title.includes(q) || r.service.slug.includes(q)) : rows;
  return filtered.map(({ service, category }) => ({
    ...service,
    categoryName: category.name,
  }));
}

export async function upsertService(actor: SessionUser, input: ServiceInput) {
  const { id, ...rest } = input;
  const values = { ...rest, updatedAt: new Date() };
  if (id) {
    const [row] = await db.update(services).set(values).where(eq(services.id, id)).returning();
    if (!row) throw new ApiError(404, "خدمت یافت نشد", "not_found");
    await recordAudit(actor.id, "service.update", "service", String(row.id), row.title);
    return row;
  }
  const [row] = await db.insert(services).values(values).returning();
  await recordAudit(actor.id, "service.create", "service", String(row!.id), row!.title);
  return row!;
}

export async function deleteService(actor: SessionUser, id: number) {
  const [used] = await db.select({ id: orders.id }).from(orders).where(eq(orders.serviceId, id)).limit(1);
  if (used) {
    await db.update(services).set({ isActive: false, updatedAt: new Date() }).where(eq(services.id, id));
    await recordAudit(actor.id, "service.deactivate", "service", String(id));
    return { ok: true, mode: "deactivated" as const };
  }
  await db.delete(services).where(eq(services.id, id));
  await recordAudit(actor.id, "service.delete", "service", String(id));
  return { ok: true, mode: "deleted" as const };
}

export const CATEGORY_TONE_OPTIONS = CATEGORY_TONES;

// ---------- Orders ----------

export async function listAdminOrders(filter: { status?: string; q?: string }) {
  const rows = await db
    .select({ order: orders, service: services, customer: users })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(filter.status && filter.status !== "all" ? eq(orders.status, filter.status as OrderStatus) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(200);
  const proIds = [...new Set(rows.map((r) => r.order.professionalId).filter((x): x is string => Boolean(x)))];
  const pros = proIds.length ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, proIds)) : [];
  const proName = new Map(pros.map((p) => [p.id, p.fullName]));
  return rows
    .map(({ order, service, customer }) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      disputeStatus: order.disputeStatus,
      serviceTitle: service.title,
      customerName: customer.fullName,
      professionalId: order.professionalId,
      professionalName: order.professionalId ? (proName.get(order.professionalId) ?? "—") : null,
      total: order.total,
      city: order.city,
      createdAt: order.createdAt,
      cancelReason: order.cancelReason,
      disputeNote: order.disputeNote,
    }))
    .filter((o) => (filter.q ? `${o.code} ${o.serviceTitle} ${o.customerName}`.includes(filter.q) : true));
}

export async function listProOptions(categoryId?: number) {
  const rows = await db
    .select({ user: users, profile: professionalProfiles })
    .from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(eq(professionalProfiles.verificationStatus, "verified"));
  return rows
    .filter(({ profile }) => (categoryId ? profile.categoryIds.includes(categoryId) : true))
    .map(({ user, profile }) => ({ id: user.id, fullName: user.fullName, areas: profile.serviceAreas }));
}

// ---------- Finance ----------

export async function getFinance() {
  const txRows = await db
    .select({ tx: transactions, user: users })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .orderBy(desc(transactions.createdAt))
    .limit(300);
  const payRows = await db
    .select({ payment: payments, order: orders })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .orderBy(desc(payments.createdAt))
    .limit(100);

  const sum = (type: string) => txRows.filter((r) => r.tx.type === type && r.tx.status !== "rejected").reduce((s, r) => s + r.tx.amount, 0);
  const pendingWithdrawals = txRows.filter((r) => r.tx.type === "withdrawal" && r.tx.status === "pending");

  return {
    totals: {
      payments: sum("customer_payment"),
      commissions: sum("commission"),
      refunds: sum("refund"),
      payouts: sum("pro_earning"),
      withdrawn: txRows.filter((r) => r.tx.type === "withdrawal" && r.tx.status === "completed").reduce((s, r) => s + r.tx.amount, 0),
      pendingWithdrawals: pendingWithdrawals.reduce((s, r) => s + r.tx.amount, 0),
    },
    transactions: txRows.map(({ tx, user }) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      userName: user.fullName,
      userId: user.id,
      orderId: tx.orderId,
      createdAt: tx.createdAt,
    })),
    payments: payRows.map(({ payment, order }) => ({
      id: payment.id,
      orderCode: order.code,
      orderId: order.id,
      amount: payment.amount,
      status: payment.status,
      provider: payment.provider,
      providerRef: payment.providerRef,
      createdAt: payment.createdAt,
    })),
    pendingWithdrawals: pendingWithdrawals.map((r) => ({ id: r.tx.id, userName: r.user.fullName, amount: r.tx.amount, description: r.tx.description, createdAt: r.tx.createdAt })),
  };
}

export async function decideWithdrawal(actor: SessionUser, txId: number, decision: "approve" | "reject") {
  const [row] = await db
    .select({ tx: transactions })
    .from(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.type, "withdrawal")))
    .limit(1);
  if (!row || row.tx.status !== "pending") throw new ApiError(409, "این درخواست در وضعیت قابل تصمیم نیست", "invalid_state");
  await db
    .update(transactions)
    .set({ status: decision === "approve" ? "completed" : "rejected" })
    .where(eq(transactions.id, txId));
  await notify(
    row.tx.userId,
    "payment",
    decision === "approve" ? "برداشت شما پرداخت شد" : "درخواست برداشت رد شد",
    `${formatPrice(row.tx.amount)} ${decision === "approve" ? "به حساب شما واریز شد." : "به موجودی شما بازگشت."}`,
    "/pro/earnings",
  );
  await recordAudit(actor.id, `withdrawal.${decision}`, "transaction", String(txId), formatPrice(row.tx.amount));
  return { ok: true };
}

// ---------- Content ----------

export async function listContent(kind: ContentKind) {
  switch (kind) {
    case "banners":
      return db.select().from(banners).orderBy(asc(banners.sortOrder));
    case "faqs":
      return db.select().from(faqs).orderBy(asc(faqs.sortOrder));
    case "blog":
      return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
    case "pages":
      return db.select().from(staticPages).orderBy(asc(staticPages.id));
    case "coupons":
      return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }
}

export async function upsertContent(actor: SessionUser, kind: ContentKind, raw: unknown) {
  switch (kind) {
    case "banners": {
      const { id, ...v } = contentInputSchemas.banners.parse(raw);
      if (id) {
        await db.update(banners).set(v).where(eq(banners.id, id));
        await recordAudit(actor.id, "content.update", "banner", String(id), v.title);
        return { ok: true };
      }
      await db.insert(banners).values(v);
      await recordAudit(actor.id, "content.create", "banner", "", v.title);
      return { ok: true };
    }
    case "faqs": {
      const { id, ...v } = contentInputSchemas.faqs.parse(raw);
      if (id) await db.update(faqs).set(v).where(eq(faqs.id, id));
      else await db.insert(faqs).values(v);
      await recordAudit(actor.id, "content.faq", "faq", String(id ?? ""), v.question);
      return { ok: true };
    }
    case "blog": {
      const { id, ...v } = contentInputSchemas.blog.parse(raw);
      if (id) await db.update(blogPosts).set({ ...v, updatedAt: new Date() }).where(eq(blogPosts.id, id));
      else await db.insert(blogPosts).values(v);
      await recordAudit(actor.id, "content.blog", "blog", String(id ?? ""), v.title);
      return { ok: true };
    }
    case "pages": {
      const { id, ...v } = contentInputSchemas.pages.parse(raw);
      if (id) await db.update(staticPages).set({ ...v, updatedAt: new Date() }).where(eq(staticPages.id, id));
      else await db.insert(staticPages).values(v);
      await recordAudit(actor.id, "content.page", "page", String(id ?? ""), v.title);
      return { ok: true };
    }
    case "coupons": {
      const { id, ...v } = contentInputSchemas.coupons.parse(raw);
      if (id) await db.update(coupons).set(v).where(eq(coupons.id, id));
      else await db.insert(coupons).values(v);
      await recordAudit(actor.id, "content.coupon", "coupon", String(id ?? ""), v.code);
      return { ok: true };
    }
  }
}

export async function deleteContent(actor: SessionUser, kind: ContentKind, id: number) {
  switch (kind) {
    case "banners":
      await db.delete(banners).where(eq(banners.id, id));
      break;
    case "faqs":
      await db.delete(faqs).where(eq(faqs.id, id));
      break;
    case "blog":
      await db.delete(blogPosts).where(eq(blogPosts.id, id));
      break;
    case "pages":
      await db.delete(staticPages).where(eq(staticPages.id, id));
      break;
    case "coupons":
      await db.delete(coupons).where(eq(coupons.id, id));
      break;
  }
  await recordAudit(actor.id, `content.delete.${kind}`, kind, String(id));
  return { ok: true };
}

export async function listAllReviews() {
  const rows = await db
    .select({ review: reviews, service: services })
    .from(reviews)
    .innerJoin(services, eq(reviews.serviceId, services.id))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
  return rows.map(({ review, service }) => ({
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    serviceTitle: service.title,
    status: review.status,
    reply: review.reply,
    createdAt: review.createdAt,
  }));
}

export async function moderateReview(actor: SessionUser, id: number, status: "published" | "hidden") {
  await db.update(reviews).set({ status, updatedAt: new Date() }).where(eq(reviews.id, id));
  await recordAudit(actor.id, `review.${status}`, "review", String(id));
  return { ok: true };
}

export async function listAudit() {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
}

/** Full order record for the admin detail panel: customer, professional, offers, payments and history. */
export async function getAdminOrderDetail(orderId: number) {
  const [row] = await db
    .select({ order: orders, service: services, customer: users })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) throw new ApiError(404, "سفارش یافت نشد", "not_found");

  const offerRows = await db
    .select({ offer: offers, pro: users })
    .from(offers)
    .innerJoin(users, eq(offers.professionalId, users.id))
    .where(eq(offers.orderId, orderId))
    .orderBy(asc(offers.price));
  const paymentRows = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
  const proId = row.order.professionalId;
  const [pro] = proId ? await db.select({ fullName: users.fullName, phone: users.phone }).from(users).where(eq(users.id, proId)).limit(1) : [];

  return {
    order: row.order,
    service: { title: row.service.title },
    customer: { fullName: row.customer.fullName, phone: row.customer.phone },
    professional: pro ?? null,
    offers: offerRows.map(({ offer, pro: p }) => ({
      id: offer.id,
      price: offer.price,
      arrivalMinutes: offer.arrivalMinutes,
      status: offer.status,
      isDemo: offer.isDemo,
      professionalName: p.fullName,
    })),
    payments: paymentRows.map((p) => ({ id: p.id, amount: p.amount, status: p.status, provider: p.provider, providerRef: p.providerRef, createdAt: p.createdAt })),
  };
}

/** Every offer across orders, for the admin offers view. */
export async function listAdminOffers(status?: string) {
  const rows = await db
    .select({ offer: offers, order: orders, service: services, pro: users })
    .from(offers)
    .innerJoin(orders, eq(offers.orderId, orders.id))
    .innerJoin(services, eq(orders.serviceId, services.id))
    .innerJoin(users, eq(offers.professionalId, users.id))
    .where(status && status !== "all" ? eq(offers.status, status as "submitted" | "selected" | "declined" | "rejected") : undefined)
    .orderBy(desc(offers.createdAt))
    .limit(300);
  return rows.map(({ offer, order, service, pro }) => ({
    id: offer.id,
    orderId: order.id,
    orderCode: order.code,
    serviceTitle: service.title,
    professionalName: pro.fullName,
    price: offer.price,
    arrivalMinutes: offer.arrivalMinutes,
    status: offer.status,
    isDemo: offer.isDemo,
    createdAt: offer.createdAt,
  }));
}

export type { z };
export { ilike };
export { ORDER_STATUSES };
export { type ContentKind as AdminContentKind };
