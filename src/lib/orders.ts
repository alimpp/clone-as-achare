import { randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  categories,
  conversations,
  coupons,
  offers,
  orders,
  payments,
  professionalProfiles,
  reviews,
  services,
  transactions,
  users,
} from "@/db/schema";
import { ApiError, type SessionUser } from "./auth";
import { ensureConversation, notify, recordAudit } from "./account";
import { getProsForCategories, getProsForCategory, type ProSummary } from "./catalog";
import {
  ADMIN_TRANSITIONS,
  CITIES,
  CUSTOMER_CANCELLABLE,
  RESCHEDULABLE,
  canAdminTransition,
  canProfessionalTransition,
  computeBreakdown,
  computeCommission,
  formatPrice,
  normalizeFa,
  type Attachment,
  type OrderStatus,
  type PaymentStatus,
} from "./domain";
import { validateAnswers, type bookingSchema } from "./validation";
import type { z } from "zod";

export type OrderRow = typeof orders.$inferSelect;
export type BookingInput = z.infer<typeof bookingSchema>;

/** Demo offers from seeded professionals appear after this delay, simulating real-time matching. */
export const DEMO_OFFER_DELAY_MS = 6000;

// ---------- Helpers ----------

function todayInTehran(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Converts a Tehran-local date and time slot id (e.g. "08-10") into an absolute Date. */
export function slotToDate(dateStr: string, slotId: string): Date {
  const startHour = Number(slotId.split("-")[0] ?? "9");
  return new Date(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00+03:30`);
}

function validateSchedule(dateStr: string): void {
  const date = new Date(`${dateStr}T00:00:00+03:30`);
  if (Number.isNaN(date.getTime())) throw new ApiError(422, "تاریخ نامعتبر است", "validation", { scheduledDate: "تاریخ نامعتبر است" });
  if (dateStr < todayInTehran()) throw new ApiError(422, "تاریخ گذشته قابل انتخاب نیست", "validation", { scheduledDate: "تاریخ گذشته است" });
  const maxMs = 60 * 86_400_000;
  if (date.getTime() - Date.now() > maxMs) throw new ApiError(422, "تاریخ بیش از ۶۰ روز آینده است", "validation", { scheduledDate: "بیش از ۶۰ روز آینده" });
}

/** Order statuses that require a settled payment before they can be reached. */
const PAID_REQUIRED: OrderStatus[] = ["confirmed", "on_the_way", "in_progress", "completed"];

/**
 * Prevents double-booking: a professional cannot hold two active orders at the same date and slot.
 * Cancelled orders are ignored, so the slot becomes free again.
 */
async function assertProAvailable(professionalId: string, order: { id: number; scheduledAt: Date; timeSlot: string }): Promise<void> {
  const [clash] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.professionalId, professionalId),
        eq(orders.scheduledAt, order.scheduledAt),
        eq(orders.timeSlot, order.timeSlot),
        inArray(orders.status, ["professional_selected", "confirmed", "on_the_way", "in_progress", "completed"]),
        ne(orders.id, order.id),
      ),
    )
    .limit(1);
  if (clash) throw new ApiError(409, "این متخصص در این بازه زمانی سفارش دیگری دارد. بازه یا متخصص دیگری انتخاب کنید.", "slot_taken");
}

export function generateOrderCode(): string {
  return `AR-${randomInt(100000, 999999)}`;
}

function appendHistory(history: StatusHistoryEntry[], status: OrderStatus, note: string): StatusHistoryEntry[] {
  return [...history, { status, at: new Date().toISOString(), note }];
}

type StatusHistoryEntry = { status: OrderStatus; at: string; note: string };

async function findActiveCoupon(code: string) {
  const normalized = code.trim().toUpperCase();
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!coupon || !coupon.isActive) return null;
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return null;
  return coupon;
}

/** Discount for a coupon applied to a subtotal (percentage capped by max amount). */
function couponDiscount(coupon: { percent: number; maxAmount: number; minTotal: number }, subtotal: number): number {
  if (subtotal < coupon.minTotal) return 0;
  return Math.min(coupon.maxAmount, Math.floor((subtotal * coupon.percent) / 100));
}

// ---------- Demo offer generation (lazy, race-safe) ----------

const DEMO_TEMPLATES = [
  { factor: 0.92, arrival: 45, text: "حضور به‌موقع با تجهیزات کامل و ارائه گارانتی کار." },
  { factor: 1.0, arrival: 90, text: "تجربه بالا در این نوع خدمت و قیمت منصفانه با شفافیت کامل." },
  { factor: 1.12, arrival: 120, text: "امکان شروع سریع‌تر در روز قرار با ابزار حرفه‌ای و بازرسی نهایی." },
];

async function maybeGenerateDemoOffers(order: OrderRow): Promise<void> {
  if (order.status !== "waiting_offers" || order.demoOffersGenerated) return;
  if (Date.now() - order.createdAt.getTime() < DEMO_OFFER_DELAY_MS) return;

  const [service] = await db.select().from(services).where(eq(services.id, order.serviceId)).limit(1);
  if (!service) return;

  // Claim the generation so concurrent polls do not duplicate offers.
  const claimed = await db
    .update(orders)
    .set({ demoOffersGenerated: true })
    .where(and(eq(orders.id, order.id), eq(orders.demoOffersGenerated, false)))
    .returning({ id: orders.id });
  if (!claimed.length) return;

  // Exact-category professionals first, then siblings under the same parent category (up to three offers).
  const [leafCategory] = await db.select().from(categories).where(eq(categories.id, service.categoryId)).limit(1);
  const siblingIds =
    leafCategory?.parentId != null
      ? (await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, leafCategory.parentId))).map((r) => r.id)
      : [service.categoryId];
  const exact = await getProsForCategory(service.categoryId, 3, order.city);
  const broader = await getProsForCategories(siblingIds, 6, order.city);
  const seen = new Set<string>();
  const pros = [...exact, ...broader]
    .filter((p) => {
      if (seen.has(p.userId)) return false;
      seen.add(p.userId);
      return p.isAvailable;
    })
    .slice(0, 3);
  if (!pros.length) {
    await notify(order.customerId, "booking", "متخصصی برای این سفارش پیدا نشد", "در حال حاضر متخصص فعالی در منطقه شما برای این خدمت نداریم. می‌توانید سفارش را لغو کنید.", `/account/orders/${order.id}`);
    return;
  }

  const rows = pros.map((pro: ProSummary, i) => {
    const tpl = DEMO_TEMPLATES[i % DEMO_TEMPLATES.length]!;
    return {
      orderId: order.id,
      professionalId: pro.userId,
      price: Math.max(50_000, Math.round((service.basePrice * tpl.factor) / 1000) * 1000),
      arrivalMinutes: tpl.arrival,
      description: `${tpl.text} (پیشنهاد نمایشی)`,
      isDemo: true,
    };
  });
  const inserted = await db.insert(offers).values(rows).onConflictDoNothing().returning({ id: offers.id });
  if (inserted.length) {
    await db
      .update(orders)
      .set({ status: "offers_received", updatedAt: new Date(), statusHistory: appendHistory(order.statusHistory, "offers_received", "پیشنهاد دریافت شد") })
      .where(and(eq(orders.id, order.id), eq(orders.status, "waiting_offers")));
    await notify(order.customerId, "offer", "پیشنهاد جدید برای سفارش شما", `${faNumberText(inserted.length)} پیشنهاد برای ${service.title} دریافت شد.`, `/account/orders/${order.id}`);
  }
}

function faNumberText(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

// ---------- Customer: booking ----------

export async function createOrder(user: SessionUser, input: BookingInput): Promise<OrderRow> {
  if (!user.phoneVerified) {
    throw new ApiError(403, "برای ثبت سفارش ابتدا شماره موبایل خود را تأیید کنید", "phone_unverified");
  }

  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.slug, input.serviceSlug), eq(services.isActive, true)))
    .limit(1);
  if (!service) throw new ApiError(404, "خدمت موردنظر یافت نشد", "not_found");

  const { values, errors } = validateAnswers(service.questions, input.answers);
  if (Object.keys(errors).length) throw new ApiError(422, "لطفاً خطاهای فرم را برطرف کنید", "validation", errors);

  validateSchedule(input.scheduledDate);

  const address = await resolveAddress(user.id, input);
  const urgency = String(values.urgency ?? "");
  const urgent = input.urgent || urgency.startsWith("فوری");

  let couponCode: string | null = null;
  if (input.couponCode) {
    const coupon = await findActiveCoupon(input.couponCode);
    if (!coupon) throw new ApiError(422, "کد تخفیف معتبر نیست یا منقضی شده است", "validation", { couponCode: "کد تخفیف نامعتبر است" });
    couponCode = coupon.code;
  }

  const estimate = computeBreakdown({ offerPrice: service.basePrice, urgent });
  const [order] = await db
    .insert(orders)
    .values({
      code: generateOrderCode(),
      customerId: user.id,
      serviceId: service.id,
      status: "waiting_offers",
      paymentStatus: "unpaid",
      answers: values,
      attachments: input.attachments as Attachment[],
      city: address.city,
      region: address.region,
      addressLine: address.addressLine,
      addressDetails: address.details,
      scheduledAt: slotToDate(input.scheduledDate, input.timeSlot),
      timeSlot: input.timeSlot,
      flexible: input.flexible,
      urgent,
      notes: input.notes,
      estimatedPrice: service.basePrice,
      urgentFee: estimate.urgentFee,
      serviceFee: estimate.serviceFee,
      discount: 0,
      total: estimate.total,
      couponCode,
      statusHistory: [{ status: "waiting_offers", at: new Date().toISOString(), note: "درخواست ثبت شد" }],
    })
    .returning();
  if (!order) throw new ApiError(500, "ثبت سفارش انجام نشد");

  await notify(user.id, "booking", "درخواست شما ثبت شد", `درخواست ${service.title} (${order.code}) در انتظار پیشنهاد متخصصان است.`, `/account/orders/${order.id}`);
  return order;
}

async function resolveAddress(userId: string, input: BookingInput): Promise<{ city: string; region: string; addressLine: string; details: string }> {
  if (input.addressId) {
    const [saved] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)))
      .limit(1);
    if (!saved) throw new ApiError(422, "نشانی انتخاب‌شده معتبر نیست", "validation", { address: "نشانی یافت نشد" });
    return { city: saved.city, region: saved.region, addressLine: saved.addressLine, details: saved.details };
  }

  const addr = input.address;
  if (!addr) throw new ApiError(422, "نشانی را وارد کنید", "validation", { address: "نشانی الزامی است" });
  const city = CITIES.find((c) => c.name === addr.city);
  if (!city) throw new ApiError(422, "شهر انتخاب‌شده در محدوده خدمات نیست", "validation", { address: "شهر نامعتبر است" });
  if (!(city.regions as readonly string[]).includes(addr.region)) {
    throw new ApiError(422, "منطقه انتخاب‌شده با شهر همخوانی ندارد", "validation", { address: "منطقه نامعتبر است" });
  }

  if (input.saveAddress) {
    const existing = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId));
    await db.insert(addresses).values({
      userId,
      title: addr.title,
      city: addr.city,
      region: addr.region,
      addressLine: addr.addressLine,
      details: addr.details ?? "",
      isDefault: existing.length === 0 || Boolean(addr.isDefault),
    });
    if (addr.isDefault && existing.length) {
      await db.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), ne(addresses.title, addr.title)));
    }
  }
  return { city: addr.city, region: addr.region, addressLine: addr.addressLine, details: addr.details ?? "" };
}

export interface OfferView {
  id: number;
  price: number;
  arrivalMinutes: number;
  description: string;
  status: string;
  isDemo: boolean;
  createdAt: Date;
  professional: {
    userId: string;
    fullName: string;
    headline: string;
    rating: number;
    reviewsCount: number;
    completedJobs: number;
    experienceYears: number;
    verified: boolean;
    avatarTone: string;
  } | null;
  latestReview: { rating: number; comment: string; author: string } | null;
}

export interface CustomerOrderListItem {
  id: number;
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  serviceTitle: string;
  serviceSlug: string;
  total: number;
  scheduledAt: Date;
  timeSlot: string;
  createdAt: Date;
  professionalName: string | null;
  city: string;
  urgent: boolean;
}

export async function listCustomerOrders(userId: string, filter: { status?: string; q?: string } = {}): Promise<CustomerOrderListItem[]> {
  const rows = await db
    .select({ order: orders, service: services, pro: users })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .leftJoin(users, eq(orders.professionalId, users.id))
    .where(eq(orders.customerId, userId))
    .orderBy(desc(orders.createdAt));

  await Promise.all(rows.filter((r) => r.order.status === "waiting_offers").map((r) => maybeGenerateDemoOffers(r.order)));

  const q = filter.q ? normalizeFa(filter.q) : "";
  return rows
    .map(({ order, service, pro }) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      serviceTitle: service.title,
      serviceSlug: service.slug,
      total: order.total,
      scheduledAt: order.scheduledAt,
      timeSlot: order.timeSlot,
      createdAt: order.createdAt,
      professionalName: pro?.fullName ?? null,
      city: order.city,
      urgent: order.urgent,
    }))
    .filter((o) => (filter.status && filter.status !== "all" ? o.status === filter.status : true))
    .filter((o) => (q ? normalizeFa(`${o.code} ${o.serviceTitle} ${o.city}`).includes(q) : true));
}

export async function getCustomerOrderDetail(userId: string, orderId: number) {
  const [row] = await db
    .select({ order: orders, service: services, pro: users })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .leftJoin(users, eq(orders.professionalId, users.id))
    .where(and(eq(orders.id, orderId), eq(orders.customerId, userId)))
    .limit(1);
  if (!row) throw new ApiError(404, "سفارش یافت نشد", "not_found");

  await maybeGenerateDemoOffers(row.order);
  const fresh = await loadOrderRow(orderId);
  const { order, service } = row;
  const current = fresh ?? order;

  const offerRows = await db
    .select({ offer: offers, pro: users, profile: professionalProfiles })
    .from(offers)
    .innerJoin(users, eq(offers.professionalId, users.id))
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(and(eq(offers.orderId, orderId), inArray(offers.status, ["submitted", "selected"])))
    .orderBy(offers.price);

  const proIds = offerRows.map((r) => r.pro.id);
  const proReviews = proIds.length
    ? await db
        .select({ rating: reviews.rating, comment: reviews.comment, author: reviews.authorName, proId: reviews.professionalId })
        .from(reviews)
        .where(and(inArray(reviews.professionalId, proIds), eq(reviews.status, "published")))
        .orderBy(desc(reviews.createdAt))
    : [];

  const offerViews: OfferView[] = offerRows.map(({ offer, pro, profile }) => {
    const review = proReviews.find((r) => r.proId === pro.id);
    return {
      id: offer.id,
      price: offer.price,
      arrivalMinutes: offer.arrivalMinutes,
      description: offer.description,
      status: offer.status,
      isDemo: offer.isDemo,
      createdAt: offer.createdAt,
      professional: {
        userId: pro.id,
        fullName: pro.fullName,
        headline: profile.headline,
        rating: profile.rating,
        reviewsCount: profile.reviewsCount,
        completedJobs: profile.completedJobs,
        experienceYears: profile.experienceYears,
        verified: profile.verificationStatus === "verified",
        avatarTone: profile.avatarTone,
      },
      latestReview: review ? { rating: review.rating, comment: review.comment, author: review.author } : null,
    };
  });

  const paymentRows = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
  const [conv] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.orderId, orderId)).limit(1);
  const [review] = await db.select().from(reviews).where(eq(reviews.orderId, orderId)).limit(1);

  return {
    order: current,
    service: { title: service.title, slug: service.slug, questions: service.questions },
    professional: row.pro
      ? { userId: row.pro.id, fullName: row.pro.fullName, phone: row.pro.phone }
      : null,
    offers: offerViews,
    payments: paymentRows.map((p) => ({ id: p.id, amount: p.amount, status: p.status, providerRef: p.providerRef, failureReason: p.failureReason, createdAt: p.createdAt })),
    conversationId: conv?.id ?? null,
    review: review ? { id: review.id, rating: review.rating, comment: review.comment, reply: review.reply } : null,
    canCancel: CUSTOMER_CANCELLABLE.includes(current.status),
    canReschedule: RESCHEDULABLE.includes(current.status),
  };
}

async function loadOrderRow(orderId: number): Promise<OrderRow | null> {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return row ?? null;
}

async function getOwnedOrder(userId: string, orderId: number): Promise<OrderRow> {
  const [row] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, userId))).limit(1);
  if (!row) throw new ApiError(404, "سفارش یافت نشد", "not_found");
  return row;
}

/** Customer selects a professional's offer; computes pricing and moves the order forward. */
export async function selectOffer(user: SessionUser, orderId: number, offerId: number): Promise<OrderRow> {
  const order = await getOwnedOrder(user.id, orderId);
  if (order.status !== "offers_received") {
    throw new ApiError(409, "در این مرحله امکان انتخاب متخصص وجود ندارد", "invalid_state");
  }
  const [offer] = await db
    .select()
    .from(offers)
    .where(and(eq(offers.id, offerId), eq(offers.orderId, orderId), eq(offers.status, "submitted")))
    .limit(1);
  if (!offer) throw new ApiError(404, "پیشنهاد موردنظر دیگر در دسترس نیست", "not_found");
  await assertProAvailable(offer.professionalId, order);

  let discount = 0;
  if (order.couponCode) {
    const coupon = await findActiveCoupon(order.couponCode);
    if (coupon) discount = couponDiscount(coupon, offer.price);
  }
  const breakdown = computeBreakdown({ offerPrice: offer.price, urgent: order.urgent, discount });

  await db.update(offers).set({ status: "selected" }).where(eq(offers.id, offerId));
  await db
    .update(offers)
    .set({ status: "declined" })
    .where(and(eq(offers.orderId, orderId), ne(offers.id, offerId), eq(offers.status, "submitted")));

  const [updated] = await db
    .update(orders)
    .set({
      status: "professional_selected",
      paymentStatus: "unpaid",
      selectedOfferId: offerId,
      professionalId: offer.professionalId,
      estimatedPrice: offer.price,
      urgentFee: breakdown.urgentFee,
      serviceFee: breakdown.serviceFee,
      discount: breakdown.discount,
      total: breakdown.total,
      updatedAt: new Date(),
      statusHistory: appendHistory(order.statusHistory, "professional_selected", "متخصص توسط مشتری انتخاب شد"),
    })
    .where(eq(orders.id, orderId))
    .returning();

  await ensureConversation(orderId, order.customerId, offer.professionalId);
  await notify(offer.professionalId, "booking", "متخصص برای سفارش شما انتخاب شد", `سفارش ${order.code} در انتظار تأیید پرداخت مشتری است.`, "/pro/jobs");
  return updated!;
}

// ---------- Payments (provider abstraction + sandbox) ----------

export interface PaymentProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  createPayment(input: { amount: number; orderCode: string }): { providerRef: string };
}

/**
 * Sandbox provider: no real money moves. It issues a reference and the customer
 * confirms the outcome in the clearly labelled sandbox panel. Replace with a real
 * gateway adapter (e.g. Zarinpal / IDPay) implementing PaymentProvider.
 */
export const paymentProvider: PaymentProvider = {
  name: "sandbox",
  isSandbox: true,
  createPayment: () => ({ providerRef: `SBX-${randomBytes(6).toString("hex").toUpperCase()}` }),
};

export async function initPayment(user: SessionUser, orderId: number) {
  const order = await getOwnedOrder(user.id, orderId);
  if (order.status !== "professional_selected" || order.paymentStatus === "paid") {
    throw new ApiError(409, "پرداخت برای این سفارش در این مرحله ممکن نیست", "invalid_state");
  }
  // Re-use a pending payment for the same amount so repeated clicks never create duplicate charges.
  const [existingPending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "pending"), eq(payments.amount, order.total)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (existingPending) {
    return { paymentId: existingPending.id, providerRef: existingPending.providerRef, amount: existingPending.amount, isSandbox: paymentProvider.isSandbox, provider: existingPending.provider };
  }
  const ref = paymentProvider.createPayment({ amount: order.total, orderCode: order.code });
  const [payment] = await db
    .insert(payments)
    .values({ orderId, amount: order.total, status: "pending", provider: paymentProvider.name, providerRef: ref.providerRef })
    .returning();
  await db.update(orders).set({ paymentStatus: "pending", updatedAt: new Date() }).where(eq(orders.id, orderId));
  return {
    paymentId: payment!.id,
    providerRef: payment!.providerRef,
    amount: payment!.amount,
    isSandbox: paymentProvider.isSandbox,
    provider: paymentProvider.name,
  };
}

export async function verifyPayment(user: SessionUser, orderId: number, outcome: "success" | "failed") {
  const order = await getOwnedOrder(user.id, orderId);
  const [pending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "pending")))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!pending) throw new ApiError(409, "تراکنش در انتظاری برای این سفارش وجود ندارد", "invalid_state");

  if (outcome === "failed") {
    await db
      .update(payments)
      .set({ status: "failed", failureReason: "پرداخت در درگاه آزمایشی ناموفق اعلام شد", updatedAt: new Date() })
      .where(eq(payments.id, pending.id));
    await db.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, orderId));
    await notify(user.id, "payment", "پرداخت ناموفق بود", `پرداخت سفارش ${order.code} انجام نشد. می‌توانید دوباره تلاش کنید.`, `/account/orders/${orderId}`);
    return { status: "failed" as const };
  }

  await db.update(payments).set({ status: "paid", updatedAt: new Date() }).where(eq(payments.id, pending.id));
  const [confirmed] = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "confirmed",
      updatedAt: new Date(),
      statusHistory: appendHistory(order.statusHistory, "confirmed", "پرداخت موفق و سفارش تأیید شد"),
    })
    .where(eq(orders.id, orderId))
    .returning();
  await db.insert(transactions).values({
    userId: user.id,
    type: "customer_payment",
    amount: order.total,
    orderId,
    description: `پرداخت سفارش ${order.code}`,
  });
  if (order.couponCode) {
    await db.update(coupons).set({ usageCount: sql`${coupons.usageCount} + 1` }).where(eq(coupons.code, order.couponCode));
  }
  await notify(user.id, "payment", "پرداخت موفق", `پرداخت سفارش ${order.code} به مبلغ ${formatPrice(order.total)} ثبت شد.`, `/account/orders/${orderId}`);
  if (order.professionalId) {
    await notify(order.professionalId, "payment", "سفارش تأیید شد", `سفارش ${order.code} پرداخت شد و آماده اجرا است.`, "/pro/jobs");
  }
  return { status: "paid" as const, order: confirmed };
}

async function refundIfPaid(order: OrderRow, reason: string): Promise<void> {
  if (order.paymentStatus !== "paid") return;
  await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(and(eq(payments.orderId, order.id), eq(payments.status, "paid")));
  await db.insert(transactions).values({
    userId: order.customerId,
    type: "refund",
    amount: order.total,
    orderId: order.id,
    description: `بازپرداخت سفارش ${order.code} (${reason})`,
  });
  await db.update(orders).set({ paymentStatus: "refunded" }).where(eq(orders.id, order.id));
  await notify(order.customerId, "payment", "بازپرداخت ثبت شد", `مبلغ ${formatPrice(order.total)} به کیف پول شما بازگردانده شد.`, "/account/wallet");
}

// ---------- Customer: cancel / reschedule / review / dispute ----------

export async function cancelOrder(user: SessionUser, orderId: number, reason: string): Promise<OrderRow> {
  const order = await getOwnedOrder(user.id, orderId);
  if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw new ApiError(409, "این سفارش در مرحله‌ای است که امکان لغو ندارد", "invalid_state");
  }
  return cancelInternal(order, reason, "مشتری");
}

async function cancelInternal(order: OrderRow, reason: string, by: string): Promise<OrderRow> {
  await db.update(offers).set({ status: "declined" }).where(and(eq(offers.orderId, order.id), eq(offers.status, "submitted")));
  const [updated] = await db
    .update(orders)
    .set({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      updatedAt: new Date(),
      statusHistory: appendHistory(order.statusHistory, "cancelled", `لغو توسط ${by}: ${reason}`),
    })
    .where(eq(orders.id, order.id))
    .returning();
  await refundIfPaid(order, "لغو سفارش");
  await notify(order.customerId, "booking", "سفارش لغو شد", `سفارش ${order.code} لغو شد.`, `/account/orders/${order.id}`);
  if (order.professionalId) {
    await notify(order.professionalId, "booking", "سفارش لغو شد", `سفارش ${order.code} توسط ${by} لغو شد.`, "/pro/jobs");
  }
  return updated!;
}

export async function rescheduleOrder(user: SessionUser, orderId: number, scheduledDate: string, timeSlot: string): Promise<OrderRow> {
  const order = await getOwnedOrder(user.id, orderId);
  if (!RESCHEDULABLE.includes(order.status)) throw new ApiError(409, "زمان این سفارش دیگر قابل تغییر نیست", "invalid_state");
  validateSchedule(scheduledDate);
  const newAt = slotToDate(scheduledDate, timeSlot);
  const [updated] = await db
    .update(orders)
    .set({
      scheduledAt: newAt,
      timeSlot,
      updatedAt: new Date(),
      statusHistory: appendHistory(order.statusHistory, order.status, "زمان قرار تغییر کرد"),
    })
    .where(eq(orders.id, orderId))
    .returning();
  if (order.professionalId) {
    await notify(order.professionalId, "reminder", "تغییر زمان سفارش", `زمان سفارش ${order.code} تغییر کرد.`, "/pro/jobs");
  }
  return updated!;
}

export async function createReview(user: SessionUser, orderId: number, rating: number, comment: string) {
  const order = await getOwnedOrder(user.id, orderId);
  if (order.status !== "completed") throw new ApiError(409, "فقط برای سفارش‌های انجام‌شده می‌توانید نظر ثبت کنید", "invalid_state");
  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.orderId, orderId)).limit(1);
  if (existing) throw new ApiError(409, "برای این سفارش قبلاً نظر ثبت کرده‌اید", "duplicate");

  const [service] = await db.select().from(services).where(eq(services.id, order.serviceId)).limit(1);
  const [review] = await db
    .insert(reviews)
    .values({
      orderId,
      customerId: user.id,
      authorName: user.fullName,
      serviceId: order.serviceId,
      professionalId: order.professionalId,
      rating,
      comment,
    })
    .returning();

  if (service) {
    const newCount = service.reviewsCount + 1;
    const newRating = (service.rating * service.reviewsCount + rating) / newCount;
    await db.update(services).set({ rating: Math.round(newRating * 100) / 100, reviewsCount: newCount }).where(eq(services.id, service.id));
  }
  if (order.professionalId) {
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, order.professionalId)).limit(1);
    if (profile) {
      const newCount = profile.reviewsCount + 1;
      const newRating = (profile.rating * profile.reviewsCount + rating) / newCount;
      await db
        .update(professionalProfiles)
        .set({ rating: Math.round(newRating * 100) / 100, reviewsCount: newCount })
        .where(eq(professionalProfiles.userId, order.professionalId));
    }
    await notify(order.professionalId, "booking", "نظر جدید دریافت شد", `مشتری برای سفارش ${order.code} امتیاز ${rating} ثبت کرد.`, "/pro/reviews");
  }
  return review!;
}

export async function updateReview(user: SessionUser, reviewId: number, rating: number, comment: string) {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.customerId, user.id)))
    .limit(1);
  if (!existing) throw new ApiError(404, "نظر یافت نشد", "not_found");
  if (Date.now() - existing.createdAt.getTime() > 7 * 86_400_000) {
    throw new ApiError(409, "مهلت ویرایش نظر (۷ روز) تمام شده است", "expired");
  }
  const [updated] = await db
    .update(reviews)
    .set({ rating, comment, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
    .returning();

  const delta = rating - existing.rating;
  if (delta !== 0) {
    const [service] = await db.select().from(services).where(eq(services.id, existing.serviceId)).limit(1);
    if (service && service.reviewsCount > 0) {
      const newRating = (service.rating * service.reviewsCount + delta) / service.reviewsCount;
      await db.update(services).set({ rating: Math.round(newRating * 100) / 100 }).where(eq(services.id, service.id));
    }
    if (existing.professionalId) {
      const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, existing.professionalId)).limit(1);
      if (profile && profile.reviewsCount > 0) {
        const newRating = (profile.rating * profile.reviewsCount + delta) / profile.reviewsCount;
        await db.update(professionalProfiles).set({ rating: Math.round(newRating * 100) / 100 }).where(eq(professionalProfiles.userId, existing.professionalId));
      }
    }
  }
  return updated!;
}

export async function openDispute(user: SessionUser, orderId: number, note: string) {
  const order = await getOwnedOrder(user.id, orderId);
  if (!["in_progress", "completed", "confirmed", "on_the_way"].includes(order.status)) {
    throw new ApiError(409, "در این مرحله امکان ثبت اختلاف نیست", "invalid_state");
  }
  if (order.disputeStatus === "open") throw new ApiError(409, "یک اختلاف باز برای این سفارش وجود دارد", "duplicate");
  const [updated] = await db
    .update(orders)
    .set({ disputeStatus: "open", disputeNote: note, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  await notify(user.id, "booking", "اختلاف ثبت شد", "تیم پشتیبانی به‌زودی موضوع را بررسی می‌کند.", `/account/orders/${orderId}`);
  return updated!;
}

// ---------- Professional: offers and jobs ----------

export async function getVerifiedProfile(userId: string) {
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId)).limit(1);
  if (!profile) throw new ApiError(403, "پروفایل متخصص یافت نشد", "forbidden");
  return profile;
}

export async function listProRequests(proUser: SessionUser) {
  const profile = await getVerifiedProfile(proUser.id);
  const rows = await db
    .select({ order: orders, service: services })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .where(and(inArray(orders.status, ["waiting_offers", "offers_received"]), isNull(orders.professionalId)))
    .orderBy(desc(orders.createdAt));
  const myOffers = await db.select({ orderId: offers.orderId }).from(offers).where(eq(offers.professionalId, proUser.id));
  const offered = new Set(myOffers.map((o) => o.orderId));

  return rows
    .filter(({ order, service }) => profile.categoryIds.includes(service.categoryId) && profile.serviceAreas.includes(order.city))
    .map(({ order, service }) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      serviceTitle: service.title,
      city: order.city,
      region: order.region,
      addressLine: order.addressLine,
      addressDetails: order.addressDetails,
      answers: order.answers,
      notes: order.notes,
      urgent: order.urgent,
      scheduledAt: order.scheduledAt,
      timeSlot: order.timeSlot,
      basePrice: service.basePrice,
      createdAt: order.createdAt,
      hasOffer: offered.has(order.id),
    }));
}

export async function submitOffer(proUser: SessionUser, input: { orderId: number; price: number; arrivalMinutes: number; description: string }) {
  const profile = await getVerifiedProfile(proUser.id);
  if (profile.verificationStatus !== "verified") {
    throw new ApiError(403, "حساب شما هنوز تأیید نشده است؛ پس از تأیید می‌توانید پیشنهاد دهید", "not_verified");
  }
  const [row] = await db
    .select({ order: orders, service: services })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .where(eq(orders.id, input.orderId))
    .limit(1);
  if (!row) throw new ApiError(404, "درخواست یافت نشد", "not_found");
  const { order, service } = row;
  if (!["waiting_offers", "offers_received"].includes(order.status) || order.professionalId) {
    throw new ApiError(409, "این درخواست دیگر پذیرای پیشنهاد نیست", "invalid_state");
  }
  if (!profile.categoryIds.includes(service.categoryId) || !profile.serviceAreas.includes(order.city)) {
    throw new ApiError(403, "این درخواست در حوزه تخصص یا منطقه خدمت شما نیست", "forbidden");
  }
  const [existing] = await db
    .select({ id: offers.id, status: offers.status })
    .from(offers)
    .where(and(eq(offers.orderId, input.orderId), eq(offers.professionalId, proUser.id)))
    .limit(1);
  if (existing) throw new ApiError(409, "برای این درخواست قبلاً پیشنهاد داده‌اید", "duplicate");

  const [offer] = await db
    .insert(offers)
    .values({ orderId: input.orderId, professionalId: proUser.id, price: input.price, arrivalMinutes: input.arrivalMinutes, description: input.description })
    .returning();
  if (order.status === "waiting_offers") {
    await db
      .update(orders)
      .set({ status: "offers_received", updatedAt: new Date(), statusHistory: appendHistory(order.statusHistory, "offers_received", "پیشنهاد متخصص دریافت شد") })
      .where(eq(orders.id, order.id));
  }
  await notify(order.customerId, "offer", "پیشنهاد جدید دریافت شد", `${proUser.fullName} برای ${service.title} پیشنهاد داد.`, `/account/orders/${order.id}`);
  return offer!;
}

export async function declineRequest(proUser: SessionUser, orderId: number) {
  await getVerifiedProfile(proUser.id);
  const [existing] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.orderId, orderId), eq(offers.professionalId, proUser.id)))
    .limit(1);
  if (existing) throw new ApiError(409, "برای این درخواست قبلاً پاسخ داده‌اید", "duplicate");
  await db.insert(offers).values({ orderId, professionalId: proUser.id, price: 0, arrivalMinutes: 0, description: "رد شد", status: "declined" });
  return { ok: true };
}

export async function listProJobs(proUser: SessionUser) {
  const rows = await db
    .select({ order: orders, service: services, customer: users })
    .from(orders)
    .innerJoin(services, eq(orders.serviceId, services.id))
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(eq(orders.professionalId, proUser.id))
    .orderBy(desc(orders.scheduledAt));
  return rows.map(({ order, service, customer }) => ({
    id: order.id,
    code: order.code,
    status: order.status,
    paymentStatus: order.paymentStatus,
    serviceTitle: service.title,
    customerName: customer.fullName,
    customerPhone: ["confirmed", "on_the_way", "in_progress", "completed"].includes(order.status) ? customer.phone : null,
    city: order.city,
    region: order.region,
    addressLine: order.addressLine,
    addressDetails: order.addressDetails,
    scheduledAt: order.scheduledAt,
    timeSlot: order.timeSlot,
    total: order.total,
    estimatedPrice: order.estimatedPrice,
    notes: order.notes,
    answers: order.answers,
    completedAt: order.completedAt,
  }));
}

/**
 * Applies a status change if the actor is allowed to perform it.
 * Completion books the commission and professional earning exactly once.
 */
export async function changeOrderStatus(
  actor: SessionUser,
  orderId: number,
  to: OrderStatus,
  note: string,
): Promise<OrderRow> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ApiError(404, "سفارش یافت نشد", "not_found");

  if (PAID_REQUIRED.includes(to) && order.paymentStatus !== "paid") {
    throw new ApiError(409, "پرداخت این سفارش هنوز تأیید نشده است؛ مرحله قبل را تکمیل کنید.", "unpaid");
  }

  if (actor.role === "professional") {
    if (order.professionalId !== actor.id) throw new ApiError(403, "این سفارش به شما واگذار نشده است", "forbidden");
    if (!canProfessionalTransition(order.status, to)) throw new ApiError(409, "تغییر وضعیت به این مرحله مجاز نیست", "invalid_transition");
  } else if (actor.role === "admin") {
    if (!canAdminTransition(order.status, to)) throw new ApiError(409, "تغییر وضعیت به این مرحله مجاز نیست", "invalid_transition");
  } else {
    throw new ApiError(403, "دسترسی مجاز نیست", "forbidden");
  }

  const patch: Partial<typeof orders.$inferInsert> = {
    status: to,
    updatedAt: new Date(),
    statusHistory: appendHistory(order.statusHistory, to, note || statusNote(to)),
  };
  if (to === "completed") patch.completedAt = new Date();

  const [updated] = await db.update(orders).set(patch).where(eq(orders.id, orderId)).returning();

  if (to === "completed" && order.professionalId) {
    await bookCompletionEarnings(order);
  }

  await notify(order.customerId, "booking", "وضعیت سفارش تغییر کرد", `سفارش ${order.code}: ${statusNote(to)}`, `/account/orders/${orderId}`);
  if (actor.role === "admin") await recordAudit(actor.id, "order.status", "order", String(orderId), `${order.status} → ${to}`);
  return updated!;
}

function statusNote(to: OrderStatus): string {
  const map: Partial<Record<OrderStatus, string>> = {
    on_the_way: "متخصص در مسیر محل است",
    in_progress: "خدمت شروع شد",
    completed: "خدمت انجام شد",
    confirmed: "سفارش تأیید شد",
    cancelled: "سفارش لغو شد",
  };
  return map[to] ?? "وضعیت به‌روزرسانی شد";
}

async function bookCompletionEarnings(order: OrderRow): Promise<void> {
  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.orderId, order.id), eq(transactions.type, "pro_earning")))
    .limit(1);
  if (existing || !order.professionalId) return;

  const base = order.estimatedPrice;
  const { commission, net } = computeCommission(base);
  await db.insert(transactions).values([
    { userId: order.professionalId, type: "commission", amount: commission, orderId: order.id, description: `کمیسیون سفارش ${order.code}` },
    { userId: order.professionalId, type: "pro_earning", amount: net, orderId: order.id, description: `درآمد سفارش ${order.code}` },
  ]);
  await db
    .update(professionalProfiles)
    .set({ completedJobs: sql`${professionalProfiles.completedJobs} + 1`, updatedAt: new Date() })
    .where(eq(professionalProfiles.userId, order.professionalId));
  await notify(order.professionalId, "payment", "درآمد سفارش ثبت شد", `مبلغ ${formatPrice(net)} به موجودی شما اضافه شد.`, "/pro/earnings");
}

/** Offers a professional has sent (or declined), with the outcome for each. */
export async function listProOffers(proUser: SessionUser) {
  const rows = await db
    .select({ offer: offers, order: orders, service: services })
    .from(offers)
    .innerJoin(orders, eq(offers.orderId, orders.id))
    .innerJoin(services, eq(orders.serviceId, services.id))
    .where(and(eq(offers.professionalId, proUser.id), inArray(offers.status, ["submitted", "selected", "declined"])))
    .orderBy(desc(offers.createdAt));
  return rows.map(({ offer, order, service }) => ({
    id: offer.id,
    orderId: order.id,
    orderCode: order.code,
    serviceTitle: service.title,
    city: order.city,
    price: offer.price,
    arrivalMinutes: offer.arrivalMinutes,
    description: offer.description,
    status: offer.status,
    declinedByPro: offer.status === "declined" && offer.price === 0,
    orderStatus: order.status,
    createdAt: offer.createdAt,
  }));
}

// ---------- Admin: assignment and cancellation ----------

export async function adminAssignProfessional(admin: SessionUser, orderId: number, professionalId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ApiError(404, "سفارش یافت نشد", "not_found");
  if (!["waiting_offers", "offers_received"].includes(order.status)) {
    throw new ApiError(409, "واگذاری فقط در مرحله دریافت پیشنهاد امکان‌پذیر است", "invalid_state");
  }
  const profile = await getVerifiedProfile(professionalId);
  await assertProAvailable(professionalId, order);
  if (profile.verificationStatus !== "verified") throw new ApiError(422, "متخصص تأیید نشده است", "validation");
  const [service] = await db.select().from(services).where(eq(services.id, order.serviceId)).limit(1);

  await db.update(offers).set({ status: "declined" }).where(and(eq(offers.orderId, orderId), eq(offers.status, "submitted")));
  const [offer] = await db
    .insert(offers)
    .values({
      orderId,
      professionalId,
      price: service?.basePrice ?? order.estimatedPrice,
      arrivalMinutes: 60,
      description: "واگذاری توسط مدیریت سامانه",
      status: "selected",
    })
    .onConflictDoUpdate({
      target: [offers.orderId, offers.professionalId],
      set: { status: "selected", price: service?.basePrice ?? order.estimatedPrice, description: "واگذاری توسط مدیریت سامانه" },
    })
    .returning();

  const breakdown = computeBreakdown({ offerPrice: offer!.price, urgent: order.urgent });
  await db
    .update(orders)
    .set({
      status: "professional_selected",
      professionalId,
      selectedOfferId: offer!.id,
      estimatedPrice: offer!.price,
      urgentFee: breakdown.urgentFee,
      serviceFee: breakdown.serviceFee,
      total: breakdown.total,
      updatedAt: new Date(),
      statusHistory: appendHistory(order.statusHistory, "professional_selected", "واگذاری توسط مدیریت"),
    })
    .where(eq(orders.id, orderId));
  await ensureConversation(orderId, order.customerId, professionalId);
  await notify(order.customerId, "booking", "متخصص برای سفارش شما تعیین شد", `سفارش ${order.code} به متخصص واگذار شد.`, `/account/orders/${orderId}`);
  await notify(professionalId, "booking", "سفارش جدید به شما واگذار شد", `سفارش ${order.code} در بخش کارهای من است.`, "/pro/jobs");
  await recordAudit(admin.id, "order.assign", "order", String(orderId), `واگذاری به ${professionalId}`);
}

export async function adminCancelOrder(admin: SessionUser, orderId: number, reason: string): Promise<OrderRow> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ApiError(404, "سفارش یافت نشد", "not_found");
  if (order.status === "completed" || order.status === "cancelled") throw new ApiError(409, "این سفارش قابل لغو نیست", "invalid_state");
  if (!ADMIN_TRANSITIONS[order.status].includes("cancelled")) throw new ApiError(409, "این سفارش قابل لغو نیست", "invalid_state");
  const updated = await cancelInternal(order, reason, "مدیریت");
  await recordAudit(admin.id, "order.cancel", "order", String(orderId), reason);
  return updated;
}

export async function adminUpdateDispute(admin: SessionUser, orderId: number, disputeStatus: "none" | "open" | "resolved", note: string) {
  const [updated] = await db
    .update(orders)
    .set({ disputeStatus, disputeNote: note, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  if (!updated) throw new ApiError(404, "سفارش یافت نشد", "not_found");
  await recordAudit(admin.id, "order.dispute", "order", String(orderId), `${disputeStatus}: ${note}`);
  return updated;
}

export async function getOrderStatusCounts(): Promise<Record<string, number>> {
  const rows = await db.select({ status: orders.status, total: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.total]));
}
