import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orders, professionalProfiles, reviews, services, transactions, users } from "@/db/schema";
import { ApiError, hashPassword, type SessionUser } from "./auth";
import { notify, recordAudit, getWallet } from "./account";
import { computeCommission, DEBIT_TYPES, formatPrice, type TransactionType } from "./domain";
import { listProRequests } from "./orders";
import type { z } from "zod";
import type { proProfileSchema, proRegisterSchema } from "./validation";

export type ProRegisterInput = z.infer<typeof proRegisterSchema>;
export type ProProfileInput = z.infer<typeof proProfileSchema>;

const ACTIVE_STATUSES = ["confirmed", "on_the_way", "in_progress"] as const;

/** Creates a professional account with a pending verification profile. Never auto-verifies. */
export async function registerProfessional(input: ProRegisterInput): Promise<{ id: string; fullName: string }> {
  const [byPhone] = await db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone)).limit(1);
  if (byPhone) throw new ApiError(409, "این شماره موبایل قبلاً ثبت شده است", "duplicate", { phone: "شماره تکراری است" });
  if (input.email) {
    const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (byEmail) throw new ApiError(409, "این ایمیل قبلاً ثبت شده است", "duplicate", { email: "ایمیل تکراری است" });
  }

  const leafIds = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(inArray(categories.id, input.categoryIds), sql`${categories.parentId} is not null`));
  if (leafIds.length !== input.categoryIds.length) {
    throw new ApiError(422, "دسته‌بندی انتخابی معتبر نیست", "validation", { categoryIds: "دسته‌بندی نامعتبر است" });
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      passwordHash,
      role: "professional",
      status: "active",
      phoneVerified: true,
    })
    .returning({ id: users.id, fullName: users.fullName });

  await db.insert(professionalProfiles).values({
    userId: user!.id,
    headline: input.headline,
    bio: input.bio,
    experienceYears: input.experienceYears,
    skills: input.skills,
    serviceAreas: input.serviceAreas,
    categoryIds: input.categoryIds,
    workingHours: { days: input.workingDays, from: input.workingFrom, to: input.workingTo },
    pricing: { minPrice: input.minPrice, hourlyRate: input.hourlyRate, visitFee: 0 },
    documents: input.documents.map((d) => ({ type: d.type, name: d.name, status: "uploaded" as const, dataUrl: d.dataUrl })),
    verificationStatus: "pending",
    verificationNotes: "",
    avatarTone: ["emerald", "sky", "amber", "rose", "violet"][Math.floor(Math.random() * 5)]!,
  });

  await notify(user!.id, "booking", "درخواست همکاری ثبت شد", "مدارک شما در صف بررسی قرار گرفت. نتیجه از طریق اعلان‌ها به شما اطلاع داده می‌شود.", "/pro");
  await recordAudit(user!.id, "pro.applied", "professional", user!.id, input.headline);
  return user!;
}

export async function getProProfile(userId: string) {
  const [row] = await db
    .select({ user: users, profile: professionalProfiles })
    .from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new ApiError(404, "پروفایل متخصص یافت نشد", "not_found");
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c]));
  return {
    user: { id: row.user.id, fullName: row.user.fullName, phone: row.user.phone, email: row.user.email, avatarUrl: row.user.avatarUrl },
    profile: {
      ...row.profile,
      categories: row.profile.categoryIds.map((id) => ({ id, name: catById.get(id)?.name ?? "—", parentName: catById.get(catById.get(id)?.parentId ?? -1)?.name ?? "" })),
    },
    availableCategories: cats
      .filter((c) => c.parentId != null)
      .map((c) => ({ id: c.id, name: c.name, parentName: catById.get(c.parentId!)?.name ?? "" })),
  };
}

export async function updateProProfile(userId: string, input: ProProfileInput & { categoryIds?: number[] }) {
  const [existing] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
  if (!existing) throw new ApiError(404, "پروفایل متخصص یافت نشد", "not_found");

  let categoryIds = existing.categoryIds;
  if (input.categoryIds) {
    const valid = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(inArray(categories.id, input.categoryIds), sql`${categories.parentId} is not null`));
    if (valid.length !== input.categoryIds.length || input.categoryIds.length === 0) {
      throw new ApiError(422, "دسته‌بندی‌های انتخابی معتبر نیستند", "validation", { categoryIds: "انتخاب نامعتبر" });
    }
    categoryIds = input.categoryIds;
  }

  await db
    .update(professionalProfiles)
    .set({
      headline: input.headline,
      bio: input.bio,
      experienceYears: input.experienceYears,
      skills: input.skills,
      serviceAreas: input.serviceAreas,
      categoryIds,
      workingHours: { days: input.workingDays, from: input.workingFrom, to: input.workingTo },
      pricing: { minPrice: input.minPrice, hourlyRate: input.hourlyRate, visitFee: input.visitFee },
      isAvailable: input.isAvailable,
      portfolio: input.portfolio,
      updatedAt: new Date(),
    })
    .where(eq(professionalProfiles.userId, userId));
  return { ok: true };
}

export async function getProDashboard(user: SessionUser) {
  const profile = await getProProfile(user.id);
  const requests = profile.profile.verificationStatus === "verified" ? await listProRequests(user) : [];
  const jobs = await db
    .select({ order: orders, service: services })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .where(and(eq(orders.professionalId, user.id), inArray(orders.status, [...ACTIVE_STATUSES, "professional_selected"])))
    .orderBy(orders.scheduledAt)
    .limit(5);
  const wallet = await getWallet(user.id);
  const pending = await pendingEarnings(user.id);
  const recentReviews = await db
    .select({ rating: reviews.rating, comment: reviews.comment, author: reviews.authorName, createdAt: reviews.createdAt })
    .from(reviews)
    .where(eq(reviews.professionalId, user.id))
    .orderBy(desc(reviews.createdAt))
    .limit(3);

  return {
    profile: profile.profile,
    user: profile.user,
    stats: {
      newRequests: requests.filter((r) => !r.hasOffer).length,
      activeJobs: jobs.filter((j) => (ACTIVE_STATUSES as readonly string[]).includes(j.order.status)).length,
      completedJobs: profile.profile.completedJobs,
      available: wallet.balance,
      pending,
      rating: profile.profile.rating,
      reviewsCount: profile.profile.reviewsCount,
    },
    upcoming: jobs.map(({ order, service }) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      serviceTitle: service.title,
      city: order.city,
      scheduledAt: order.scheduledAt,
      timeSlot: order.timeSlot,
    })),
    recentReviews,
  };
}

/** Net earnings of jobs that are booked but not yet completed. */
async function pendingEarnings(proId: string): Promise<number> {
  const rows = await db
    .select({ price: orders.estimatedPrice })
    .from(orders)
    .where(and(eq(orders.professionalId, proId), inArray(orders.status, [...ACTIVE_STATUSES])));
  return rows.reduce((sum, r) => sum + computeCommission(r.price).net, 0);
}

export async function getProEarnings(user: SessionUser) {
  const wallet = await getWallet(user.id);
  const pending = await pendingEarnings(user.id);
  const [completed] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.professionalId, user.id), eq(orders.status, "completed")));
  const earned = wallet.transactions.filter((t) => t.type === "pro_earning").reduce((s, t) => s + t.amount, 0);
  const commission = wallet.transactions.filter((t) => t.type === "commission").reduce((s, t) => s + t.amount, 0);
  const withdrawn = wallet.transactions.filter((t) => t.type === "withdrawal" && t.status !== "rejected").reduce((s, t) => s + t.amount, 0);
  const withdrawals = wallet.transactions.filter((t) => t.type === "withdrawal");

  return {
    available: wallet.balance,
    pending,
    totalEarned: earned,
    totalCommission: commission,
    totalWithdrawn: withdrawn,
    completedJobs: completed?.c ?? 0,
    transactions: wallet.transactions,
    withdrawals,
  };
}

export async function requestWithdrawal(user: SessionUser, amount: number, iban: string) {
  const wallet = await getWallet(user.id);
  if (amount > wallet.balance) throw new ApiError(422, `موجودی قابل برداشت کافی نیست (${formatPrice(wallet.balance)})`, "insufficient", { amount: "موجودی کافی نیست" });
  const masked = `IR••••••••••••••••${iban.slice(-4)}`;
  await db.insert(transactions).values({
    userId: user.id,
    type: "withdrawal" satisfies TransactionType,
    amount,
    status: "pending",
    description: `درخواست برداشت به شبا ${masked}`,
  });
  await notify(user.id, "payment", "درخواست برداشت ثبت شد", `درخواست برداشت ${formatPrice(amount)} در صف بررسی مدیریت است.`, "/pro/earnings");
  return { ok: true };
}

export async function listProReviews(userId: string) {
  const rows = await db
    .select({ review: reviews, service: services })
    .from(reviews)
    .innerJoin(services, eq(reviews.serviceId, services.id))
    .where(and(eq(reviews.professionalId, userId), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt));
  const total = rows.length;
  const avg = total ? rows.reduce((s, r) => s + r.review.rating, 0) / total : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: rows.filter((r) => r.review.rating === star).length }));
  return {
    average: Math.round(avg * 10) / 10,
    total,
    distribution,
    items: rows.map(({ review, service }) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      author: review.authorName,
      serviceTitle: service.title,
      createdAt: review.createdAt,
      reply: review.reply,
      repliedAt: review.repliedAt,
      canReply: Date.now() - review.createdAt.getTime() < 30 * 86_400_000,
    })),
  };
}

export async function replyToReview(userId: string, reviewId: number, reply: string) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.professionalId, userId)))
    .limit(1);
  if (!review) throw new ApiError(404, "نظر یافت نشد", "not_found");
  if (Date.now() - review.createdAt.getTime() > 30 * 86_400_000) {
    throw new ApiError(409, "مهلت پاسخ‌دهی به این نظر (۳۰ روز) گذشته است", "expired");
  }
  await db.update(reviews).set({ reply, repliedAt: new Date(), updatedAt: new Date() }).where(eq(reviews.id, reviewId));
  return { ok: true };
}

export function isDebitType(type: string): boolean {
  return DEBIT_TYPES.includes(type as TransactionType);
}

export { getWallet };
