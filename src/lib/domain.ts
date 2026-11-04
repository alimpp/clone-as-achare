// Shared domain constants, pure business rules and Persian formatting helpers.
// This module is isomorphic: it is imported by server code, client components and tests.

export const ROLES = ["customer", "professional", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  customer: "مشتری",
  professional: "متخصص",
  admin: "مدیر سامانه",
};

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRO_VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;
export type ProVerificationStatus = (typeof PRO_VERIFICATION_STATUSES)[number];
export const PRO_VERIFICATION_LABELS: Record<ProVerificationStatus, string> = {
  pending: "در انتظار بررسی",
  verified: "تأیید شده",
  rejected: "رد شده",
};

export const ORDER_STATUSES = [
  "pending",
  "waiting_offers",
  "offers_received",
  "professional_selected",
  "confirmed",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "در انتظار ثبت",
  waiting_offers: "در انتظار پیشنهاد",
  offers_received: "پیشنهادها رسیده",
  professional_selected: "متخصص انتخاب شد",
  confirmed: "تأیید شده",
  on_the_way: "متخصص در مسیر",
  in_progress: "در حال انجام",
  completed: "انجام شده",
  cancelled: "لغو شده",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";
export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "neutral",
  waiting_offers: "info",
  offers_received: "info",
  professional_selected: "warning",
  confirmed: "brand",
  on_the_way: "brand",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

/** Ordered steps used by the order tracker timeline. */
export const ORDER_TIMELINE: OrderStatus[] = [
  "waiting_offers",
  "offers_received",
  "professional_selected",
  "confirmed",
  "on_the_way",
  "in_progress",
  "completed",
];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "پرداخت نشده",
  pending: "در انتظار پرداخت",
  paid: "پرداخت شده",
  failed: "پرداخت ناموفق",
  refunded: "بازپرداخت شده",
};
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  unpaid: "neutral",
  pending: "warning",
  paid: "success",
  failed: "danger",
  refunded: "info",
};

export const TRANSACTION_TYPES = [
  "customer_payment",
  "commission",
  "pro_earning",
  "refund",
  "wallet_deposit",
  "withdrawal",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  customer_payment: "پرداخت سفارش",
  commission: "کمیسیون پلتفرم",
  pro_earning: "درآمد متخصص",
  refund: "بازپرداخت",
  wallet_deposit: "شارژ کیف پول",
  withdrawal: "درخواست برداشت",
};
/** Transactions that increase a user's wallet balance. */
export const CREDIT_TYPES: TransactionType[] = ["pro_earning", "refund", "wallet_deposit"];
/** Transactions that decrease a user's wallet balance (withdrawals reserve funds). */
export const DEBIT_TYPES: TransactionType[] = ["withdrawal"];

export const NOTIFICATION_TYPES = ["offer", "booking", "reminder", "payment", "promo"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  offer: "پیشنهاد جدید",
  booking: "به‌روزرسانی سفارش",
  reminder: "یادآوری نوبت",
  payment: "پرداخت",
  promo: "تخفیف و اطلاعیه",
};

export const OFFER_STATUSES = ["submitted", "selected", "declined", "rejected"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const DISPUTE_STATUSES = ["none", "open", "resolved"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

// ---------- Business rules ----------

export const COMMISSION_RATE = 0.15; // platform commission on professional price
export const SERVICE_FEE_RATE = 0.03; // customer-side service fee
export const URGENT_FEE_RATE = 0.2; // surcharge for urgent requests
export const MIN_OFFER_PRICE = 50_000;
export const MIN_WITHDRAWAL = 100_000;

/** Statuses from which a customer may cancel an order. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  "pending",
  "waiting_offers",
  "offers_received",
  "professional_selected",
  "confirmed",
];
/** Statuses from which a customer may reschedule an order. */
export const RESCHEDULABLE: OrderStatus[] = ["waiting_offers", "offers_received", "professional_selected", "confirmed"];

/** Manual status transitions. Admin may apply any listed transition. */
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["waiting_offers", "cancelled"],
  waiting_offers: ["offers_received", "cancelled"],
  offers_received: ["professional_selected", "cancelled"],
  professional_selected: ["confirmed", "cancelled"],
  confirmed: ["on_the_way", "in_progress", "cancelled"],
  on_the_way: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

/** Transitions a professional may trigger on their own assigned jobs. */
export const PROFESSIONAL_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["on_the_way", "in_progress"],
  on_the_way: ["in_progress"],
  in_progress: ["completed"],
};

export function canProfessionalTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (PROFESSIONAL_TRANSITIONS[from] ?? []).includes(to);
}

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_TRANSITIONS[from].includes(to);
}

export interface PriceBreakdown {
  subtotal: number;
  urgentFee: number;
  serviceFee: number;
  discount: number;
  total: number;
}

function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

/**
 * Computes the customer-facing price breakdown.
 * Discount never exceeds the gross amount, so the total can never be negative.
 */
export function computeBreakdown(input: { offerPrice: number; urgent: boolean; discount?: number }): PriceBreakdown {
  const subtotal = Math.max(0, Math.round(input.offerPrice));
  const urgentFee = input.urgent ? roundToThousand(subtotal * URGENT_FEE_RATE) : 0;
  const serviceFee = roundToThousand((subtotal + urgentFee) * SERVICE_FEE_RATE);
  const gross = subtotal + urgentFee + serviceFee;
  const discount = Math.min(Math.max(0, Math.round(input.discount ?? 0)), gross);
  return { subtotal, urgentFee, serviceFee, discount, total: gross - discount };
}

/** Splits a professional's offer price into platform commission and net earning. */
export function computeCommission(price: number): { commission: number; net: number } {
  const commission = roundToThousand(price * COMMISSION_RATE);
  return { commission, net: price - commission };
}

// ---------- Catalog / forms ----------

export const FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "number",
  "date",
  "time",
  "file",
  "boolean",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormQuestion {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  min?: number;
  max?: number;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = 1_500_000;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const TONE_CLASSES: Record<string, { bg: string; fg: string; ring: string; solid: string }> = {
  emerald: { bg: "bg-emerald-50", fg: "text-brand", ring: "ring-brand/20", solid: "bg-brand" },
  lime: { bg: "bg-lime-50", fg: "text-lime-800", ring: "ring-lime-400/30", solid: "bg-lime-400" },
  mint: { bg: "bg-mint/40", fg: "text-brand-strong", ring: "ring-mint", solid: "bg-mint" },
  sky: { bg: "bg-sky-50", fg: "text-sky-700", ring: "ring-sky-300/40", solid: "bg-sky-500" },
  amber: { bg: "bg-amber-50", fg: "text-amber-700", ring: "ring-amber-300/40", solid: "bg-amber-500" },
  rose: { bg: "bg-rose-50", fg: "text-rose-700", ring: "ring-rose-300/40", solid: "bg-rose-500" },
  violet: { bg: "bg-violet-50", fg: "text-violet-700", ring: "ring-violet-300/40", solid: "bg-violet-500" },
  slate: { bg: "bg-slate-100", fg: "text-slate-700", ring: "ring-slate-300/40", solid: "bg-slate-600" },
};

export const CITIES = [
  { slug: "tehran", name: "تهران", regions: ["شمال تهران", "مرکز تهران", "شرق تهران", "غرب تهران", "جنوب تهران"] },
  { slug: "karaj", name: "کرج", regions: ["عظیمیه", "گوهردشت", "مرکز کرج", "کمال‌شهر"] },
  { slug: "mashhad", name: "مشهد", regions: ["قاسم‌آباد", "طبرسی", "بلوار توس", "مرکز مشهد"] },
  { slug: "isfahan", name: "اصفهان", regions: ["سپاهان‌شهر", "جلفا", "خیابان چهارباغ", "شاهین‌شهر"] },
  { slug: "shiraz", name: "شیراز", regions: ["زرین‌شهر", "معالی‌آباد", "قصردشت", "مرکز شیراز"] },
  { slug: "tabriz", name: "تبریز", regions: ["ولیعصر", "امیرآباد", "مرکز تبریز"] },
] as const;

export const TIME_SLOTS = [
  { id: "08-10", label: "۸ تا ۱۰ صبح" },
  { id: "10-12", label: "۱۰ تا ۱۲ ظهر" },
  { id: "12-14", label: "۱۲ تا ۱۴" },
  { id: "14-16", label: "۱۴ تا ۱۶" },
  { id: "16-18", label: "۱۶ تا ۱۸" },
  { id: "18-20", label: "۱۸ تا ۲۰ شب" },
] as const;

/** Synonym groups used by search: any term in a group matches the others. */
export const SYNONYMS: string[][] = [
  ["لوله", "آب", "تاسیسات", "نشتی", "لوله‌کشی"],
  ["برق", "الکتریسین", "کلید", "پریز", "روشنایی", "چراغ"],
  ["کولر", "کولر گازی", "اسپلیت", "تهویه", "سرمایش", "گرمایش"],
  ["یخچال", "فریزر", "لوازم خانگی", "ماشین لباسشویی", "لباسشویی", "اجاق", "فر"],
  ["نقاشی", "رنگ", "دیوار", "کاغذدیواری"],
  ["نظافت", "تمیزکاری", "شستشو", "خانه تمیز"],
  ["اسباب کشی", "حمل", "باربری", "جابجایی", "انتقال اثاثیه"],
  ["باغ", "باغبانی", "چمن", "درخت", "هرس", "فضای سبز"],
  ["موش", "سوسک", "حشره", "سم پاشی", "ساس", "آفت"],
  ["کامپیوتر", "لپ تاپ", "لپ‌تاپ", "ویندوز", "شبکه", "وای فای", "اینترنت"],
  ["ماشین", "خودرو", "تعمیرگاه", "سرویس خودرو"],
  ["مبل", "صندلی", "روکش", "نجاری", "کابینت"],
  ["بازسازی", "کفپوش", "آشپزخانه", "تعمیرات ساختمان"],
  ["آرایشگر", "آرایش", "زیبایی", "اصلاح"],
];

export const POPULAR_SEARCHES = ["نظافت منزل", "تعمیر کولر", "نشتی آب", "نقاشی دیوار", "اسباب‌کشی", "تعمیر یخچال"];

export const CATEGORY_TONES = ["emerald", "sky", "amber", "rose", "violet", "lime", "slate", "mint"];

// ---------- Formatting (Persian locale) ----------

const FA_TZ = "Asia/Tehran";

export function faNum(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "۰";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(n);
}

export function formatPrice(value: number): string {
  return `${faNum(Math.round(value))} تومان`;
}

export function formatCompactPrice(value: number): string {
  if (value >= 1_000_000_000) return `${faNum(Math.round(value / 100_000_000) / 10)} میلیارد تومان`;
  if (value >= 1_000_000) return `${faNum(Math.round(value / 100_000) / 10)} میلیون تومان`;
  return formatPrice(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: FA_TZ,
  }).format(date);
}

export function formatShortDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: FA_TZ,
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const day = formatDate(date);
  const time = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: FA_TZ }).format(date);
  return `${day} ساعت ${time}`;
}

export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${faNum(minutes)} دقیقه`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(h)} ساعت`;
}

/** Converts Persian and Arabic digits to ASCII digits. */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Normalises Persian text for search: unifies Arabic letters, removes ZWNJ and extra spaces. */
export function normalizeFa(input: string): string {
  return toEnglishDigits(input)
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function slugifyFa(input: string): string {
  return normalizeFa(input)
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "");
}

export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 4)}***${phone.slice(-3)}` : phone;
}

export const TIME_SLOT_IDS = TIME_SLOTS.map((s) => s.id);
