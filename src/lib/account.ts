import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  auditLogs,
  conversations,
  favorites,
  messages,
  notifications,
  orders,
  professionalProfiles,
  services,
  transactions,
  users,
} from "@/db/schema";
import { ApiError, type SessionUser } from "./auth";
import { CREDIT_TYPES, DEBIT_TYPES, formatDateTime, type Attachment, type NotificationType, type TransactionType } from "./domain";

// ---------- Shared side effects ----------

export async function notify(userId: string, type: NotificationType, title: string, body: string, link = ""): Promise<void> {
  await db.insert(notifications).values({ userId, type, title, body, link });
}

export async function recordAudit(actorId: string | null, action: string, entity: string, entityId: string, details = ""): Promise<void> {
  await db.insert(auditLogs).values({ actorId, action, entity, entityId, details });
}

/** Creates (or returns) the order-scoped conversation between customer and professional. */
export async function ensureConversation(orderId: number, customerId: string, professionalId: string): Promise<number> {
  const [existing] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.orderId, orderId)).limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(conversations)
    .values({ orderId, customerId, professionalId })
    .onConflictDoNothing({ target: conversations.orderId })
    .returning({ id: conversations.id });
  if (created) return created.id;
  const [again] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.orderId, orderId)).limit(1);
  return again!.id;
}

// ---------- Notifications ----------

/** Creates one appointment reminder per order that starts within the next 24 hours. */
export async function ensureReminders(userId: string): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3_600_000);
  const upcoming = await db
    .select({ id: orders.id, code: orders.code, scheduledAt: orders.scheduledAt })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, userId),
        inArray(orders.status, ["professional_selected", "confirmed", "on_the_way"]),
        gt(orders.scheduledAt, now),
        lt(orders.scheduledAt, horizon),
      ),
    );
  for (const o of upcoming) {
    const title = `یادآوری نوبت ${o.code}`;
    const [exists] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.title, title)))
      .limit(1);
    if (!exists) {
      await notify(userId, "reminder", title, `زمان قرار شما نزدیک است (${formatDateTime(o.scheduledAt)}).`, `/account/orders/${o.id}`);
    }
  }
}

export async function listNotifications(userId: string) {
  await ensureReminders(userId);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(60);
  return {
    items: rows,
    unread: rows.filter((r) => !r.isRead).length,
  };
}

export async function markNotificationsRead(userId: string, id?: number): Promise<void> {
  if (id != null) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return;
  }
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

// ---------- Profile ----------

export async function updateProfile(userId: string, input: { fullName: string; email: string | null; avatarUrl: string | null }) {
  if (input.email) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, input.email), ne(users.id, userId)))
      .limit(1);
    if (taken) throw new ApiError(409, "این ایمیل قبلاً استفاده شده است", "duplicate", { email: "ایمیل تکراری است" });
  }
  const [updated] = await db
    .update(users)
    .set({ fullName: input.fullName, email: input.email, avatarUrl: input.avatarUrl, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, fullName: users.fullName, email: users.email, avatarUrl: users.avatarUrl, phone: users.phone });
  return updated!;
}

// ---------- Addresses ----------

export async function listAddresses(userId: string) {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), asc(addresses.id));
}

export async function upsertAddress(
  userId: string,
  input: { title: string; city: string; region: string; addressLine: string; details: string; isDefault: boolean },
  id?: number,
) {
  if (id != null) {
    const [owned] = await db.select({ id: addresses.id }).from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).limit(1);
    if (!owned) throw new ApiError(404, "نشانی یافت نشد", "not_found");
    await db.update(addresses).set({ ...input }).where(eq(addresses.id, id));
  } else {
    const existing = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId));
    if (existing.length >= 10) throw new ApiError(422, "حداکثر ۱۰ نشانی می‌توانید ذخیره کنید", "limit");
    await db.insert(addresses).values({ ...input, userId, isDefault: input.isDefault || existing.length === 0 });
  }
  if (input.isDefault) await setDefaultAddress(userId, id ?? (await lastAddressId(userId)));
  return listAddresses(userId);
}

async function lastAddressId(userId: string): Promise<number> {
  const [row] = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.id)).limit(1);
  return row!.id;
}

export async function setDefaultAddress(userId: string, id: number): Promise<void> {
  const [owned] = await db.select({ id: addresses.id }).from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).limit(1);
  if (!owned) throw new ApiError(404, "نشانی یافت نشد", "not_found");
  await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
  await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, id));
}

export async function deleteAddress(userId: string, id: number): Promise<void> {
  const [owned] = await db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).limit(1);
  if (!owned) throw new ApiError(404, "نشانی یافت نشد", "not_found");
  const active = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.customerId, userId), inArray(orders.status, ["waiting_offers", "offers_received", "professional_selected", "confirmed", "on_the_way", "in_progress"]), eq(orders.addressLine, owned.addressLine)))
    .limit(1);
  if (active.length) throw new ApiError(409, "این نشانی در سفارش فعال استفاده شده است", "conflict");
  await db.delete(addresses).where(eq(addresses.id, id));
  if (owned.isDefault) {
    const [next] = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId)).limit(1);
    if (next) await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
  }
}

// ---------- Favorites ----------

export async function toggleFavorite(userId: string, targetType: "service" | "professional", targetId: string): Promise<{ active: boolean }> {
  const [existing] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.targetType, targetType), eq(favorites.targetId, targetId)))
    .limit(1);
  if (existing) {
    await db.delete(favorites).where(eq(favorites.id, existing.id));
    return { active: false };
  }
  if (targetType === "service") {
    const [svc] = await db.select({ id: services.id }).from(services).where(eq(services.id, Number(targetId))).limit(1);
    if (!svc) throw new ApiError(404, "خدمت یافت نشد", "not_found");
  }
  await db.insert(favorites).values({ userId, targetType, targetId });
  return { active: true };
}

export async function listFavorites(userId: string) {
  const rows = await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  const serviceIds = rows.filter((r) => r.targetType === "service").map((r) => Number(r.targetId));
  const proIds = rows.filter((r) => r.targetType === "professional").map((r) => r.targetId);

  const svcRows = serviceIds.length ? await db.select().from(services).where(inArray(services.id, serviceIds)) : [];
  const proRows = proIds.length
    ? await db
        .select({ user: users, profile: professionalProfiles })
        .from(users)
        .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
        .where(inArray(users.id, proIds))
    : [];

  return rows
    .map((r) => {
      if (r.targetType === "service") {
        const s = svcRows.find((x) => String(x.id) === r.targetId);
        return s ? { id: r.id, type: "service" as const, targetId: r.targetId, title: s.title, subtitle: s.shortDescription, href: `/services/${s.slug}`, rating: s.rating, basePrice: s.basePrice } : null;
      }
      const p = proRows.find((x) => x.user.id === r.targetId);
      return p
        ? { id: r.id, type: "professional" as const, targetId: r.targetId, title: p.user.fullName, subtitle: p.profile.headline, href: `/categories`, rating: p.profile.rating, basePrice: p.profile.pricing.minPrice }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function favoriteKeys(userId: string): Promise<string[]> {
  const rows = await db.select({ t: favorites.targetType, id: favorites.targetId }).from(favorites).where(eq(favorites.userId, userId));
  return rows.map((r) => `${r.t}:${r.id}`);
}

// ---------- Wallet ----------

export async function getWallet(userId: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(100);

  let balance = 0;
  for (const r of rows) {
    if (r.status === "rejected") continue;
    if (CREDIT_TYPES.includes(r.type as TransactionType)) balance += r.amount;
    if (DEBIT_TYPES.includes(r.type as TransactionType)) balance -= r.amount;
  }
  return {
    balance,
    transactions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      status: r.status,
      description: r.description,
      orderId: r.orderId,
      createdAt: r.createdAt,
      direction: CREDIT_TYPES.includes(r.type as TransactionType) ? ("credit" as const) : ("debit" as const),
    })),
  };
}

/** Sandbox top-up. No real money is moved; the transaction is labelled as sandbox in its description. */
export async function depositWallet(userId: string, amount: number): Promise<void> {
  await db.insert(transactions).values({
    userId,
    type: "wallet_deposit",
    amount,
    description: "شارژ کیف پول (درگاه آزمایشی - بدون پرداخت واقعی)",
  });
  await notify(userId, "payment", "کیف پول شارژ شد", "شارژ آزمایشی کیف پول با موفقیت ثبت شد.", "/account/wallet");
}

// ---------- Messaging ----------

export async function listConversations(user: SessionUser) {
  const rows = await db
    .select({ conv: conversations, order: orders, service: services })
    .from(conversations)
    .innerJoin(orders, eq(conversations.orderId, orders.id))
    .innerJoin(services, eq(orders.serviceId, services.id))
    .where(or(eq(conversations.customerId, user.id), eq(conversations.professionalId, user.id)))
    .orderBy(desc(conversations.createdAt));

  const result = [];
  for (const { conv, order, service } of rows) {
    const otherId = conv.customerId === user.id ? conv.professionalId : conv.customerId;
    const [other] = await db.select({ fullName: users.fullName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, otherId)).limit(1);
    const [last] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    const [unread] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.conversationId, conv.id), ne(messages.senderId, user.id), isNull(messages.readAt)));
    result.push({
      id: conv.id,
      orderId: order.id,
      orderCode: order.code,
      serviceTitle: service.title,
      otherName: other?.fullName ?? "کاربر",
      lastMessage: last ? (last.body || "📎 پیوست") : "",
      lastAt: last?.createdAt ?? conv.createdAt,
      unread: unread?.c ?? 0,
    });
  }
  return result;
}

async function assertParticipant(user: SessionUser, orderId: number) {
  const [conv] = await db.select().from(conversations).where(eq(conversations.orderId, orderId)).limit(1);
  if (!conv || (conv.customerId !== user.id && conv.professionalId !== user.id)) {
    throw new ApiError(404, "گفتگو یافت نشد", "not_found");
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new ApiError(404, "سفارش یافت نشد", "not_found");
  return { conv, order };
}

export async function getConversation(user: SessionUser, orderId: number) {
  const { conv, order } = await assertParticipant(user, orderId);
  const [service] = await db.select({ title: services.title }).from(services).where(eq(services.id, order.serviceId)).limit(1);
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, conv.id), ne(messages.senderId, user.id), isNull(messages.readAt)));
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.createdAt))
    .limit(300);
  return {
    conversationId: conv.id,
    orderId,
    orderCode: order.code,
    serviceTitle: service?.title ?? "",
    orderStatus: order.status,
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      attachment: m.attachment,
      mine: m.senderId === user.id,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
  };
}

export async function sendMessage(user: SessionUser, orderId: number, body: string, attachment: Attachment | null) {
  const { conv, order } = await assertParticipant(user, orderId);
  if (order.status === "cancelled") throw new ApiError(409, "گفتگو برای سفارش لغوشده بسته است", "invalid_state");
  const [row] = await db
    .insert(messages)
    .values({ conversationId: conv.id, senderId: user.id, body, attachment })
    .returning();
  const otherId = conv.customerId === user.id ? conv.professionalId : conv.customerId;
  await notify(otherId, "booking", "پیام جدید", `${user.fullName} در سفارش ${order.code} پیام فرستاد.`, `/messages?order=${orderId}`);
  return row!;
}

// ---------- Helpers used by pages ----------

export async function getProfileRow(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return row?.c ?? 0;
}

export async function countUnreadMessages(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        or(eq(conversations.customerId, userId), eq(conversations.professionalId, userId)),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
  return row?.c ?? 0;
}

export { type NotificationType };
