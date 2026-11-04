import { z } from "zod";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MIN_OFFER_PRICE,
  MIN_WITHDRAWAL,
  ORDER_STATUSES,
  PRO_VERIFICATION_STATUSES,
  ROLES,
  TIME_SLOT_IDS,
  USER_STATUSES,
  normalizeFa,
  toEnglishDigits,
  type Attachment,
  type FormQuestion,
} from "./domain";

/** Normalises user-entered phone numbers (Persian digits, spaces) and validates Iranian mobile format. */
export const phoneSchema = z
  .string()
  .transform((v) => toEnglishDigits(v).replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^09\d{9}$/, "شماره موبایل معتبر نیست (مثال: 09123456789)"));

export const optionalEmailSchema = z
  .string()
  .trim()
  .max(120)
  .refine((v) => v === "" || z.email().safeParse(v).success, "ایمیل معتبر نیست")
  .transform((v) => (v === "" ? null : v.toLowerCase()));

export const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
  .max(72, "رمز عبور طولانی است")
  .regex(/[A-Za-z]/, "رمز عبور باید شامل حرف انگلیسی باشد")
  .regex(/[0-9]/, "رمز عبور باید شامل عدد باشد");

export const fullNameSchema = z.string().trim().min(3, "نام و نام خانوادگی را کامل وارد کنید").max(60);

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی را وارد کنید"),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, { message: "رمز عبور جدید باید با رمز فعلی متفاوت باشد", path: ["newPassword"] });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "شماره موبایل یا ایمیل را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema.optional().default(null),
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: "پذیرش قوانین الزامی است" }),
});

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const verifyCodeSchema = z.object({
  code: z.string().transform((v) => toEnglishDigits(v).trim()).pipe(z.string().regex(/^\d{6}$/, "کد ۶ رقمی را وارد کنید")),
});

export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  code: verifyCodeSchema.shape.code,
  password: passwordSchema,
});

export const profileUpdateSchema = z.object({
  fullName: fullNameSchema,
  email: optionalEmailSchema.optional().default(null),
  avatarUrl: z
    .string()
    .max(400_000, "تصویر پروفایل بیش از حد بزرگ است")
    .refine((v) => v === "" || v.startsWith("data:image/"), "فرمت تصویر نامعتبر است")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

export const addressSchema = z.object({
  title: z.string().trim().min(2, "عنوان نشانی را وارد کنید").max(40),
  city: z.string().min(1, "شهر را انتخاب کنید"),
  region: z.string().min(1, "منطقه را انتخاب کنید"),
  addressLine: z.string().trim().min(5, "نشانی کامل را وارد کنید").max(300),
  details: z.string().trim().max(200).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

export const attachmentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(ALLOWED_IMAGE_TYPES, { message: "فقط تصویر JPG، PNG یا WebP مجاز است" }),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES, "حجم هر تصویر حداکثر ۱٫۵ مگابایت است"),
  dataUrl: z
    .string()
    .refine((v) => v.startsWith("data:image/"), "فایل نامعتبر است")
    .refine((v) => v.length <= MAX_ATTACHMENT_BYTES * 1.4, "حجم فایل بیش از حد مجاز است"),
}) satisfies z.ZodType<Attachment>;

export const bookingSchema = z
  .object({
    serviceSlug: z.string().min(1),
    answers: z.record(z.string(), z.unknown()).default({}),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS, `حداکثر ${MAX_ATTACHMENTS} تصویر مجاز است`).default([]),
    addressId: z.number().int().positive().nullable().optional(),
    address: addressSchema.nullable().optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ نامعتبر است"),
    timeSlot: z.enum(TIME_SLOT_IDS, { message: "بازه زمانی را انتخاب کنید" }),
    urgent: z.boolean().default(false),
    flexible: z.boolean().default(false),
    notes: z.string().trim().max(500).default(""),
    couponCode: z.string().trim().max(30).optional().nullable(),
    saveAddress: z.boolean().default(false),
  })
  .refine((v) => v.addressId != null || v.address != null, {
    message: "نشانی را انتخاب یا وارد کنید",
    path: ["address"],
  });

export const rescheduleSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ نامعتبر است"),
  timeSlot: z.enum(TIME_SLOT_IDS, { message: "بازه زمانی را انتخاب کنید" }),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(3, "دلیل لغو را وارد کنید").max(300),
});

export const paymentSchema = z.object({
  outcome: z.enum(["success", "failed"]),
});

export const offerSchema = z.object({
  orderId: z.number().int().positive(),
  price: z.number().int().min(MIN_OFFER_PRICE, `حداقل مبلغ پیشنهاد ${MIN_OFFER_PRICE.toLocaleString("en-US")} تومان است`).max(500_000_000),
  arrivalMinutes: z.number().int().min(15, "حداقل ۱۵ دقیقه").max(720),
  description: z.string().trim().min(10, "توضیحات پیشنهاد را کامل‌تر کنید").max(600),
});

export const selectOfferSchema = z.object({ offerId: z.number().int().positive() });

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "امتیاز را انتخاب کنید").max(5),
  comment: z.string().trim().min(10, "نظر خود را حداقل در ۱۰ کاراکتر بنویسید").max(1000),
});

export const replySchema = z.object({ reply: z.string().trim().min(2).max(800) });

export const disputeSchema = z.object({ note: z.string().trim().min(10, "شرح اختلاف را کامل‌تر بنویسید").max(800) });

export const messageSchema = z
  .object({
    body: z.string().trim().max(2000).default(""),
    attachment: attachmentSchema.nullable().optional(),
  })
  .refine((v) => v.body.length > 0 || v.attachment != null, { message: "پیام خالی است" });

export const depositSchema = z.object({
  amount: z.number().int().min(50_000, "حداقل مبلغ شارژ ۵۰٬۰۰۰ تومان است").max(50_000_000),
});

export const withdrawalSchema = z.object({
  amount: z.number().int().min(MIN_WITHDRAWAL, `حداقل مبلغ برداشت ${MIN_WITHDRAWAL.toLocaleString("en-US")} تومان است`),
  iban: z
    .string()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^IR\d{24}$/, "شماره شبا معتبر نیست (IR و ۲۴ رقم)")),
});

export const couponSchema = z.object({
  code: z.string().trim().min(3).max(30),
  amount: z.number().int().min(0),
});

export const proRegisterSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema.optional().default(null),
  password: passwordSchema,
  headline: z.string().trim().min(5, "عنوان تخصصی را وارد کنید").max(100),
  bio: z.string().trim().min(30, "معرفی کوتاه (حداقل ۳۰ کاراکتر) را بنویسید").max(1000),
  categoryIds: z.array(z.number().int().positive()).min(1, "حداقل یک دسته‌بندی انتخاب کنید"),
  skills: z.array(z.string().trim().min(1).max(40)).min(1, "حداقل یک مهارت وارد کنید").max(20),
  experienceYears: z.number().int().min(0).max(60),
  serviceAreas: z.array(z.string()).min(1, "حداقل یک شهر را انتخاب کنید"),
  workingDays: z.array(z.string()).min(1, "حداقل یک روز کاری انتخاب کنید"),
  workingFrom: z.string().regex(/^\d{2}:\d{2}$/),
  workingTo: z.string().regex(/^\d{2}:\d{2}$/),
  minPrice: z.number().int().min(0).max(100_000_000),
  hourlyRate: z.number().int().min(0).max(100_000_000),
  documents: z
    .array(
      z.object({
        type: z.string().min(2),
        name: z.string().min(1).max(120),
        dataUrl: z
          .string()
          .max(2_100_000, "حجم مدرک بیش از حد مجاز است")
          .refine((v) => v.startsWith("data:image/"), "فقط تصویر مدرک مجاز است")
          .optional(),
      }),
    )
    .min(2, "حداقل دو مدرک (کارت ملی و مدرک تخصصی) بارگذاری کنید"),
  acceptTerms: z.literal(true, { message: "پذیرش قوانین الزامی است" }),
});

export const proProfileSchema = z.object({
  headline: z.string().trim().min(5).max(100),
  bio: z.string().trim().min(30).max(1000),
  experienceYears: z.number().int().min(0).max(60),
  skills: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  serviceAreas: z.array(z.string()).min(1),
  workingDays: z.array(z.string()),
  workingFrom: z.string().regex(/^\d{2}:\d{2}$/),
  workingTo: z.string().regex(/^\d{2}:\d{2}$/),
  minPrice: z.number().int().min(0).max(100_000_000),
  hourlyRate: z.number().int().min(0).max(100_000_000),
  visitFee: z.number().int().min(0).max(10_000_000),
  isAvailable: z.boolean(),
  acceptsUrgent: z.boolean().optional(),
  portfolio: z.array(z.object({ title: z.string().trim().min(2).max(80), description: z.string().trim().max(300) })).max(12),
});

export const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional().default(""),
});

export const adminUserUpdateSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: optionalEmailSchema.optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const professionalDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(500).default(""),
});

export const categoryInputSchema = z.object({
  id: z.number().int().positive().optional(),
  parentId: z.number().int().positive().nullable().optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N}-]+$/u, "نامک فقط حروف، عدد و خط تیره"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(600).default(""),
  iconKey: z.string().default("wrench"),
  tone: z.string().default("emerald"),
  seoTitle: z.string().trim().max(120).default(""),
  seoDescription: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const questionSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{1,40}$/, "کلید سؤال نامعتبر است"),
  label: z.string().trim().min(2).max(160),
  type: z.enum(["text", "textarea", "select", "radio", "checkbox", "number", "date", "time", "file", "boolean"]),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1)).optional(),
  placeholder: z.string().max(120).optional(),
  helpText: z.string().max(200).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
}) satisfies z.ZodType<FormQuestion>;

export const serviceInputSchema = z.object({
  id: z.number().int().positive().optional(),
  categoryId: z.number().int().positive(),
  slug: z.string().trim().min(2).max(100).regex(/^[\p{L}\p{N}-]+$/u, "نامک فقط حروف، عدد و خط تیره"),
  title: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().max(240).default(""),
  description: z.string().trim().max(3000).default(""),
  benefits: z.array(z.string().trim().min(1)).default([]),
  steps: z.array(z.string().trim().min(1)).default([]),
  requirements: z.array(z.string().trim().min(1)).default([]),
  priceFactors: z.array(z.string().trim().min(1)).default([]),
  keywords: z.array(z.string().trim().min(1)).default([]),
  basePrice: z.number().int().min(0).max(500_000_000),
  durationMinutes: z.number().int().min(15).max(1440),
  formFamily: z.string().default("general"),
  questions: z.array(questionSchema).default([]),
  faqs: z.array(z.object({ q: z.string().trim().min(3), a: z.string().trim().min(3) })).default([]),
  seoTitle: z.string().trim().max(120).default(""),
  seoDescription: z.string().trim().max(300).default(""),
  tone: z.string().default("emerald"),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const contentKinds = ["banners", "faqs", "blog", "pages", "coupons"] as const;
export type ContentKind = (typeof contentKinds)[number];

export const contentInputSchemas = {
  banners: z.object({
    id: z.number().int().positive().optional(),
    title: z.string().trim().min(2).max(120),
    subtitle: z.string().trim().max(300).default(""),
    ctaLabel: z.string().trim().min(1).max(40).default("مشاهده"),
    ctaHref: z.string().trim().min(1).max(200).default("/categories"),
    tone: z.string().default("emerald"),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  }),
  faqs: z.object({
    id: z.number().int().positive().optional(),
    question: z.string().trim().min(5).max(300),
    answer: z.string().trim().min(5).max(2000),
    scope: z.enum(["home", "general"]).default("home"),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
  blog: z.object({
    id: z.number().int().positive().optional(),
    slug: z.string().trim().min(2).max(120).regex(/^[\p{L}\p{N}-]+$/u, "نامک نامعتبر است"),
    title: z.string().trim().min(3).max(160),
    excerpt: z.string().trim().max(400).default(""),
    body: z.string().trim().max(10000).default(""),
    isPublished: z.boolean().default(false),
  }),
  pages: z.object({
    id: z.number().int().positive().optional(),
    slug: z.string().trim().min(2).max(120).regex(/^[\p{L}\p{N}-]+$/u, "نامک نامعتبر است"),
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().max(20000).default(""),
    isPublished: z.boolean().default(true),
  }),
  coupons: z.object({
    id: z.number().int().positive().optional(),
    code: z.string().trim().toUpperCase().min(3).max(30).regex(/^[A-Z0-9_-]+$/, "کد تخفیف فقط حروف لاتین و عدد"),
    percent: z.number().int().min(1).max(90),
    maxAmount: z.number().int().min(1000),
    minTotal: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  }),
} as const;

/** Result of dynamic form validation: map of question key to Persian error message. */
export type AnswerErrors = Record<string, string>;

/**
 * Validates the answers for a service-specific dynamic form.
 * Each question type has its own rule set; unknown answers are dropped.
 */
export function validateAnswers(questions: FormQuestion[], answers: Record<string, unknown>): {
  values: Record<string, unknown>;
  errors: AnswerErrors;
} {
  const errors: AnswerErrors = {};
  const values: Record<string, unknown> = {};

  for (const q of questions) {
    const raw = answers[q.key];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim() === "") ||
      (Array.isArray(raw) && raw.length === 0);

    if (q.type === "file") {
      // Files are sent through the attachments field, not answers.
      continue;
    }

    if (isEmpty) {
      if (q.required) errors[q.key] = `تکمیل «${q.label}» الزامی است`;
      continue;
    }

    switch (q.type) {
      case "number": {
        const n = Number(toEnglishDigits(String(raw)));
        if (!Number.isFinite(n)) {
          errors[q.key] = `«${q.label}» باید عدد باشد`;
          break;
        }
        if (q.min != null && n < q.min) errors[q.key] = `«${q.label}» نباید کمتر از ${q.min} باشد`;
        else if (q.max != null && n > q.max) errors[q.key] = `«${q.label}» نباید بیشتر از ${q.max} باشد`;
        else values[q.key] = n;
        break;
      }
      case "select":
      case "radio": {
        const v = String(raw);
        if (q.options && !q.options.includes(v)) errors[q.key] = "گزینه انتخاب‌شده معتبر نیست";
        else values[q.key] = v;
        break;
      }
      case "checkbox": {
        const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const allowed = arr.filter((v) => !q.options || q.options.includes(v));
        if (allowed.length !== arr.length) errors[q.key] = "گزینه‌های انتخاب‌شده معتبر نیستند";
        else values[q.key] = allowed;
        break;
      }
      case "boolean":
        values[q.key] = raw === true || raw === "true";
        break;
      case "date": {
        const v = String(raw);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[q.key] = "تاریخ نامعتبر است";
        else values[q.key] = v;
        break;
      }
      case "time": {
        const v = toEnglishDigits(String(raw));
        if (!/^\d{2}:\d{2}$/.test(v)) errors[q.key] = "ساعت نامعتبر است";
        else values[q.key] = v;
        break;
      }
      default: {
        const v = normalizeFa(String(raw));
        if (v.length > 1000) errors[q.key] = "متن بیش از حد طولانی است";
        else values[q.key] = String(raw).trim();
      }
    }
  }
  return { values, errors };
}

export const proStatusFilterSchema = z.enum(PRO_VERIFICATION_STATUSES);
