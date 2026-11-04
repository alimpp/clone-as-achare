import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { ProDocument, StatusHistoryEntry } from "@/db/schema";
import { hashPassword } from "./auth";
import { CITIES, computeBreakdown, computeCommission, TIME_SLOTS, type FaqItem, type FormQuestion, type OrderStatus, type PaymentStatus, type ProVerificationStatus } from "./domain";

/*
 * Deterministic development dataset.
 *
 * - Stable IDs: users use uuidOf(n); categories, services and orders get sequential ids.
 * - Reproducible: a seeded PRNG drives every random choice, so two resets produce identical data.
 * - Consistent: orders, offers, payments, transactions, reviews and ratings are derived from one
 *   in-memory plan, so statuses, totals, wallet balances and rating summaries always agree.
 * - Safe: seeding on first boot runs only when the users table is empty. A full reset is available
 *   through resetAndSeedDevelopmentData() and is refused in production unless ALLOW_DEV_RESET=true.
 *
 * Demo accounts (all sample passwords are for local sandbox use only):
 *   admin      09120000000  Admin1234
 *   customer   09120000001  Demo1234
 *   professional 09120000002 Demo1234 (verified)
 *   pending professional 09120000099 Demo1234
 */

const DEMO_PASSWORD = "Demo1234";
const ADMIN_PASSWORD = "Admin1234";
const HOUR = 3_600_000;
const DAY = 86_400_000;
const TEHRAN_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" });
const TEHRAN_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", hourCycle: "h23" });

const TABLES = [
  "notifications", "messages", "conversations", "transactions", "payments", "reviews", "offers", "orders", "favorites", "addresses",
  "professional_profiles", "sessions", "verification_codes", "newsletter_subscribers", "audit_logs", "banners", "faqs", "blog_posts",
  "static_pages", "coupons", "services", "categories", "users",
];

// ---------- Catalog ----------

/** [slug, name, icon, tone, description] */
const PARENTS: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ["home-cleaning", "نظافت منزل", "sparkles", "sky", "نظافت عمیق و دوره‌ای منزل، بعد از ساخت و شستشوی تخصصی با نیروهای آموزش‌دیده."],
  ["plumbing", "لوله‌کشی و آب", "droplets", "sky", "رفع نشتی، گرفتگی، تعمیر آبگرمکن و نصب شیرآلات و سرویس بهداشتی."],
  ["electrical", "برق و روشنایی", "zap", "amber", "عیب‌یابی برق ساختمان، نصب پریز و کلید، لوستر و ارتقای تابلو برق با رعایت ایمنی."],
  ["appliance-repair", "تعمیر لوازم خانگی", "plug", "violet", "تعمیر لباسشویی، یخچال، فریزر و اجاق گاز در محل شما با قطعات معتبر."],
  ["painting-renovation", "نقاشی و بازسازی", "paintbrush", "rose", "نقاشی ساختمان، کاغذدیواری، بازسازی آشپزخانه و نصب کفپوش."],
  ["moving", "حمل و اسباب‌کشی", "truck", "lime", "اسباب‌کشی درون‌شهری و بین‌شهری، بسته‌بندی و انتقال دفتر کار."],
  ["air-conditioning", "تهویه و سرمایش", "snowflake", "sky", "سرویس، شارژ و نصب کولر گازی و اسپلیت با گارانتی کار."],
  ["garden-pest", "باغبانی و سم‌پاشی", "leaf", "mint", "سم‌پاشی ایمن منزل، مبارزه با ساس و نگهداری فضای سبز."],
  ["furniture-carpentry", "مبلمان و نجاری", "sofa", "amber", "تعمیر و روکش مبل، ترمیم صندلی و نصب کابینت و کمد."],
  ["computer-services", "خدمات کامپیوتر", "laptop", "violet", "تعمیر لپ‌تاپ در محل، بازیابی اطلاعات و راه‌اندازی شبکه خانگی."],
  ["car-services", "خدمات خودرو", "car", "slate", "سرویس سیار خودرو، امداد باتری و استارت در محل."],
  ["beauty-at-home", "زیبایی در منزل", "scissors", "rose", "آرایشگری، آرایش عروس و مراقبت پوست با متخصصان در منزل شما."],
  ["other-home-services", "سایر خدمات منزل", "hammer", "emerald", "تعمیرات جزئی منزل، مونتاژ و نصب وسایل."],
  ["locksmith", "قفل‌سازی و امنیت درب", "key", "slate", "تعویض قفل، بازکردن قفل بدون آسیب و ساخت کلید یدکی."],
  ["photography", "عکاسی", "camera", "violet", "عکاسی مراسم، پرتره خانوادگی و عکاسی محصول."],
  ["event-services", "خدمات مراسم", "party", "amber", "دکور جشن، چیدمان مجلس و پرسنل سرویس‌دهی مراسم."],
  ["education", "آموزش خصوصی", "graduation", "sky", "تدریس خصوصی در منزل، کنکور و آموزش زبان."],
  ["smart-security", "امنیت و هوشمندسازی", "shield", "slate", "نصب دوربین مداربسته، زنگ تصویری و هوشمندسازی منزل."],
  ["interior-design", "طراحی داخلی", "ruler", "mint", "مشاوره دکوراسیون، انتخاب رنگ و نصب پرده و کرکره سفارشی."],
  ["pet-care", "مراقبت از حیوانات خانگی", "heart", "lime", "حمام و آرایش حیوان خانگی و نگهداری در منزل."],
];

/** [slug, parentSlug, name, questionFamily] */
const LEAVES: ReadonlyArray<readonly [string, string, string, string]> = [
  ["house-cleaning", "home-cleaning", "نظافت منزل و آپارتمان", "cleaning"],
  ["post-build-cleaning", "home-cleaning", "نظافت بعد از ساخت و بازسازی", "cleaning"],
  ["leak-repair", "plumbing", "نشتی و لوله‌کشی", "plumbing"],
  ["water-heater", "plumbing", "آبگرمکن و شیرآلات", "plumbing"],
  ["electrical-repair", "electrical", "برق‌کاری ساختمان", "electrical"],
  ["lighting-install", "electrical", "نصب روشنایی و پریز", "electrical"],
  ["washing-machine", "appliance-repair", "لباسشویی و ظرفشویی", "appliance"],
  ["fridge-freezer", "appliance-repair", "یخچال و فریزر", "appliance"],
  ["cooking-appliance", "appliance-repair", "اجاق گاز و فر", "appliance"],
  ["painting", "painting-renovation", "نقاشی ساختمان", "painting"],
  ["renovation", "painting-renovation", "بازسازی و کفپوش", "renovation"],
  ["urban-moving", "moving", "اسباب‌کشی درون‌شهری", "moving"],
  ["packing-service", "moving", "بسته‌بندی وسایل", "moving"],
  ["ac-service", "air-conditioning", "سرویس کولر گازی", "ac"],
  ["ac-install", "air-conditioning", "نصب کولر و اسپلیت", "ac"],
  ["pest-control", "garden-pest", "سم‌پاشی و مبارزه با آفات", "pest"],
  ["gardening", "garden-pest", "باغبانی و فضای سبز", "garden"],
  ["furniture-repair", "furniture-carpentry", "تعمیر مبلمان", "furniture"],
  ["carpentry", "furniture-carpentry", "نجاری و کابینت", "furniture"],
  ["laptop-repair", "computer-services", "تعمیر لپ‌تاپ", "computer"],
  ["network-setup", "computer-services", "شبکه و وای‌فای", "computer"],
  ["car-maintenance", "car-services", "سرویس و تعمیرات خودرو", "car"],
  ["car-emergency", "car-services", "امداد سیار خودرو", "car"],
  ["hair-makeup", "beauty-at-home", "آرایش و مو", "beauty"],
  ["skincare-home", "beauty-at-home", "مراقبت پوست در منزل", "beauty"],
  ["handyman", "other-home-services", "تعمیرات جزئی", "general"],
  ["assembly", "other-home-services", "مونتاژ و نصب", "general"],
  ["door-locks", "locksmith", "تعویض و تعمیر قفل", "locksmith"],
  ["safe-opening", "locksmith", "بازکردن قفل بدون آسیب", "locksmith"],
  ["event-photo", "photography", "عکاسی مراسم", "photo"],
  ["portrait-studio", "photography", "عکاسی پرتره در منزل", "photo"],
  ["party-setup", "event-services", "دکور و برگزاری جشن", "event"],
  ["catering-staff", "event-services", "پرسنل مراسم", "event"],
  ["home-tutoring", "education", "تدریس خصوصی در منزل", "education"],
  ["language-coaching", "education", "تدریس زبان", "education"],
  ["cctv-install", "smart-security", "نصب دوربین مداربسته", "security"],
  ["smart-home", "smart-security", "هوشمندسازی منزل", "security"],
  ["interior-consult", "interior-design", "مشاوره دکوراسیون", "interior"],
  ["curtain-blinds", "interior-design", "نصب پرده و کرکره", "interior"],
  ["pet-grooming", "pet-care", "حمام و آرایش حیوان خانگی", "pet"],
  ["pet-sitting", "pet-care", "نگهداری حیوان در منزل", "pet"],
];

/** [leafSlug, serviceSlug, title, basePrice (تومان), durationMinutes, popular 0|1] */
const SERVICE_ROWS: ReadonlyArray<readonly [string, string, string, number, number, number]> = [
  ["house-cleaning", "deep-home-cleaning", "نظافت عمیق منزل", 450000, 180, 1],
  ["house-cleaning", "kitchen-bath-cleaning", "نظافت آشپزخانه و سرویس بهداشتی", 280000, 120, 0],
  ["post-build-cleaning", "post-construction-cleaning", "نظافت پس از بازسازی", 900000, 240, 0],
  ["post-build-cleaning", "window-facade-cleaning", "شستشوی شیشه و نمای ساختمان", 350000, 150, 0],
  ["leak-repair", "leak-fix", "رفع نشتی آب", 250000, 90, 1],
  ["leak-repair", "pipe-blockage-clearing", "بازکردن گرفتگی لوله", 220000, 60, 0],
  ["water-heater", "water-heater-repair", "تعمیر آبگرمکن", 300000, 90, 0],
  ["water-heater", "faucet-and-toilet-install", "نصب شیرآلات و توالت", 280000, 120, 0],
  ["electrical-repair", "electrical-troubleshooting", "عیب‌یابی و تعمیر برق", 280000, 120, 1],
  ["electrical-repair", "electrical-panel-upgrade", "ارتقای تابلو برق", 1200000, 300, 0],
  ["lighting-install", "socket-switch-install", "نصب پریز و کلید", 220000, 60, 0],
  ["lighting-install", "chandelier-install", "نصب لوستر و چراغ", 200000, 60, 0],
  ["washing-machine", "washing-machine-repair", "تعمیر ماشین لباسشویی", 350000, 90, 1],
  ["washing-machine", "dishwasher-repair", "تعمیر ماشین ظرفشویی", 340000, 90, 0],
  ["fridge-freezer", "fridge-freezer-repair", "تعمیر یخچال و فریزر", 380000, 90, 1],
  ["fridge-freezer", "fridge-gas-recharge", "شارژ گاز یخچال", 320000, 60, 0],
  ["cooking-appliance", "oven-repair", "تعمیر اجاق گاز و فر", 300000, 75, 0],
  ["cooking-appliance", "cooktop-installation", "نصب اجاق گاز توکار", 260000, 90, 0],
  ["painting", "wall-painting", "نقاشی دیوار و سقف", 800000, 240, 1],
  ["painting", "wallpaper-install", "نصب کاغذدیواری", 650000, 180, 0],
  ["renovation", "kitchen-renovation", "بازسازی آشپزخانه", 3500000, 1440, 0],
  ["renovation", "floor-covering-install", "نصب کفپوش", 900000, 240, 0],
  ["urban-moving", "home-moving", "اسباب‌کشی درون شهری", 1500000, 240, 1],
  ["urban-moving", "office-moving", "انتقال دفتر کار", 2200000, 300, 0],
  ["packing-service", "packing-service", "بسته‌بندی و جابجایی", 600000, 180, 0],
  ["packing-service", "fragile-packing", "بسته‌بندی لوازم شکستنی", 450000, 120, 0],
  ["ac-service", "ac-service-recharge", "سرویس و شارژ کولر", 350000, 60, 1],
  ["ac-service", "central-ac-maintenance", "سرویس سیستم مرکزی", 900000, 180, 0],
  ["ac-install", "ac-installation", "نصب کولر گازی و اسپلیت", 600000, 120, 0],
  ["ac-install", "ac-relocation", "جابجایی کولر گازی", 450000, 120, 0],
  ["pest-control", "pest-control-home", "سم‌پاشی منزل", 400000, 90, 1],
  ["pest-control", "bedbug-treatment", "مبارزه با ساس", 650000, 150, 0],
  ["gardening", "lawn-and-tree-care", "چمن‌زنی و هرس درخت", 300000, 120, 0],
  ["gardening", "irrigation-setup", "نصب آبیاری قطره‌ای", 1100000, 240, 0],
  ["furniture-repair", "sofa-repair-upholstery", "تعمیر و روکش مبل", 400000, 120, 0],
  ["furniture-repair", "chair-restoration", "ترمیم صندلی و میز چوبی", 250000, 90, 0],
  ["carpentry", "cabinet-installation", "نصب کابینت و کمد", 500000, 180, 0],
  ["carpentry", "door-frame-repair", "تعمیر درب و چهارچوب", 350000, 120, 0],
  ["laptop-repair", "laptop-repair-home", "تعمیر لپ‌تاپ در منزل", 250000, 60, 1],
  ["laptop-repair", "data-recovery-home", "بازیابی اطلاعات در محل", 500000, 120, 0],
  ["network-setup", "wifi-network-setup", "راه‌اندازی شبکه و وای‌فای", 300000, 90, 0],
  ["network-setup", "printer-setup", "نصب و تنظیم پرینتر", 150000, 45, 0],
  ["car-maintenance", "car-mobile-service", "سرویس سیار خودرو", 350000, 90, 0],
  ["car-maintenance", "car-detailing-home", "شستشو و کارواش سیار", 250000, 90, 0],
  ["car-emergency", "car-battery-jumpstart", "باتری و استارت سیار", 200000, 60, 0],
  ["car-emergency", "car-towing-coordination", "هماهنگی امداد و یدک‌کش", 300000, 60, 0],
  ["hair-makeup", "home-beauty-service", "آرایشگری در منزل", 500000, 120, 1],
  ["hair-makeup", "bridal-hair-makeup", "آرایش عروس", 2500000, 240, 0],
  ["skincare-home", "facial-at-home", "فیشیال در منزل", 400000, 90, 0],
  ["skincare-home", "waxing-home", "اپیلاسیون در منزل", 300000, 60, 0],
  ["handyman", "handyman-minor-repairs", "تعمیرات جزئی منزل", 200000, 60, 1],
  ["handyman", "wall-mount-install", "نصب تلویزیون و تابلو", 180000, 60, 0],
  ["assembly", "furniture-assembly", "مونتاژ وسایل منزل", 180000, 90, 0],
  ["assembly", "bed-assembly", "مونتاژ تخت و کمد", 220000, 120, 0],
  ["door-locks", "lock-replacement", "تعویض قفل درب", 280000, 60, 1],
  ["door-locks", "smart-lock-install", "نصب قفل هوشمند", 450000, 90, 0],
  ["safe-opening", "emergency-lock-opening", "بازکردن قفل بدون آسیب", 300000, 45, 0],
  ["safe-opening", "key-duplication", "ساخت کلید یدکی", 80000, 20, 0],
  ["event-photo", "event-photography", "عکاسی مراسم و جشن", 2000000, 300, 1],
  ["event-photo", "engagement-photo", "عکاسی نامزدی", 1200000, 120, 0],
  ["portrait-studio", "family-portrait-home", "عکاسی خانوادگی در منزل", 900000, 90, 0],
  ["portrait-studio", "product-photo", "عکاسی محصول", 600000, 120, 0],
  ["party-setup", "birthday-decor", "دکور تولد در منزل", 1200000, 180, 0],
  ["party-setup", "event-hall-setup", "چیدمان مجلس و تالار", 2500000, 240, 0],
  ["catering-staff", "waiter-service", "پرسنل سرویس‌دهی مراسم", 1500000, 300, 0],
  ["catering-staff", "kitchen-helper", "کمک آشپز مراسم", 900000, 240, 0],
  ["home-tutoring", "math-tutoring", "تدریس ریاضی و فیزیک", 250000, 60, 1],
  ["home-tutoring", "university-entrance-prep", "مشاوره و تدریس کنکور", 400000, 90, 0],
  ["language-coaching", "english-conversation", "تدریس مکالمه انگلیسی", 220000, 60, 0],
  ["language-coaching", "german-tutoring", "تدریس زبان آلمانی", 260000, 60, 0],
  ["cctv-install", "cctv-camera-install", "نصب دوربین مداربسته", 900000, 180, 1],
  ["cctv-install", "doorbell-camera", "نصب زنگ تصویری", 350000, 60, 0],
  ["smart-home", "smart-home-setup", "هوشمندسازی روشنایی و پرده", 1500000, 240, 0],
  ["smart-home", "smart-thermostat", "نصب ترموستات هوشمند", 400000, 60, 0],
  ["interior-consult", "interior-consultation", "مشاوره دکوراسیون منزل", 500000, 90, 1],
  ["interior-consult", "color-plan-consult", "مشاوره رنگ و متریال", 350000, 60, 0],
  ["curtain-blinds", "curtain-installation", "نصب پرده و ریل", 300000, 60, 0],
  ["curtain-blinds", "blinds-installation", "نصب کرکره و پرده سفارشی", 400000, 90, 0],
  ["pet-grooming", "pet-bath-grooming", "حمام و آرایش سگ و گربه", 350000, 90, 1],
  ["pet-grooming", "pet-nail-care", "نظافت و کوتاهی ناخن حیوان", 150000, 30, 0],
  ["pet-sitting", "pet-home-sitting", "نگهداری حیوان خانگی در منزل", 400000, 240, 0],
  ["pet-sitting", "pet-walking", "گردش روزانه با سگ", 200000, 60, 0],
];

type Q = FormQuestion;
const COMMON_TAIL: Q[] = [
  { key: "urgency", label: "فوریت درخواست", type: "radio", required: true, options: ["عادی (طی ۲ تا ۳ روز آینده)", "امروز یا فردا", "فوری (هرچه سریع‌تر)"] },
  { key: "photos", label: "تصاویر مشکل (اختیاری)", type: "file", helpText: "حداکثر ۴ تصویر JPG، PNG یا WebP؛ هر تصویر تا ۱٫۵ مگابایت" },
];

const FAMILY_QUESTIONS: Record<string, Q[]> = {
  cleaning: [
    { key: "propertyType", label: "نوع ملک", type: "select", required: true, options: ["آپارتمان", "ویلا", "واحد تجاری", "دفتر کار"] },
    { key: "area", label: "متراژ تقریبی (متر مربع)", type: "number", required: true, min: 20, max: 1000, placeholder: "مثلاً ۸۰" },
    { key: "rooms", label: "تعداد اتاق", type: "number", required: true, min: 1, max: 15 },
    { key: "hasPets", label: "حیوان خانگی دارید؟", type: "boolean" },
    { key: "problemDescription", label: "توضیحات تکمیلی", type: "textarea", placeholder: "لکه‌های سخت یا محدودیت دسترسی" },
  ],
  plumbing: [
    { key: "problemType", label: "نوع مشکل", type: "select", required: true, options: ["نشتی لوله", "گرفتگی", "افت فشار آب", "شیر خراب", "سایر"] },
    { key: "location", label: "محل مشکل", type: "radio", required: true, options: ["آشپزخانه", "حمام", "سرویس بهداشتی", "فضای باز", "سایر"] },
    { key: "waterStopped", label: "آیا آب قطع شده است؟", type: "radio", options: ["بله، آب قطع است", "خیر، فقط نشتی دارد"] },
    { key: "problemDescription", label: "شرح مشکل", type: "textarea", required: true, placeholder: "مثلاً زیر سینک نشتی دارد" },
  ],
  electrical: [
    { key: "problemType", label: "نوع مشکل برق", type: "select", required: true, options: ["قطعی برق", "جرقه یا اتصالی", "کلید یا پریز خراب", "روشنایی ضعیف", "سایر"] },
    { key: "hasPower", label: "وضعیت برق واحد", type: "radio", required: true, options: ["برق دارد", "بدون برق است"] },
    { key: "panelAge", label: "قدمت ساختمان (سال)", type: "number", min: 0, max: 100 },
    { key: "problemDescription", label: "شرح مشکل", type: "textarea", required: true },
  ],
  appliance: [
    { key: "brand", label: "برند دستگاه", type: "text", required: true, placeholder: "مثلاً ال‌جی، سامسونگ" },
    { key: "warranty", label: "وضعیت گارانتی", type: "radio", options: ["دارای گارانتی", "بدون گارانتی"] },
    { key: "problemDescription", label: "شرح خرابی", type: "textarea", required: true },
  ],
  painting: [
    { key: "area", label: "متراژ تقریبی (متر مربع)", type: "number", required: true, min: 5, max: 1000 },
    { key: "rooms", label: "تعداد اتاق", type: "number", required: true, min: 1, max: 20 },
    { key: "paintType", label: "نوع کار", type: "select", required: true, options: ["نقاشی ساده", "نقاشی ترمیمی", "طرح و اکو"] },
    { key: "furnitureMoved", label: "جابجایی مبلمان", type: "radio", options: ["با شما", "خالی هستند"] },
  ],
  renovation: [
    { key: "area", label: "متراژ تقریبی (متر مربع)", type: "number", required: true, min: 5, max: 1000 },
    { key: "problemDescription", label: "شرح پروژه", type: "textarea", required: true },
  ],
  moving: [
    { key: "fromFloor", label: "طبقه مبدأ", type: "number", required: true, min: 0, max: 40 },
    { key: "toFloor", label: "طبقه مقصد", type: "number", required: true, min: 0, max: 40 },
    { key: "hasElevator", label: "آسانسور دارد؟", type: "boolean" },
    { key: "volume", label: "حجم اسباب", type: "select", required: true, options: ["کم (یک اتاق)", "متوسط (دو تا سه اتاق)", "زیاد (خانه کامل)"] },
  ],
  ac: [
    { key: "acType", label: "نوع دستگاه", type: "select", required: true, options: ["اسپلیت", "کولر گازی پنجره‌ای", "سیستم مرکزی"] },
    { key: "units", label: "تعداد دستگاه", type: "number", required: true, min: 1, max: 10 },
    { key: "issue", label: "موضوع درخواست", type: "select", required: true, options: ["سرویس دوره‌ای", "عدم سرمایش", "نشتی آب", "صدای زیاد", "نصب جدید"] },
  ],
  pest: [
    { key: "pestType", label: "نوع آفت", type: "select", required: true, options: ["سوسک", "موش", "مورچه", "ساس", "پشه و مگس", "سایر"] },
    { key: "area", label: "متراژ تقریبی (متر مربع)", type: "number", min: 10, max: 1000 },
    { key: "hasPets", label: "حیوان خانگی یا کودک دارید؟", type: "boolean" },
  ],
  garden: [
    { key: "gardenSize", label: "متراژ فضای سبز", type: "select", required: true, options: ["کمتر از ۵۰ متر", "۵۰ تا ۲۰۰ متر", "بیشتر از ۲۰۰ متر"] },
    { key: "services", label: "خدمات مورد نیاز", type: "checkbox", required: true, options: ["چمن‌زنی", "هرس درخت", "آبیاری و کوددهی", "سم‌پاشی گیاهان"] },
  ],
  furniture: [
    { key: "itemType", label: "نوع وسیله", type: "select", required: true, options: ["مبل", "صندلی", "میز", "کمد یا کابینت"] },
    { key: "problemDescription", label: "شرح مشکل یا کار", type: "textarea", required: true },
  ],
  computer: [
    { key: "deviceType", label: "نوع دستگاه", type: "select", required: true, options: ["لپ‌تاپ", "کامپیوتر دسکتاپ", "پرینتر", "موبایل یا تبلت"] },
    { key: "brand", label: "برند و مدل", type: "text", required: true },
    { key: "dataBackup", label: "پشتیبان‌گیری از اطلاعات لازم است؟", type: "boolean" },
  ],
  car: [
    { key: "carModel", label: "مدل خودرو", type: "text", required: true, placeholder: "مثلاً پژو ۲۰۶" },
    { key: "issue", label: "موضوع", type: "select", required: true, options: ["سرویس دوره‌ای", "باتری", "استارت نمی‌خورد", "تعمیر موتور", "سایر"] },
    { key: "location", label: "موقعیت فعلی خودرو", type: "text", required: true },
  ],
  beauty: [
    { key: "serviceType", label: "نوع خدمات", type: "checkbox", required: true, options: ["آرایش مجلس", "کوتاهی مو", "رنگ مو", "اصلاح صورت"] },
    { key: "guestsCount", label: "تعداد افراد", type: "number", required: true, min: 1, max: 10 },
  ],
  general: [
    { key: "taskDescription", label: "شرح کار", type: "textarea", required: true, placeholder: "کار موردنظر را دقیق توضیح دهید" },
    { key: "toolsProvided", label: "ابزار را خودتان تهیه می‌کنید؟", type: "boolean" },
  ],
  locksmith: [
    { key: "doorType", label: "نوع درب", type: "select", required: true, options: ["درب چوبی", "درب فلزی", "درب ضدسرقت", "کشو و کمد"] },
    { key: "issue", label: "موضوع", type: "radio", required: true, options: ["قفل خراب شده", "کلید گم شده", "قفل گیر کرده", "نیاز به ارتقا"] },
  ],
  photo: [
    { key: "duration", label: "مدت عکاسی (ساعت)", type: "number", required: true, min: 1, max: 12 },
    { key: "peopleCount", label: "تعداد افراد", type: "number", min: 1, max: 200 },
    { key: "style", label: "سبک مورد نظر", type: "select", options: ["کلاسیک", "مدرن", "سینمایی", "مستند"] },
  ],
  event: [
    { key: "guests", label: "تعداد مهمانان", type: "number", required: true, min: 5, max: 1000 },
    { key: "venue", label: "محل برگزاری", type: "select", required: true, options: ["منزل", "باغ", "تالار", "فضای باز"] },
    { key: "theme", label: "تم یا سبک مراسم", type: "text" },
  ],
  education: [
    { key: "level", label: "سطح تحصیلی", type: "select", required: true, options: ["دبستان", "متوسطه اول", "متوسطه دوم", "دانشجو", "بزرگسال"] },
    { key: "sessionsPerWeek", label: "تعداد جلسه در هفته", type: "number", min: 1, max: 7 },
    { key: "goal", label: "هدف آموزش", type: "textarea", required: true },
  ],
  security: [
    { key: "propertyType", label: "نوع ملک", type: "select", required: true, options: ["آپارتمان", "ویلا", "مغازه", "دفتر کار"] },
    { key: "cameraCount", label: "تعداد دوربین مورد نیاز", type: "number", min: 1, max: 32 },
    { key: "hasWifi", label: "وای‌فای در محل موجود است؟", type: "boolean" },
  ],
  interior: [
    { key: "area", label: "متراژ (متر مربع)", type: "number", required: true, min: 20, max: 1000 },
    { key: "style", label: "سبک دکوراسیون", type: "select", options: ["مینیمال", "کلاسیک", "مدرن", "اسکاندیناوی"] },
    { key: "brief", label: "توضیح خواسته‌ها", type: "textarea", required: true },
  ],
  pet: [
    { key: "petType", label: "نوع حیوان", type: "select", required: true, options: ["سگ", "گربه", "پرنده", "سایر"] },
    { key: "petCount", label: "تعداد", type: "number", min: 1, max: 10 },
    { key: "notes", label: "نکات مهم (حساسیت، دارو)", type: "textarea" },
  ],
};

const FAMILY_PRICE_FACTORS: Record<string, string[]> = {
  cleaning: ["متراژ و تعداد اتاق", "میزان کثیفی و لکه‌های سخت", "استفاده از تجهیزات بخار", "زمان انجام"],
  plumbing: ["عمق و محل نشتی", "نیاز به تعویض لوله یا اتصالات", "زمان انجام (عادی یا فوری)", "قطعات مصرفی"],
  electrical: ["پیچیدگی عیب", "نیاز به تعویض سیم یا تابلو", "ساعات کاری (شب یا تعطیل)", "قطعات مصرفی"],
  appliance: ["نوع و برند دستگاه", "قطعه یدکی موردنیاز", "گارانتی دستگاه", "زمان انجام"],
  painting: ["متراژ سطح", "نوع رنگ و پوشش", "وضعیت دیوار", "جابجایی مبلمان"],
  moving: ["حجم اسباب", "طبقه و آسانسور", "فاصله تا مقصد", "بسته‌بندی ویژه"],
  ac: ["نوع و تعداد دستگاه", "میزان شارژ گاز", "طول لوله‌کشی", "زمان انجام"],
};
const DEFAULT_PRICE_FACTORS = ["پیچیدگی کار", "زمان انجام", "مواد یا قطعات مصرفی", "موقعیت محل"];

// ---------- Professionals ----------

interface ProSeed {
  name: string;
  headline: string;
  leaves: string[];
  areas: string[];
  years: number;
  tone: string;
  skills: string[];
  status: ProVerificationStatus;
}
const pro = (name: string, headline: string, leaves: string[], areas: string[], years: number, tone: string, skills: string[], status: ProVerificationStatus = "verified"): ProSeed => ({ name, headline, leaves, areas, years, tone, skills, status });

const PROS: ProSeed[] = [
  pro("علی رضایی", "متخصص نشتی و آبگرمکن", ["leak-repair", "water-heater"], ["تهران", "کرج"], 12, "sky", ["نشت‌یابی صوتی", "تعویض لوله", "آبگرمکن"]),
  pro("مریم احمدی", "نظافت منزل و بعد از بازسازی", ["house-cleaning", "post-build-cleaning"], ["تهران", "کرج"], 8, "rose", ["نظافت عمیق", "بخارشویی", "حذف گرد سیمان"]),
  pro("حسین محمدی", "برق‌کار ساختمان و روشنایی", ["electrical-repair", "lighting-install"], ["تهران", "کرج"], 15, "amber", ["عیب‌یابی برق", "تابلو برق", "نصب لوستر"]),
  pro("سارا کریمی", "تعمیرکار لوازم خانگی", ["washing-machine", "fridge-freezer", "cooking-appliance"], ["تهران"], 10, "violet", ["لباسشویی", "یخچال و فریزر", "برد الکترونیک"]),
  pro("محمد جعفری", "نقاش ساختمان و بازسازی", ["painting", "renovation"], ["تهران", "مشهد"], 14, "emerald", ["نقاشی ساختمان", "اکو و طرح", "کاغذدیواری"]),
  pro("پیمان نوری", "تکنسین کولر و تهویه", ["ac-service", "ac-install"], ["تهران", "کرج", "مشهد"], 9, "sky", ["شارژ گاز", "نصب اسپلیت", "تست خلأ"]),
  pro("زهرا حیدری", "سم‌پاشی و باغبانی", ["pest-control", "gardening"], ["تهران", "شیراز"], 6, "mint", ["سم‌پاشی ایمن", "هرس درخت", "کاشت چمن"]),
  pro("امیر صادقی", "تعمیرات کامپیوتر و شبکه", ["laptop-repair", "network-setup"], ["تهران", "اصفهان"], 7, "violet", ["تعمیر لپ‌تاپ", "شبکه", "نصب ویندوز"]),
  pro("کاوه مرادی", "اسباب‌کشی و باربری", ["urban-moving", "packing-service"], ["تهران", "کرج"], 11, "lime", ["بسته‌بندی", "باربری", "جابجایی مبلمان"]),
  pro("نرگس اسدی", "آرایشگر و خدمات زیبایی در منزل", ["hair-makeup", "skincare-home"], ["تهران"], 9, "rose", ["آرایش مجلس", "کوتاهی مو", "فیشیال"]),
  pro("رضا توکلی", "تعمیرات جزئی و مونتاژ", ["handyman", "assembly", "furniture-repair", "carpentry"], ["تهران", "کرج"], 13, "amber", ["مونتاژ", "نجاری سبک", "تعمیرات جزئی"]),
  pro("سعید حسینی", "خدمات سیار خودرو", ["car-maintenance", "car-emergency"], ["تهران", "کرج"], 10, "slate", ["سرویس روغن", "باتری", "امداد"]),
  pro("فاطمه نیکنام", "تعمیرکار آبگرمکن و لوله‌کش", ["leak-repair", "water-heater"], ["مشهد", "تهران"], 8, "sky", ["لوله‌کشی", "آبگرمکن گازی", "گرفتگی"]),
  pro("بهرام صفری", "قفل‌ساز حرفه‌ای", ["door-locks", "safe-opening"], ["تهران"], 12, "slate", ["قفل هوشمند", "بازکردن قفل", "کلید یدکی"]),
  pro("لیلا کاظمی", "عکاس مراسم و پرتره", ["event-photo", "portrait-studio"], ["تهران", "اصفهان"], 6, "violet", ["عکاسی مراسم", "نورپردازی", "ویرایش"]),
  pro("یوسف رحیمی", "برگزاری مراسم و دکوراسیون", ["party-setup", "catering-staff"], ["تهران", "شیراز"], 9, "amber", ["دکور جشن", "چیدمان", "هماهنگی مراسم"]),
  pro("ندا شریفی", "مدرس خصوصی ریاضی و زبان", ["home-tutoring", "language-coaching"], ["تهران", "کرج", "اصفهان"], 7, "sky", ["ریاضی", "مکالمه انگلیسی", "کنکور"]),
  pro("کیاوش نعمتی", "نصب دوربین و هوشمندسازی", ["cctv-install", "smart-home"], ["تهران", "اصفهان", "شیراز"], 8, "slate", ["مداربسته", "هوشمندسازی", "شبکه امنیتی"]),
  pro("مینا فتحی", "مشاور دکوراسیون داخلی", ["interior-consult", "curtain-blinds"], ["تهران", "اصفهان"], 10, "mint", ["دکوراسیون", "انتخاب رنگ", "پرده سفارشی"]),
  pro("حامد عباسی", "مراقبت از حیوانات خانگی", ["pet-grooming", "pet-sitting"], ["تهران", "کرج"], 5, "lime", ["حمام سگ", "نگهداری حیوان", "گردش"]),
  pro("آرش یوسفی", "تعمیر اجاق گاز و برقی", ["cooking-appliance", "electrical-repair"], ["شیراز", "اصفهان"], 11, "violet", ["اجاق گاز", "برق ساختمان", "تابلو"]),
  pro("پریسا محمودی", "نظافت و خدمات پس از ساخت", ["post-build-cleaning", "house-cleaning"], ["اصفهان", "شیراز"], 6, "rose", ["نظافت بعد از ساخت", "شستشوی نما", "نظافت عمیق"]),
  pro("مهدی قاسمی", "نقاشی و کفپوش", ["painting", "renovation"], ["تبریز", "تهران"], 9, "emerald", ["نقاشی", "کفپوش", "اکو"]),
  pro("شهرام زارعی", "برق‌کار و تابلو برق", ["electrical-repair", "lighting-install"], ["تبریز", "مشهد"], 12, "amber", ["عیب‌یابی", "تابلو برق", "روشنایی"]),
  pro("مجید طاهری", "تعمیرات برقی و لوله‌کشی", ["electrical-repair", "leak-repair"], ["تهران"], 3, "slate", ["لوله‌کشی", "برق"], "rejected"),
];

const FIRST_NAMES = ["سارا", "محمد", "نگار", "امیرحسین", "زهره", "علیرضا", "الهام", "کامران", "شیرین", "بهنام", "پگاه", "سینا", "مهسا", "رامین", "ترانه", "پویا", "هدیه", "میلاد", "یلدا", "حمید", "لاله", "پیام", "غزال", "ایمان", "روژین", "ساسان", "نیلوفر", "آیدین", "مریم", "کوروش"];
const LAST_NAMES = ["احمدی", "رضایی", "کریمی", "حسینی", "موسوی", "نجفی", "هاشمی", "سلیمانی", "رحمانی", "کیانی", "بیگدلی", "شاکری", "ملکی", "اکبری", "صادقی", "یزدانی", "فروتن", "جلالی", "زندی", "کرمانی"];
const STREETS = ["ولیعصر", "آزادی", "شریعتی", "امام خمینی", "پاسداران", "مطهری", "چمران", "جمهوری", "فلسطین", "خیام"];

const COMMENTS: Record<number, string[]> = {
  5: ["کار با دقت و سرعت انجام شد. قیمت شفاف بود و متخصص کاملاً حرفه‌ای رفتار کرد.", "عالی بود؛ همه چیز طبق توافق انجام شد و نتیجه از انتظارم بهتر بود.", "متخصص به‌موقع رسید، کار تمیز انجام داد و توضیحات خوبی درباره مراقبت‌ها داد."],
  4: ["کار خوب بود؛ فقط کمی دیرتر از زمان قرار رسیدند ولی نتیجه راضی‌کننده بود.", "نتیجه خوبی داشت. اگر پیام هماهنگی زودتر می‌آمد، بهتر بود.", "قیمت منصفانه و کار مرتب انجام شد."],
  3: ["کار انجام شد اما انتظار بیشتری داشتم. ارتباط با متخصص می‌توانست بهتر باشد.", "نتیجه متوسط بود؛ بخشی از کار نیاز به بازبینی داشت."],
  2: ["زمان‌بندی به‌هم ریخت و کار کامل انجام نشد. امیدوارم در دفعات بعد بهتر شود.", "کیفیت کار پایین‌تر از توافق بود."],
  1: ["متأسفانه تجربه خوبی نبود. کار باید دوباره انجام می‌شد."],
};
const REPLIES = ["از نظر شما سپاسگزاریم. خوشحالیم که کار مطابق انتظار بود.", "ممنون از بازخورد شما؛ برای خدمت‌های بعدی هماهنگی را زودتر انجام می‌دهیم.", "سپاس از نظرتان. اگر مشکل تکرار شد، خوشحال می‌شویم با ما در میان بگذارید."];
const OFFER_TEXTS = [
  "بازدید حضوری، بررسی دقیق و انجام کار با تجهیزات کامل و گارانتی کار.",
  "تجربه بالا در این نوع خدمت؛ قیمت شفاف و امکان شروع در روز قرار.",
  "کار با مواد استاندارد و بازرسی نهایی همراه با توضیح کامل پس از اتمام.",
  "ارائه برآورد دقیق قبل از شروع و هماهنگی زمان کار با شما.",
];
const NOTE_TEXTS = ["لطفاً قبل از ورود تماس بگیرید.", "پارکینگ مهمان داریم.", "ساعت ۱۰ تا ۱۲ بهترین زمان است.", "کلید واحد نزد همسایه است."];
const MESSAGE_TEXTS = ["سلام، ساعت حضور من مشخص شد.", "بله، لطفاً ساعت قرار را تأیید کنید.", "دسترسی به محل مشکلی ندارد.", "ممنون؛ منتظر هستم.", "ابزار و مواد با من است.", "کار تقریباً تمام شد، لطفاً بازدید کنید.", "بله، عکس نتیجه را برایتان می‌فرستم."];
const CANCEL_REASONS = ["زمان دیگری نیاز دارم", "مشکل برطرف شد", "هزینه با بودجه‌ام هماهنگ نبود", "اشتباه در ثبت درخواست"];
const DISPUTE_NOTES = ["متخصص در زمان توافق‌شده حاضر نشد و تأخیر زیادی داشت.", "کار با توافق اولیه همخوانی نداشت و بخشی از آن انجام نشد."];

// ---------- Content ----------

const BANNERS = [
  { title: "۱۰٪ تخفیف برای اولین سفارش شما", subtitle: "با کد WELCOME10 روی همه خدمات نظافت و تعمیرات تخفیف بگیرید.", ctaLabel: "شروع سفارش", ctaHref: "/search?q=نظافت", tone: "emerald", sortOrder: 1 },
  { title: "تعمیرات فوری لوله‌کشی و برق", subtitle: "متخصصان تأییدشده برای پاسخ سریع در تهران و کرج.", ctaLabel: "مشاهده خدمات", ctaHref: "/categories/plumbing", tone: "amber", sortOrder: 2 },
  { title: "متخصص شوید و درآمد خود را مدیریت کنید", subtitle: "ثبت‌نام آسان، دریافت درخواست‌های نزدیک و برداشت درآمد.", ctaLabel: "ثبت‌نام متخصص", ctaHref: "/become-a-pro", tone: "sky", sortOrder: 3 },
  { title: "آماده‌سازی منزل برای فصل گرما", subtitle: "سرویس کولر، شارژ گاز و سم‌پاشی را با یک درخواست رزرو کنید.", ctaLabel: "خدمات تهویه", ctaHref: "/categories/air-conditioning", tone: "rose", sortOrder: 4 },
];
const FAQ_HOME = [
  ["چطور یک متخصص را انتخاب کنم؟", "پس از ثبت درخواست، پیشنهادهای متخصصان را با قیمت، امتیاز، سابقه و زمان حضور مقایسه می‌کنید و هر کدام را بخواهید انتخاب می‌کنید."],
  ["قیمت نهایی چگونه محاسبه می‌شود؟", "قیمت نهایی برابر است با مبلغ پیشنهاد متخصص انتخابی به‌علاوه کارمزد خدمات و در صورت فوری بودن هزینه فوری‌سازی؛ کدهای تخفیف در صورت وجود اعمال می‌شوند."],
  ["آیا متخصصان تأیید شده‌اند؟", "هر متخصص قبل از فعال‌شدن، مدارک هویتی و تخصصی‌اش بررسی می‌شود. متخصصان تأیید نشده امکان دریافت درخواست ندارند."],
  ["اگر از خدمت راضی نباشم چه کنم؟", "می‌توانید از بخش سفارش‌ها اختلاف ثبت کنید؛ تیم پشتیبانی موضوع را بررسی و نتیجه را اعلام می‌کند."],
  ["آیا می‌توانم سفارش را لغو یا زمان آن را تغییر دهم؟", "تا قبل از شروع خدمت، از بخش سفارش‌های من می‌توانید سفارش را لغو یا زمان آن را تغییر دهید."],
  ["پرداخت چگونه انجام می‌شود؟", "پرداخت پس از انتخاب متخصص و تأیید خلاصه سفارش انجام می‌شود. در این نسخه، درگاه پرداخت به‌صورت آزمایشی (Sandbox) فعال است."],
];
const FAQ_GENERAL = [
  ["چگونه حساب کاربری بسازم؟", "از صفحه ثبت‌نام، نام، شماره موبایل و رمز عبور را وارد کنید و کد تأیید را ثبت کنید."],
  ["کارمزد آرنا چقدر است؟", "کارمزد خدمات مشتری ۳٪ مبلغ است و کمیسیون پلتفرم از درآمد متخصص ۱۵٪ کسر می‌شود."],
  ["اگر متخصص در زمان قرار حاضر نشد، چه کنم؟", "پیام خود را در گفتگوی سفارش بنویسید یا سفارش را در بخش اختلاف ثبت کنید تا پشتیبانی پیگیری کند."],
  ["چگونه متخصص شوم؟", "از صفحه «متخصص شوید» فرم را تکمیل کنید و مدارک هویتی و تخصصی خود را بارگذاری کنید. پس از تأیید مدیریت، پیشنهادها فعال می‌شوند."],
];
const BLOG = [
  { slug: "how-to-choose-plumber", title: "چگونه یک لوله‌کش مطمئن انتخاب کنیم؟", excerpt: "نکات کلیدی برای انتخاب متخصص لوله‌کشی و پرهیز از هزینه‌های اضافی.", body: "پیش از انتخاب، مدارک، سابقه کاری و نظرات کاربران را بررسی کنید.\n\nهمیشه پیشنهاد قیمت را با جزئیات کار مقایسه کنید؛ کار ارزان با مواد نامعلوم، اغلب هزینه بیشتری در پی دارد.\n\nبرای نشتی‌های پنهان، پرسیدن درباره روش نشت‌یابی را فراموش نکنید.", published: true },
  { slug: "ac-maintenance-tips", title: "نکات نگهداری کولر گازی قبل از تابستان", excerpt: "سرویس به‌موقع، عمر دستگاه را افزایش می‌دهد و مصرف برق را کاهش می‌دهد.", body: "فیلترهای کولر را حداقل هر ماه یک‌بار تمیز کنید.\n\nسرویس کامل را پیش از فصل گرما انجام دهید تا گاز و کویل بررسی شود.\n\nاگر صدای غیرعادی یا نشتی آب دیدید، دستگاه را خاموش کنید و با متخصص تماس بگیرید.", published: true },
  { slug: "moving-checklist", title: "چک‌لیست اسباب‌کشی بدون استرس", excerpt: "از بسته‌بندی تا تحویل، همه مراحل اسباب‌کشی را گام‌به‌گام ببینید.", body: "یک ماه قبل، وسایل کم‌استفاده را جدا کنید.\n\nهفته قبل، لوازم شکستنی را با کارتن‌های جدا و برچسب‌گذاری‌شده بسته‌بندی کنید.\n\nروز انتقال، نشانی دقیق و طبقه مقصد را برای تیم حمل توضیح دهید.", published: true },
  { slug: "kitchen-cleaning-routine", title: "برنامه نظافت آشپزخانه در هفته", excerpt: "یک برنامه ساده که آشپزخانه را همیشه تمیز نگه می‌دارد.", body: "روزانه سطوح کار و سینک را پاک کنید.\n\nهفتگی، کابینت‌های بیرونی و دستگیره‌ها را با دستمال مرطوب تمیز کنید.\n\nماهانه، پشت یخچال و زیر اجاق را بررسی و تمیز کنید.", published: true },
  { slug: "choosing-paint-colors", title: "انتخاب رنگ دیوار برای فضای کوچک", excerpt: "رنگ‌های روشن و تکنیک‌هایی برای بزرگ‌تر به نظر رسیدن اتاق.", body: "رنگ‌های روشن با زیرلایه خنثی، فضا را باز نشان می‌دهند.\n\nیک دیوار لهجه با رنگ کم‌رنگ‌تر ایجاد عمق می‌کند.\n\nپیش از خرید، نمونه رنگ را روی دیوار امتحان کنید.", published: true },
  { slug: "winter-heating-safety", title: "ایمنی گرمایش در فصل سرما", excerpt: "نکات ساده برای جلوگیری از حادثه هنگام استفاده از بخاری و آبگرمکن.", body: "بخاری گازی را در فضای دارای تهویه کافی استفاده کنید.\n\nآبگرمکن را سالی یک‌بار بررسی کنید و از سرویس کردن آن غافل نشوید.", published: true },
  { slug: "draft-smart-home-guide", title: "راهنمای هوشمندسازی منزل (پیش‌نویس)", excerpt: "این مقاله هنوز در حال نگارش است.", body: "این متن پیش‌نویس است و منتشر نشده است.", published: false },
  { slug: "draft-pet-travel", title: "سفر با حیوان خانگی (پیش‌نویس)", excerpt: "پیش‌نویس داخلی.", body: "این متن پیش‌نویس است و منتشر نشده است.", published: false },
];
const PAGES = [
  { slug: "about", title: "درباره آرنا", body: "آرنا بازار تخصصی خدمات منزل است که متخصصان تأییدشده را به مشتریان متصل می‌کند.\n\nهدف ما شفافیت قیمت، کیفیت خدمات و تجربه‌ای آسان برای همه است.", published: true },
  { slug: "terms", title: "قوانین و مقررات", body: "استفاده از آرنا به منزله پذیرش این قوانین است.\n\nمتخصصان موظف به رعایت استانداردهای ایمنی و ارائه پیشنهاد صادقانه هستند.", published: true },
  { slug: "privacy", title: "حریم خصوصی", body: "اطلاعات شما فقط برای انجام سفارش و پشتیبانی استفاده می‌شود.\n\nنشانی و شماره تماس شما پس از تأیید پرداخت، در اختیار متخصص قرار می‌گیرد.", published: true },
];
const COUPONS = [
  { code: "WELCOME10", percent: 10, maxAmount: 100000, minTotal: 200000, isActive: true, expiresAt: null as Date | null },
  { code: "ARENA20", percent: 20, maxAmount: 200000, minTotal: 500000, isActive: true, expiresAt: null },
  { code: "SPRING15", percent: 15, maxAmount: 150000, minTotal: 300000, isActive: true, expiresAt: new Date(Date.now() + 120 * DAY) },
  { code: "NOWRUZ25", percent: 25, maxAmount: 250000, minTotal: 400000, isActive: true, expiresAt: new Date(Date.now() - 30 * DAY) },
];

// ---------- Helpers ----------

const uuidOf = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const proPhone = (i: number) => (i === 0 ? "09120000002" : `0912300${String(i).padStart(4, "0")}`);
const dayKeyOf = (ms: number) => TEHRAN_DATE.format(new Date(ms));
const hourOf = (ms: number) => Number(TEHRAN_HOUR.format(new Date(ms)));
const slotForHour = (h: number) => TIME_SLOTS.find((t) => h >= Number(t.id.split("-")[0]) && h < Number(t.id.split("-")[0]) + 2)?.id ?? "18-20";
const slotStart = (key: string, slot: string) => new Date(`${key}T${String(Number(slot.split("-")[0])).padStart(2, "0")}:00:00+03:30`);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildQuestions(family: string): Q[] {
  return [...(FAMILY_QUESTIONS[family] ?? FAMILY_QUESTIONS.general!), ...COMMON_TAIL];
}

function sampleAnswers(questions: Q[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    switch (q.type) {
      case "file":
      case "date":
      case "time":
        break;
      case "select":
      case "radio":
        out[q.key] = q.options?.[0] ?? "";
        break;
      case "checkbox":
        out[q.key] = q.options?.slice(0, 1) ?? [];
        break;
      case "number":
        out[q.key] = q.min ?? 2;
        break;
      case "boolean":
        out[q.key] = false;
        break;
      default:
        out[q.key] = "شرح نمونه برای این سفارش";
    }
  }
  return out;
}

function buildFaqs(title: string, minutes: number): FaqItem[] {
  const dur = minutes >= 60 ? `${Math.round(minutes / 60)} ساعت` : `${minutes} دقیقه`;
  return [
    { q: `${title} چقدر طول می‌کشد؟`, a: `مدت زمان تقریبی این خدمت حدود ${dur} است؛ زمان دقیق بسته به شرایط محل و پیشنهاد متخصص ممکن است کمی متفاوت باشد.` },
    { q: "آیا برای این خدمت گارانتی وجود دارد؟", a: "متخصصان موظف به ارائه گارانتی کار مطابق توافق در پیشنهاد هستند. جزئیات گارانتی در پیشنهاد نمایش داده می‌شود." },
    { q: "آیا قیمت قبل از شروع کار اعلام می‌شود؟", a: "بله. قیمت پیشنهادی هر متخصص پیش از انتخاب نمایش داده می‌شود و هزینه نهایی بدون اطلاع شما تغییر نمی‌کند." },
  ];
}

function buildDescription(title: string, parent: string): string {
  return `${title} در بخش ${parent} با متخصصانی انجام می‌شود که سابقه و مدارک آن‌ها بررسی شده است. متخصص پیش از شروع، برآورد کار و زمان حضور را اعلام می‌کند و هزینه نهایی بدون اطلاع شما تغییر نمی‌کند. پس از پایان کار، می‌توانید نتیجه را ارزیابی کنید و نظر خود را ثبت کنید.`;
}

const COMMON_BENEFITS = ["متخصص تأییدشده با سوابق کاری", "ضمانت کیفیت خدمات", "قیمت شفاف پیش از شروع کار", "پشتیبانی آرنا در طول سفارش"];
const COMMON_STEPS = ["انتخاب خدمت و شرح مشکل", "دریافت پیشنهاد از متخصصان", "مقایسه قیمت، امتیاز و زمان حضور", "انتخاب متخصص و پرداخت امن", "انجام خدمت و ثبت نظر"];
const COMMON_REQUIREMENTS = ["دسترسی به محل در زمان قرار", "برق و آب فعال (در صورت نیاز)"];

function docsOf(status: ProVerificationStatus): ProDocument[] {
  const st = status === "verified" ? "approved" : status === "rejected" ? "rejected" : "uploaded";
  return [
    { type: "national_card", name: "کارت-ملی.jpg", status: st },
    { type: "certificate", name: "گواهی-تخصصی.pdf", status: st },
  ];
}

// ---------- Public API ----------

let seedPromise: Promise<void> | null = null;

/** Seeds the database once per process if it is empty. Safe to call from any request path. */
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const [row] = await db.select({ total: count() }).from(s.users);
      if (Number(row?.total ?? 0) === 0) await seedAll();
    })().catch((error: unknown) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

/** Development only: truncates every application table and rebuilds the dataset. */
export async function resetAndSeedDevelopmentData(): Promise<SeedSummary> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_RESET !== "true") {
    throw new Error("بازنشانی داده در محیط production غیرفعال است. فقط روی پایگاه داده آزمایشی و با ALLOW_DEV_RESET=true اجرا کنید.");
  }
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
  return seedAll();
}

export function formatCodeFor(id: number): string {
  return `AR-${String(100000 + id)}`;
}

export interface SeedSummary {
  categories: number;
  services: number;
  users: number;
  professionals: number;
  orders: number;
  reviews: number;
  transactions: number;
}

// ---------- Seeding ----------

type OfferDraft = { professionalId: string; price: number; arrivalMinutes: number; description: string; status: "submitted" | "selected" | "declined"; createdAt: Date };
type NotifDraft = { userId: string; audience: "customer" | "pro" | "none"; orderIdx: number | null; type: "offer" | "booking" | "reminder" | "payment" | "promo"; title: string; body: string; createdAt: Date; isRead: boolean };
interface OrderDraft {
  idx: number;
  values: Omit<typeof s.orders.$inferInsert, "id" | "code" | "selectedOfferId">;
  offers: OfferDraft[];
  payments: Array<{ amount: number; status: "paid" | "failed" | "refunded"; providerRef: string; failureReason: string | null; createdAt: Date }>;
  txs: Array<{ userId: string; type: "customer_payment" | "refund" | "commission" | "pro_earning"; amount: number; description: string; createdAt: Date }>;
  review: { rating: number; comment: string; reply: string | null; repliedAt: Date | null; createdAt: Date; professionalId: string; customerId: string; serviceId: number; authorName: string } | null;
  conversation: { createdAt: Date; professionalId: string; customerId: string; messages: Array<{ senderId: string; body: string; createdAt: Date }> } | null;
  selectedProId: string | null;
}

type Plan = { status: OrderStatus; refund?: boolean; failed?: boolean; dispute?: "open" | "resolved"; review?: boolean };
const PAID_CHAIN: OrderStatus[] = ["confirmed", "on_the_way", "in_progress", "completed"];
const SELECTED_CHAIN: OrderStatus[] = ["professional_selected", ...PAID_CHAIN];

function buildPlan(): Plan[] {
  const plan: Plan[] = [];
  const add = (n: number, p: Plan) => {
    for (let i = 0; i < n; i++) plan.push({ ...p });
  };
  add(41, { status: "completed", review: true });
  add(8, { status: "completed" });
  add(3, { status: "completed", dispute: "resolved" });
  add(1, { status: "completed", dispute: "open" });
  add(5, { status: "in_progress" });
  add(1, { status: "in_progress", dispute: "open" });
  add(2, { status: "on_the_way" });
  add(11, { status: "confirmed" });
  add(6, { status: "professional_selected" });
  add(2, { status: "professional_selected", failed: true });
  add(14, { status: "offers_received" });
  add(10, { status: "waiting_offers" });
  add(3, { status: "pending" });
  add(9, { status: "cancelled" });
  add(4, { status: "cancelled", refund: true });
  return plan;
}

async function seedAll(): Promise<SeedSummary> {
  const now = Date.now();
  const rand = mulberry32(20250101);
  const chance = (p: number) => rand() < p;
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const shuffle = <T,>(input: readonly T[]): T[] => {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  };
  const hex = () => Math.floor(rand() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0");
  const iso = (ms: number) => new Date(ms).toISOString();
  const ts = (ms: number) => new Date(Math.min(ms, now - 60_000));
  const offsetFor = (st: OrderStatus) => (st === "completed" ? -between(3, 60) : st === "cancelled" ? -between(2, 40) : st === "confirmed" ? between(1, 7) : between(1, 25));

  const hashes = { demo: await hashPassword(DEMO_PASSWORD), admin: await hashPassword(ADMIN_PASSWORD) };

  // Stable identities.
  const adminId = uuidOf(1);
  const demoCustomerId = uuidOf(2);
  const pendingProId = uuidOf(3);
  const pros = PROS.map((p, i) => ({ ...p, id: uuidOf(10 + i), phone: proPhone(i) }));
  const customers = Array.from({ length: 30 }, (_, i) => ({
    id: uuidOf(100 + i),
    name: `${FIRST_NAMES[i]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`,
    phone: `0912400${String(i + 1).padStart(4, "0")}`,
  }));

  return db.transaction(async (tx) => {
    // ---- Users ----
    const userValues: Array<typeof s.users.$inferInsert> = [
      { id: adminId, fullName: "مدیر سامانه آرنا", phone: "09120000000", email: "admin@example.com", passwordHash: hashes.admin, role: "admin", phoneVerified: true },
      { id: demoCustomerId, fullName: "کاربر نمونه", phone: "09120000001", email: "customer@example.com", passwordHash: hashes.demo, role: "customer", phoneVerified: true },
      { id: pendingProId, fullName: "سعید خانی", phone: "09120000099", email: "pending@example.com", passwordHash: hashes.demo, role: "professional", phoneVerified: true },
      ...pros.map((p) => ({ id: p.id, fullName: p.name, phone: p.phone, email: `${p.phone}@example.com`, passwordHash: hashes.demo, role: "professional" as const, phoneVerified: true })),
      ...customers.map((c, i) => ({ id: c.id, fullName: c.name, phone: c.phone, email: `customer${i + 2}@example.com`, passwordHash: hashes.demo, role: "customer" as const, phoneVerified: true })),
    ];
    await tx.insert(s.users).values(userValues);

    // ---- Categories ----
    const parentRows = await tx
      .insert(s.categories)
      .values(PARENTS.map(([slug, name, icon, tone, desc], i) => ({ slug, name, description: desc, iconKey: icon, tone, seoTitle: `${name} | خدمات تخصصی آرنا`, seoDescription: desc, sortOrder: i + 1 })))
      .returning({ id: s.categories.id, slug: s.categories.slug });
    const parentId = new Map(parentRows.map((r) => [r.slug, r.id]));
    const leafRows = await tx
      .insert(s.categories)
      .values(
        LEAVES.map(([slug, parent, name], i) => {
          const p = PARENTS.find((x) => x[0] === parent)!;
          return {
            parentId: parentId.get(parent)!,
            slug,
            name,
            description: `خدمات ${name} در ${p[1]}؛ با متخصصان تأییدشده و قیمت شفاف.`,
            iconKey: p[2],
            tone: p[3],
            seoTitle: `${name} | ${p[1]} آرنا`,
            seoDescription: `خدمات ${name} با متخصصان تأییدشده آرنا؛ مقایسه پیشنهادها و رزرو آنلاین.`,
            sortOrder: 100 + i,
          };
        }),
      )
      .returning({ id: s.categories.id, slug: s.categories.slug });
    const leafId = new Map(leafRows.map((r) => [r.slug, r.id]));

    // ---- Services ----
    const svcDefs = SERVICE_ROWS.map(([leaf, slug, title, price, minutes, pop]) => {
      const lf = LEAVES.find((l) => l[0] === leaf)!;
      return { leaf, slug, title, price, minutes, popular: pop === 1, parent: lf[1], family: lf[3] };
    });
    const svcRows = await tx
      .insert(s.services)
      .values(
        svcDefs.map((sv) => {
          const parent = PARENTS.find((p) => p[0] === sv.parent)!;
          return {
            categoryId: leafId.get(sv.leaf)!,
            slug: sv.slug,
            title: sv.title,
            shortDescription: `${sv.title} با متخصصان تأییدشده و قیمت شفاف پیش از شروع کار.`,
            description: buildDescription(sv.title, parent[1]),
            benefits: COMMON_BENEFITS,
            steps: COMMON_STEPS,
            requirements: COMMON_REQUIREMENTS,
            priceFactors: FAMILY_PRICE_FACTORS[sv.family] ?? DEFAULT_PRICE_FACTORS,
            keywords: [sv.title, parent[1]],
            basePrice: sv.price,
            durationMinutes: sv.minutes,
            formFamily: sv.family,
            questions: buildQuestions(sv.family),
            faqs: buildFaqs(sv.title, sv.minutes),
            seoTitle: `${sv.title} در تهران | آرنا`,
            seoDescription: `${sv.title}: رزرو آنلاین با متخصصان تأییدشده، مقایسه پیشنهادها و قیمت شفاف.`,
            tone: parent[3],
            rating: 0,
            reviewsCount: 0,
            isPopular: sv.popular,
            isActive: true,
          };
        }),
      )
      .returning({ id: s.services.id, slug: s.services.slug });
    const svcId = new Map(svcRows.map((r) => [r.slug, r.id]));
    const serviceIds = [...svcId.values()];
    const questionsBySlug = new Map(svcDefs.map((d) => [d.slug, buildQuestions(d.family)]));

    // ---- Professionals ----
    const bioOf = (p: ProSeed) => `${p.headline}. ${p.years} سال سابقه کاری در ${p.skills.join("، ")}. کار را با دقت، رعایت زمان قرار و ارائه گارانتی انجام می‌دهم.`;
    const profileRows: Array<typeof s.professionalProfiles.$inferInsert> = [
      {
        userId: pendingProId,
        headline: "تأسیساتی ساختمان",
        bio: "با ۵ سال سابقه در تأسیسات ساختمانی و آماده همکاری در شهر کرج.",
        experienceYears: 5,
        skills: ["تأسیسات", "لوله‌کشی"],
        serviceAreas: ["کرج"],
        categoryIds: [leafId.get("leak-repair")!],
        documents: [
          { type: "national_card", name: "کارت-ملی.jpg", status: "uploaded" },
          { type: "certificate", name: "گواهی-مهارت.pdf", status: "uploaded" },
        ],
        verificationStatus: "pending",
        avatarTone: "slate",
        isAvailable: false,
      },
      ...pros.map((p) => ({
        userId: p.id,
        headline: p.headline,
        bio: bioOf(p),
        experienceYears: p.years,
        skills: p.skills,
        serviceAreas: p.areas,
        categoryIds: p.leaves.map((l) => leafId.get(l)!),
        workingHours: { days: ["sat", "sun", "mon", "tue", "wed", "thu"], from: "08:00", to: "20:00" },
        pricing: { minPrice: 150_000 + p.years * 5_000, hourlyRate: 120_000 + p.years * 4_000, visitFee: p.areas.length > 1 ? 50_000 : 0 },
        documents: docsOf(p.status),
        portfolio: [
          { title: `${p.headline} · پروژه نمونه ۱`, description: "انجام کار در یک واحد مسکونی با گزارش تصویری" },
          { title: `${p.headline} · پروژه نمونه ۲`, description: "اجرای کامل با مواد استاندارد" },
        ],
        verificationStatus: p.status,
        verificationNotes: p.status === "verified" ? "مدارک بررسی و تأیید شد." : p.status === "rejected" ? "مدارک ارسالی خوانا نبود؛ لطفاً تصاویر واضح‌تری بارگذاری کنید." : "",
        avatarTone: p.tone,
        isAvailable: p.status === "verified",
      })),
    ];
    await tx.insert(s.professionalProfiles).values(profileRows);

    // ---- Addresses and favourites ----
    const addressRows: Array<typeof s.addresses.$inferInsert> = [
      { userId: demoCustomerId, title: "منزل", city: "تهران", region: "شمال تهران", addressLine: "خیابان ولیعصر، نرسیده به پارک ساعی، پلاک ۱۲۰۰", details: "واحد ۵، طبقه سوم", isDefault: true },
      { userId: demoCustomerId, title: "دفتر کار", city: "کرج", region: "عظیمیه", addressLine: "بلوار امام خمینی، خیابان ۱۴، پلاک ۴۵", details: "طبقه ۲", isDefault: false },
    ];
    for (const c of customers) {
      const city = pick(CITIES);
      addressRows.push({ userId: c.id, title: "منزل", city: city.name, region: pick(city.regions), addressLine: `خیابان ${pick(STREETS)}، پلاک ${between(3, 180)}`, details: chance(0.5) ? `واحد ${between(1, 12)}` : "", isDefault: true });
      if (chance(0.4)) {
        const city2 = pick(CITIES);
        addressRows.push({ userId: c.id, title: "دفتر کار", city: city2.name, region: pick(city2.regions), addressLine: `خیابان ${pick(STREETS)}، پلاک ${between(3, 180)}`, details: "", isDefault: false });
      }
    }
    await tx.insert(s.addresses).values(addressRows);

    const favRows: Array<typeof s.favorites.$inferInsert> = [];
    const favKeys = new Set<string>();
    const addFav = (userId: string, targetType: "service" | "professional", targetId: string) => {
      const key = `${userId}|${targetType}|${targetId}`;
      if (favKeys.has(key)) return;
      favKeys.add(key);
      favRows.push({ userId, targetType, targetId });
    };
    addFav(demoCustomerId, "service", String(svcId.get("deep-home-cleaning")));
    addFav(demoCustomerId, "service", String(svcId.get("leak-fix")));
    addFav(demoCustomerId, "professional", pros[1]!.id);
    addFav(demoCustomerId, "professional", pros[5]!.id);
    for (const c of customers) {
      for (let n = between(1, 3); n > 0; n--) addFav(c.id, "service", String(pick(serviceIds)));
      if (chance(0.3)) addFav(c.id, "professional", pick(pros).id);
    }
    await tx.insert(s.favorites).values(favRows);

    // ---- Orders (planned in memory, then persisted) ----
    const verifiedPros = pros.filter((p) => p.status === "verified");
    const customerPool = [{ id: demoCustomerId, name: "کاربر نمونه" }, ...customers.map((c) => ({ id: c.id, name: c.name }))];
    const plan = shuffle(buildPlan());
    const drafts: OrderDraft[] = [];
    const booked = new Set<string>();
    const earnings = new Map<string, number>();
    const completedCount = new Map<string, number>();
    const reviewsByPro = new Map<string, number[]>();
    const reviewsByService = new Map<number, number[]>();
    const notifications: NotifDraft[] = [];

    const findCoverage = () => {
      for (let guard = 0; guard < 400; guard++) {
        const def = pick(svcDefs);
        const city = pick(CITIES).name;
        const cands = verifiedPros.filter((p) => p.leaves.includes(def.leaf) && p.areas.includes(city));
        if (cands.length) return { def, city, cands: shuffle(cands) };
      }
      return null;
    };

    for (const p of plan) {
      const cover = findCoverage();
      if (!cover) continue;
      const { def, city, cands } = cover;
      const idx = drafts.length;
      const code = `AR-${100001 + idx}`;
      const region = pick(CITIES.find((c) => c.name === city)!.regions);
      const customer = idx < 14 ? customerPool[0]! : pick(customerPool);
      const live = p.status === "in_progress" || p.status === "on_the_way";
      const needsSelection = SELECTED_CHAIN.includes(p.status) || (p.status === "cancelled" && !!p.refund);
      const offersFor = needsSelection || p.status === "offers_received";

      // Schedule: live work is "now", other statuses use a Tehran calendar day and a standard slot.
      let scheduledMs: number;
      let dateKey: string;
      let slot: string;
      if (live) {
        scheduledMs = now - between(1, 4) * HOUR;
        dateKey = dayKeyOf(scheduledMs);
        slot = slotForHour(hourOf(scheduledMs));
      } else {
        dateKey = dayKeyOf(now + offsetFor(p.status) * DAY);
        slot = pick(TIME_SLOTS).id;
        scheduledMs = slotStart(dateKey, slot).getTime();
      }

      // Professional selection with a double-booking guard (same pro, same day and slot).
      const offerPros = offersFor ? cands.slice(0, between(1, Math.min(3, cands.length))) : [];
      let selected: (typeof pros)[number] | undefined;
      if (needsSelection) {
        if (p.status === "cancelled") {
          selected = offerPros[0];
        } else {
          const free = (pid: string, sl: string) => !booked.has(`${pid}|${dateKey}|${sl}`);
          selected = offerPros.find((pr) => free(pr.id, slot));
          if (!selected && !live) {
            for (const t of TIME_SLOTS) {
              if (free(offerPros[0]!.id, t.id)) {
                selected = offerPros[0];
                slot = t.id;
                scheduledMs = slotStart(dateKey, slot).getTime();
                break;
              }
            }
          }
          if (!selected) continue;
          booked.add(`${selected.id}|${dateKey}|${slot}`);
        }
      }

      // Timeline (all timestamps are clamped to "now").
      const createdMs = Math.min(scheduledMs - between(2, 9) * DAY, now - 2 * HOUR);
      const selectedMs = Math.min(createdMs + 3 * HOUR, now - HOUR);
      const paidMs = selectedMs + 15 * 60_000;
      const cancelMs = Math.min(paidMs + between(1, 20) * HOUR, now - 30 * 60_000);
      const completedMs = Math.min(scheduledMs + 2 * HOUR, now - HOUR);

      const offers: OfferDraft[] = offerPros.map((pr) => {
        const price = Math.max(50_000, Math.round((def.price * (0.85 + rand() * 0.4)) / 1000) * 1000);
        let status: OfferDraft["status"] = "submitted";
        if (needsSelection) status = selected && pr.id === selected.id ? "selected" : "declined";
        return { professionalId: pr.id, price, arrivalMinutes: pick([30, 45, 60, 90, 120]), description: pick(OFFER_TEXTS), status, createdAt: new Date(Math.min(createdMs + between(1, 3) * HOUR, now - HOUR)) };
      });

      const chosenPrice = selected ? offers.find((o) => o.professionalId === selected!.id)!.price : def.price;
      const paidLike = (needsSelection && PAID_CHAIN.includes(p.status)) || (p.status === "cancelled" && !!p.refund);
      const coupon = paidLike && chosenPrice >= 200_000 && chance(0.15) ? "WELCOME10" : null;
      const discount = coupon ? Math.min(100_000, Math.floor((chosenPrice * 10) / 100)) : 0;
      const urgent = chance(0.15);
      const bd = computeBreakdown({ offerPrice: needsSelection ? chosenPrice : def.price, urgent, discount });
      const paymentStatus: PaymentStatus = p.refund ? "refunded" : paidLike ? "paid" : p.failed ? "failed" : "unpaid";

      const payments: OrderDraft["payments"] = [];
      if (paidLike) payments.push({ amount: bd.total, status: p.refund ? "refunded" : "paid", providerRef: `SBX-${hex()}`, failureReason: null, createdAt: ts(paidMs) });
      if (p.failed) payments.push({ amount: bd.total, status: "failed", providerRef: `SBX-${hex()}`, failureReason: "پرداخت در درگاه آزمایشی ناموفق اعلام شد", createdAt: ts(selectedMs + HOUR) });

      const txs: OrderDraft["txs"] = [];
      if (paidLike) txs.push({ userId: customer.id, type: "customer_payment", amount: bd.total, description: `پرداخت سفارش ${code}`, createdAt: ts(paidMs) });
      if (p.refund) txs.push({ userId: customer.id, type: "refund", amount: bd.total, description: `بازپرداخت سفارش ${code}`, createdAt: ts(cancelMs) });
      if (p.status === "completed" && selected) {
        const { commission, net } = computeCommission(chosenPrice);
        txs.push({ userId: selected.id, type: "commission", amount: commission, description: `کمیسیون سفارش ${code}`, createdAt: ts(completedMs) });
        txs.push({ userId: selected.id, type: "pro_earning", amount: net, description: `درآمد سفارش ${code}`, createdAt: ts(completedMs) });
        earnings.set(selected.id, (earnings.get(selected.id) ?? 0) + net);
        completedCount.set(selected.id, (completedCount.get(selected.id) ?? 0) + 1);
      }

      const history: StatusHistoryEntry[] = [{ status: p.status === "pending" ? "pending" : "waiting_offers", at: iso(createdMs), note: p.status === "pending" ? "در انتظار ثبت" : "درخواست ثبت شد" }];
      if (offers.length) history.push({ status: "offers_received", at: iso(createdMs + HOUR), note: "پیشنهاد متخصصان دریافت شد" });
      if (needsSelection) history.push({ status: "professional_selected", at: iso(selectedMs), note: "متخصص انتخاب شد" });
      if (paidLike) history.push({ status: "confirmed", at: iso(paidMs), note: "پرداخت موفق و سفارش تأیید شد" });
      if (["on_the_way", "in_progress", "completed"].includes(p.status)) history.push({ status: "on_the_way", at: iso(scheduledMs - HOUR), note: "متخصص در مسیر محل است" });
      if (p.status === "in_progress" || p.status === "completed") history.push({ status: "in_progress", at: iso(scheduledMs), note: "خدمت شروع شد" });
      if (p.status === "completed") history.push({ status: "completed", at: iso(completedMs), note: "خدمت انجام شد" });
      if (p.status === "cancelled") history.push({ status: "cancelled", at: iso(cancelMs), note: p.refund ? "لغو توسط مشتری؛ مبلغ بازپرداخت شد" : "لغو توسط مشتری" });
      const lastMs = p.status === "completed" ? completedMs : p.status === "cancelled" ? cancelMs : paidLike ? paidMs : createdMs;

      // Review (completed, non-disputed orders only).
      let review: OrderDraft["review"] = null;
      if (p.review && p.status === "completed" && selected) {
        const roll = rand();
        const rating = roll < 0.45 ? 5 : roll < 0.75 ? 4 : roll < 0.87 ? 3 : roll < 0.95 ? 2 : 1;
        const createdReview = ts(Math.min(completedMs + between(1, 4) * DAY, now - HOUR));
        review = { rating, comment: pick(COMMENTS[rating]!), reply: chance(0.3) ? pick(REPLIES) : null, repliedAt: null, createdAt: createdReview, professionalId: selected.id, customerId: customer.id, serviceId: svcId.get(def.slug)!, authorName: customer.name };
        if (review.reply) review.repliedAt = ts(createdReview.getTime() + DAY);
        reviewsByPro.set(selected.id, [...(reviewsByPro.get(selected.id) ?? []), rating]);
        reviewsByService.set(svcId.get(def.slug)!, [...(reviewsByService.get(svcId.get(def.slug)!) ?? []), rating]);
      }

      // Conversation for paid orders (about half of them).
      let conversation: OrderDraft["conversation"] = null;
      if (needsSelection && paidLike && selected && chance(0.5)) {
        const n = between(2, 4);
        conversation = {
          createdAt: ts(paidMs),
          professionalId: selected.id,
          customerId: customer.id,
          messages: Array.from({ length: n }, (_, i) => ({ senderId: i % 2 === 0 ? selected!.id : customer.id, body: pick(MESSAGE_TEXTS), createdAt: ts(paidMs + (i + 1) * HOUR) })),
        };
      }

      // Notifications linked to this order.
      const notify = (userId: string, audience: "customer" | "pro", type: NotifDraft["type"], title: string, body: string, at: number) =>
        notifications.push({ userId, audience, orderIdx: idx, type, title, body, createdAt: ts(at), isRead: at < now - 3 * DAY });
      notify(customer.id, "customer", "booking", "درخواست شما ثبت شد", `درخواست ${def.title} (${code}) برای ${city} ثبت شد.`, createdMs);
      if (offers.length && p.status !== "pending") notify(customer.id, "customer", "offer", "پیشنهاد جدید برای سفارش شما", `برای ${def.title} پیشنهاد دریافت شد.`, createdMs + HOUR);
      if (selected) notify(selected.id, "pro", "booking", "درخواست جدید برای شما", `سفارش ${code} (${def.title}) در ${city} به شما واگذار شد.`, selectedMs);
      if (selected && paidLike) {
        notify(customer.id, "customer", "payment", "پرداخت موفق", `پرداخت سفارش ${code} ثبت شد.`, paidMs);
        notify(selected.id, "pro", "booking", "سفارش تأیید شد", `سفارش ${code} پرداخت شد و آماده اجرا است.`, paidMs);
      }
      if (p.status === "completed" && selected) {
        notify(customer.id, "customer", "booking", "خدمت انجام شد", "لطفاً نظر خود را درباره این خدمت ثبت کنید.", completedMs);
        notify(selected.id, "pro", "payment", "درآمد سفارش ثبت شد", "مبلغ خالص این سفارش به موجودی شما اضافه شد.", completedMs);
      }
      if (p.status === "cancelled") notify(customer.id, "customer", "booking", "سفارش لغو شد", `سفارش ${code} لغو شد.`, cancelMs);
      if (p.refund) notify(customer.id, "customer", "payment", "بازپرداخت ثبت شد", `مبلغ سفارش ${code} به کیف پول شما بازگشت.`, cancelMs);
      if (p.failed) notify(customer.id, "customer", "payment", "پرداخت ناموفق بود", `پرداخت سفارش ${code} انجام نشد. می‌توانید دوباره تلاش کنید.`, selectedMs + HOUR);
      if (p.dispute) notify(customer.id, "customer", "booking", "اختلاف ثبت شد", "تیم پشتیبانی موضوع را بررسی می‌کند.", scheduledMs + 3 * HOUR);
      if (p.status === "confirmed" && scheduledMs > now && scheduledMs - now < 2 * DAY) notify(customer.id, "customer", "reminder", "یادآوری نوبت", `زمان قرار سفارش ${code} نزدیک است.`, now - HOUR);

      drafts.push({
        idx,
        values: {
          customerId: customer.id,
          serviceId: svcId.get(def.slug)!,
          status: p.status,
          paymentStatus,
          answers: sampleAnswers(questionsBySlug.get(def.slug)!),
          attachments: [],
          city,
          region,
          addressLine: `خیابان ${pick(STREETS)}، پلاک ${between(3, 180)}`,
          addressDetails: chance(0.5) ? `واحد ${between(1, 12)}` : "",
          scheduledAt: new Date(scheduledMs),
          timeSlot: slot,
          flexible: chance(0.2),
          urgent,
          notes: chance(0.3) ? pick(NOTE_TEXTS) : "",
          professionalId: selected?.id ?? null,
          estimatedPrice: needsSelection ? chosenPrice : def.price,
          urgentFee: bd.urgentFee,
          serviceFee: bd.serviceFee,
          discount: bd.discount,
          total: bd.total,
          couponCode: coupon,
          demoOffersGenerated: true,
          cancelReason: p.status === "cancelled" ? pick(CANCEL_REASONS) : null,
          cancelledAt: p.status === "cancelled" ? ts(cancelMs) : null,
          completedAt: p.status === "completed" ? ts(completedMs) : null,
          disputeStatus: p.dispute ?? "none",
          disputeNote: p.dispute ? pick(DISPUTE_NOTES) : "",
          statusHistory: history,
          createdAt: ts(createdMs),
          updatedAt: ts(lastMs),
        },
        offers,
        payments,
        txs,
        review,
        conversation,
        selectedProId: selected?.id ?? null,
      });
    }

    // ---- Persist orders and their children ----
    const orderIds: number[] = [];
    const selectedOfferByOrder: Array<number | null> = [];
    for (const d of drafts) {
      const [row] = await tx.insert(s.orders).values({ ...d.values, code: `AR-${100001 + d.idx}` }).returning({ id: s.orders.id });
      orderIds.push(row!.id);
      if (d.offers.length) {
        const inserted = await tx
          .insert(s.offers)
          .values(d.offers.map((o) => ({ orderId: row!.id, professionalId: o.professionalId, price: o.price, arrivalMinutes: o.arrivalMinutes, description: o.description, status: o.status, isDemo: false, createdAt: o.createdAt })))
          .returning({ id: s.offers.id, professionalId: s.offers.professionalId, status: s.offers.status });
        const chosen = inserted.find((o) => o.status === "selected");
        selectedOfferByOrder.push(chosen?.id ?? null);
        if (chosen) await tx.update(s.orders).set({ selectedOfferId: chosen.id }).where(eq(s.orders.id, row!.id));
      } else {
        selectedOfferByOrder.push(null);
      }
    }

    const paymentRows: Array<typeof s.payments.$inferInsert> = [];
    const txRows: Array<typeof s.transactions.$inferInsert> = [];
    const reviewRows: Array<typeof s.reviews.$inferInsert> = [];
    const messageRows: Array<typeof s.messages.$inferInsert> = [];
    drafts.forEach((d, i) => {
      const orderId = orderIds[i]!;
      for (const p of d.payments) paymentRows.push({ orderId, ...p });
      for (const t of d.txs) txRows.push({ ...t, orderId, status: "completed" });
      if (d.review) {
        const { professionalId, customerId, serviceId, authorName, ...r } = d.review;
        reviewRows.push({ ...r, orderId, professionalId, customerId, serviceId, authorName, status: "published", updatedAt: r.createdAt });
      }
    });
    if (paymentRows.length) await tx.insert(s.payments).values(paymentRows);
    if (txRows.length) await tx.insert(s.transactions).values(txRows);
    if (reviewRows.length) await tx.insert(s.reviews).values(reviewRows);

    for (let i = 0; i < drafts.length; i++) {
      const c = drafts[i]!.conversation;
      if (!c) continue;
      const [conv] = await tx.insert(s.conversations).values({ orderId: orderIds[i]!, customerId: c.customerId, professionalId: c.professionalId, createdAt: c.createdAt }).returning({ id: s.conversations.id });
      for (const m of c.messages) messageRows.push({ conversationId: conv!.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt, readAt: m.createdAt });
    }
    if (messageRows.length) await tx.insert(s.messages).values(messageRows);

    // ---- Withdrawals (never exceed the professional's available balance) ----
    const withdrawalRows: Array<typeof s.transactions.$inferInsert> = [];
    for (const pr of pros) {
      let balance = earnings.get(pr.id) ?? 0;
      if (balance >= 300_000 && chance(0.5)) {
        const amount = Math.floor((balance * 0.5) / 1000) * 1000;
        withdrawalRows.push({ userId: pr.id, type: "withdrawal", amount, status: "completed", description: `برداشت به شبا IR••••••••••••••••${String(1000 + pros.indexOf(pr)).slice(-4)}`, createdAt: ts(now - 5 * DAY) });
        balance -= amount;
      }
      if (balance >= 200_000 && chance(0.4)) {
        const amount = Math.floor((balance * 0.4) / 1000) * 1000;
        if (amount >= 100_000) {
          withdrawalRows.push({ userId: pr.id, type: "withdrawal", amount, status: "pending", description: "درخواست برداشت در صف بررسی", createdAt: ts(now - DAY) });
          balance -= amount;
        }
      }
    }
    withdrawalRows.push({ userId: demoCustomerId, type: "wallet_deposit", amount: 300_000, status: "completed", description: "شارژ کیف پول (درگاه آزمایشی - بدون پرداخت واقعی)", createdAt: ts(now - 10 * DAY) });
    await tx.insert(s.transactions).values(withdrawalRows);

    // ---- Notifications ----
    const generic: NotifDraft[] = [
      ...customers.map((c) => ({ userId: c.id, audience: "none" as const, orderIdx: null, type: "promo" as const, title: "کد تخفیف WELCOME10 برای شما فعال شد", body: "۱۰٪ تخفیف روی سفارش بعدی شما.", createdAt: ts(now - 3 * DAY), isRead: false })),
      ...pros.filter((p) => p.status === "verified").map((p) => ({ userId: p.id, audience: "none" as const, orderIdx: null, type: "booking" as const, title: "حساب متخصص شما تأیید شد", body: "اکنون می‌توانید به درخواست‌های مشتریان پیشنهاد دهید.", createdAt: ts(now - 40 * DAY), isRead: true })),
    ];
    const notifRows = [...notifications, ...generic].map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.audience === "pro" ? "/pro/jobs" : n.orderIdx !== null ? `/account/orders/${orderIds[n.orderIdx]}` : n.type === "promo" ? "/categories" : "/pro/requests",
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
    for (let i = 0; i < notifRows.length; i += 400) await tx.insert(s.notifications).values(notifRows.slice(i, i + 400));

    // ---- Aggregates derived from the persisted data ----
    for (const pr of pros) {
      const rs = reviewsByPro.get(pr.id) ?? [];
      const rating = rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : 0;
      await tx.update(s.professionalProfiles).set({ rating, reviewsCount: rs.length, completedJobs: completedCount.get(pr.id) ?? 0 }).where(eq(s.professionalProfiles.userId, pr.id));
    }
    for (const [serviceId, rs] of reviewsByService) {
      const rating = Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10;
      await tx.update(s.services).set({ rating, reviewsCount: rs.length }).where(eq(s.services.id, serviceId));
    }

    // ---- Content, coupons, newsletter, audit ----
    await tx.insert(s.banners).values(BANNERS);
    await tx.insert(s.faqs).values([
      ...FAQ_HOME.map(([question, answer], i) => ({ question, answer, scope: "home" as const, sortOrder: i + 1 })),
      ...FAQ_GENERAL.map(([question, answer], i) => ({ question, answer, scope: "general" as const, sortOrder: i + 1 })),
    ]);
    await tx.insert(s.coupons).values(COUPONS);
    await tx.insert(s.blogPosts).values(BLOG.map((b) => ({ slug: b.slug, title: b.title, excerpt: b.excerpt, body: b.body, isPublished: b.published, createdAt: ts(now - (BLOG.indexOf(b) + 2) * DAY), updatedAt: ts(now - DAY) })));
    await tx.insert(s.staticPages).values(PAGES.map((p) => ({ slug: p.slug, title: p.title, body: p.body, isPublished: p.published })));
    await tx.insert(s.newsletterSubscribers).values(Array.from({ length: 12 }, (_, i) => ({ email: `reader${i + 1}@example.com` })));

    const auditRows: Array<typeof s.auditLogs.$inferInsert> = [{ actorId: adminId, action: "seed", entity: "system", details: "داده‌های نمایشی ایجاد شد", createdAt: ts(now - 30 * DAY) }];
    for (const pr of pros) {
      auditRows.push({ actorId: adminId, action: pr.status === "rejected" ? "professional.reject" : "professional.approve", entity: "professional", entityId: pr.id, details: pr.status === "rejected" ? "مدارک ناخوانا" : "مدارک بررسی و تأیید شد", createdAt: ts(now - (5 + pros.indexOf(pr)) * DAY) });
    }
    auditRows.push({ actorId: pendingProId, action: "pro.applied", entity: "professional", entityId: pendingProId, details: "درخواست همکاری ثبت شد", createdAt: ts(now - 2 * DAY) });
    for (let i = 0; i < BANNERS.length; i++) auditRows.push({ actorId: adminId, action: "content.create", entity: "banner", entityId: String(i + 1), details: BANNERS[i]!.title, createdAt: ts(now - (12 - i) * DAY) });
    drafts.slice(0, 6).forEach((d, i) => auditRows.push({ actorId: adminId, action: "order.status", entity: "order", entityId: String(orderIds[i]), details: `وضعیت به ${d.values.status} تغییر کرد`, createdAt: ts(now - (i + 1) * DAY) }));
    await tx.insert(s.auditLogs).values(auditRows);

    const summary: SeedSummary = {
      categories: PARENTS.length + LEAVES.length,
      services: svcRows.length,
      users: userValues.length,
      professionals: pros.length + 1,
      orders: drafts.length,
      reviews: reviewRows.length,
      transactions: txRows.length + withdrawalRows.length,
    };
    return summary;
  });
}
