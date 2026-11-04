import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  Attachment,
  DisputeStatus,
  FaqItem,
  FormQuestion,
  NotificationType,
  OfferStatus,
  OrderStatus,
  PaymentStatus,
  ProVerificationStatus,
  Role,
  TransactionType,
  UserStatus,
} from "@/lib/domain";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// ---------- Identity ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull().unique(),
    email: text("email").unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Role>().notNull().default("customer"),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    avatarUrl: text("avatar_url"),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const verificationCodes = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface ProDocument {
  type: string;
  name: string;
  status: "uploaded" | "approved" | "rejected";
  /** Image data URL uploaded during registration (reviewed by admins). */
  dataUrl?: string;
}

export const professionalProfiles = pgTable("professional_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  experienceYears: integer("experience_years").notNull().default(0),
  skills: jsonb("skills").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  serviceAreas: jsonb("service_areas").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  categoryIds: jsonb("category_ids").$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  workingHours: jsonb("working_hours")
    .$type<{ days: string[]; from: string; to: string }>()
    .notNull()
    .default(sql`'{"days":[],"from":"08:00","to":"20:00"}'::jsonb`),
  pricing: jsonb("pricing")
    .$type<{ minPrice: number; hourlyRate: number; visitFee: number }>()
    .notNull()
    .default(sql`'{"minPrice":0,"hourlyRate":0,"visitFee":0}'::jsonb`),
  documents: jsonb("documents").$type<ProDocument[]>().notNull().default(sql`'[]'::jsonb`),
  portfolio: jsonb("portfolio")
    .$type<{ title: string; description: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  verificationStatus: text("verification_status").$type<ProVerificationStatus>().notNull().default("pending"),
  verificationNotes: text("verification_notes").notNull().default(""),
  rating: doublePrecision("rating").notNull().default(0),
  reviewsCount: integer("reviews_count").notNull().default(0),
  completedJobs: integer("completed_jobs").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  avatarTone: text("avatar_tone").notNull().default("emerald"),
  ...timestamps,
});

export const addresses = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    city: text("city").notNull(),
    region: text("region").notNull(),
    addressLine: text("address_line").notNull(),
    details: text("details").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

// ---------- Catalog ----------

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id"),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    iconKey: text("icon_key").notNull().default("wrench"),
    tone: text("tone").notNull().default("emerald"),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").notNull(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    benefits: jsonb("benefits").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    steps: jsonb("steps").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    requirements: jsonb("requirements").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    priceFactors: jsonb("price_factors").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    keywords: jsonb("keywords").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    basePrice: integer("base_price").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    formFamily: text("form_family").notNull().default("general"),
    questions: jsonb("questions").$type<FormQuestion[]>().notNull().default(sql`'[]'::jsonb`),
    faqs: jsonb("faqs").$type<FaqItem[]>().notNull().default(sql`'[]'::jsonb`),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    tone: text("tone").notNull().default("emerald"),
    rating: doublePrecision("rating").notNull().default(4.7),
    reviewsCount: integer("reviews_count").notNull().default(0),
    isPopular: boolean("is_popular").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("services_category_idx").on(t.categoryId)],
);

// ---------- Orders ----------

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
  note: string;
}

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id),
    status: text("status").$type<OrderStatus>().notNull().default("waiting_offers"),
    paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("unpaid"),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default(sql`'[]'::jsonb`),
    city: text("city").notNull(),
    region: text("region").notNull(),
    addressLine: text("address_line").notNull(),
    addressDetails: text("address_details").notNull().default(""),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    timeSlot: text("time_slot").notNull(),
    flexible: boolean("flexible").notNull().default(false),
    urgent: boolean("urgent").notNull().default(false),
    notes: text("notes").notNull().default(""),
    selectedOfferId: integer("selected_offer_id"),
    professionalId: uuid("professional_id").references(() => users.id, { onDelete: "set null" }),
    estimatedPrice: integer("estimated_price").notNull().default(0),
    urgentFee: integer("urgent_fee").notNull().default(0),
    serviceFee: integer("service_fee").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    couponCode: text("coupon_code"),
    demoOffersGenerated: boolean("demo_offers_generated").notNull().default(false),
    cancelReason: text("cancel_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    disputeStatus: text("dispute_status").$type<DisputeStatus>().notNull().default("none"),
    disputeNote: text("dispute_note").notNull().default(""),
    statusHistory: jsonb("status_history").$type<StatusHistoryEntry[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId),
    index("orders_professional_idx").on(t.professionalId),
    index("orders_status_idx").on(t.status),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    price: integer("price").notNull(),
    arrivalMinutes: integer("arrival_minutes").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<OfferStatus>().notNull().default("submitted"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("offers_order_pro_uidx").on(t.orderId, t.professionalId)],
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  status: text("status").$type<PaymentStatus>().notNull().default("pending"),
  provider: text("provider").notNull().default("sandbox"),
  providerRef: text("provider_ref").notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<TransactionType>().notNull(),
    amount: integer("amount").notNull(),
    status: text("status").$type<"completed" | "pending" | "rejected">().notNull().default("completed"),
    orderId: integer("order_id"),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("transactions_user_idx").on(t.userId), index("transactions_type_idx").on(t.type)],
);

// ---------- Reviews, favorites, notifications ----------

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").unique(),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    serviceId: integer("service_id").notNull(),
    professionalId: uuid("professional_id").references(() => users.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    status: text("status").$type<"published" | "hidden">().notNull().default("published"),
    ...timestamps,
  },
  (t) => [index("reviews_service_idx").on(t.serviceId), index("reviews_pro_idx").on(t.professionalId)],
);

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<"service" | "professional">().notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("favorites_uidx").on(t.userId, t.targetType, t.targetId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link").notNull().default(""),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

// ---------- Messaging ----------

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    attachment: jsonb("attachment").$type<Attachment | null>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

// ---------- Content & promotions ----------

export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default("مشاهده"),
  ctaHref: text("cta_href").notNull().default("/categories"),
  tone: text("tone").notNull().default("emerald"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  scope: text("scope").$type<"home" | "general">().notNull().default("home"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  body: text("body").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(false),
  ...timestamps,
});

export const staticPages = pgTable("static_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  isPublished: boolean("is_published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  percent: integer("percent").notNull(),
  maxAmount: integer("max_amount").notNull(),
  minTotal: integer("min_total").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull().default(""),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
