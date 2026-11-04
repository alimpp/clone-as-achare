"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, MapPin, Tag } from "lucide-react";
import { apiRequest, ApiClientError, Badge, Button, Card, CategoryIcon, Field, Input, Textarea, Toggle, useAction, useToast } from "@/components/ui";
import { DatePicker, TimeSlotPicker } from "@/components/dashboard/Views";
import { useSelectedCity } from "@/components/search/SearchBox";
import { SelectField } from "@/components/forms/SelectField";
import { FileDropzone } from "@/components/forms/FileDropzone";
import { CITIES, computeBreakdown, formatDuration, formatPrice, MAX_ATTACHMENTS, TIME_SLOTS, type Attachment, type FormQuestion } from "@/lib/domain";
import { QuestionField } from "./QuestionField";

interface Props {
  service: { slug: string; title: string; categoryName: string; basePrice: number; durationMinutes: number; questions: FormQuestion[] };
  addresses: { id: number; title: string; city: string; region: string; addressLine: string; details: string; isDefault: boolean }[];
  phoneVerified: boolean;
}

type NewAddress = { title: string; city: string; region: string; addressLine: string; details: string; saveAddress: boolean };

const STEPS = ["شرح مشکل", "نشانی", "زمان قرار", "تأیید و ثبت"];

/** Maps a server validation key to the wizard step that contains the field. */
function stepForError(key: string, questionKeys: string[]): number {
  if (key === "address" || key === "addressLine" || key === "title" || key === "addressId") return 1;
  if (key === "scheduledDate" || key === "timeSlot") return 2;
  if (questionKeys.includes(key)) return 0;
  return 3;
}

/** Current Tehran date and hour, used to disable slots that have already started today. */
function tehranNow(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function BookingWizard({ service, addresses, phoneVerified }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { runStrict, run, busy } = useAction();
  const [selectedCity] = useSelectedCity();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressMode, setAddressMode] = useState<"saved" | "new">(addresses.length ? "saved" : "new");
  const [addressId, setAddressId] = useState<number | null>(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null);
  const [newAddr, setNewAddr] = useState<NewAddress>({ title: "منزل", city: "تهران", region: CITIES[0]!.regions[0]!, addressLine: "", details: "", saveAddress: true });
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ code: string; percent: number; discount: number } | null>(null);

  const regionOptions = CITIES.find((c) => c.name === newAddr.city)?.regions ?? [];
  const estimate = useMemo(() => computeBreakdown({ offerPrice: service.basePrice, urgent }), [service.basePrice, urgent]);
  const questionKeys = service.questions.map((q) => q.key);
  const now = useMemo(() => tehranNow(), []);
  const disabledSlots: string[] = date === now.date ? TIME_SLOTS.filter((s) => Number(s.id.split("-")[0]) <= now.hour).map((s) => s.id) : [];

  // Start the new-address city from the header city until the user edits the address.
  useEffect(() => {
    setNewAddr((prev) => {
      if (prev.addressLine) return prev;
      const region = CITIES.find((c) => c.name === selectedCity)?.regions[0] ?? prev.region;
      return { ...prev, city: selectedCity, region };
    });
  }, [selectedCity]);

  // A slot that became past (or was invalid for the chosen day) is cleared.
  useEffect(() => {
    if (slot && disabledSlots.includes(slot)) setSlot("");
  }, [slot, disabledSlots]);

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      for (const q of service.questions) {
        if (q.type === "file") continue;
        const v = answers[q.key];
        if (q.required && (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))) e[q.key] = `تکمیل «${q.label}» الزامی است`;
      }
    }
    if (s === 1 && addressMode === "saved" && !addressId) e.address = "یک نشانی انتخاب کنید";
    if (s === 1 && addressMode === "new") {
      if (newAddr.title.trim().length < 2) e.title = "عنوان نشانی را وارد کنید";
      if (newAddr.addressLine.trim().length < 5) e.addressLine = "نشانی کامل را وارد کنید";
    }
    if (s === 2) {
      if (!date) e.scheduledDate = "تاریخ را انتخاب کنید";
      if (!slot) e.timeSlot = "بازه زمانی را انتخاب کنید";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function checkCoupon() {
    const r = await run("cp", () => apiRequest<{ code: string; percent: number; discount: number }>("POST", "/coupons/validate", { code: coupon, amount: service.basePrice }));
    if (r) {
      setCouponInfo(r);
      toast.success(`کد ${r.percent}٪ تخفیف معتبر است`);
    }
  }

  async function submit() {
    setErrors({});
    const body = {
      serviceSlug: service.slug,
      answers,
      attachments,
      addressId: addressMode === "saved" ? addressId : null,
      address: addressMode === "new" ? { ...newAddr, isDefault: false } : null,
      scheduledDate: date,
      timeSlot: slot,
      urgent,
      flexible,
      notes,
      couponCode: coupon || null,
      saveAddress: addressMode === "new" && newAddr.saveAddress,
    };
    try {
      const res = await runStrict("submit", () => apiRequest<{ id: number; code: string }>("POST", "/orders", body), "درخواست شما ثبت شد");
      router.push(`/booking/order/${res.id}`);
    } catch (err) {
      const fieldErrors = err instanceof ApiClientError ? err.fieldErrors ?? {} : {};
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
        setStep(stepForError(Object.keys(fieldErrors)[0] ?? "", questionKeys));
      }
      toast.error(err instanceof Error ? err.message : "ثبت سفارش انجام نشد");
    }
  }

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const cityOptions = CITIES.map((c) => ({ value: c.name, label: c.name, description: `${c.regions.length} منطقه` }));
  const regionSelectOptions = regionOptions.map((r) => ({ value: r, label: r }));

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <nav aria-label="مراحل ثبت سفارش" className="mb-8 overflow-x-auto">
        <ol className="flex min-w-max items-center gap-2 pb-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`grid size-8 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${i <= step ? "bg-brand text-white" : "bg-slate-200 text-muted"}`} aria-current={i === step ? "step" : undefined}>
                {i < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className={`text-sm ${i === step ? "font-bold text-ink" : "text-muted"}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-line" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Card className="space-y-6 p-5 sm:p-8">
          {!phoneVerified && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              برای ثبت نهایی سفارش باید شماره موبایل خود را تأیید کنید. <Link href="/account/profile" className="font-semibold underline">تأیید شماره</Link>
            </p>
          )}

          {step === 0 && (
            <section className="space-y-6" aria-labelledby="step-0">
              <h2 id="step-0" className="text-xl font-bold">شرح مشکل یا کار</h2>
              {service.questions.map((q) => (
                <QuestionField key={q.key} q={q} value={answers[q.key]} error={errors[q.key]} onChange={(v) => setAnswers({ ...answers, [q.key]: v })} />
              ))}
              <FileDropzone label="تصاویر (اختیاری)" value={attachments} onChange={setAttachments} maxFiles={MAX_ATTACHMENTS} hint={`حداکثر ${MAX_ATTACHMENTS} تصویر؛ هر تصویر تا ۱٫۵ مگابایت (JPG، PNG، WebP)`} />
              <Field label="توضیحات تکمیلی" htmlFor="notes" hint="حداکثر ۵۰۰ کاراکتر">
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="هر نکته‌ای که متخصص باید بداند" />
              </Field>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-6" aria-labelledby="step-1">
              <h2 id="step-1" className="text-xl font-bold">نشانی محل خدمت</h2>
              {addresses.length > 0 && (
                <div className="inline-flex rounded-2xl bg-slate-100 p-1" role="group" aria-label="روش انتخاب نشانی">
                  {(["saved", "new"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={addressMode === mode}
                      onClick={() => setAddressMode(mode)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${addressMode === mode ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"}`}
                    >
                      {mode === "saved" ? "نشانی‌های ذخیره‌شده" : "نشانی جدید"}
                    </button>
                  ))}
                </div>
              )}
              {addressMode === "saved" ? (
                <div className="grid gap-3" role="radiogroup" aria-label="نشانی">
                  {addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={addressId === a.id}
                      onClick={() => setAddressId(a.id)}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-start transition duration-300 ${addressId === a.id ? "border-brand bg-brand-soft shadow-card" : "border-line hover:border-brand/40"}`}
                    >
                      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${addressId === a.id ? "border-brand bg-brand" : "border-slate-300"}`}>
                        {addressId === a.id && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          <MapPin className="size-4 text-brand" aria-hidden="true" />
                          {a.title} {a.isDefault && <Badge tone="brand">پیش‌فرض</Badge>}
                        </span>
                        <span className="mt-1 block text-sm leading-7 text-muted">{a.city}، {a.region}، {a.addressLine}</span>
                      </span>
                    </button>
                  ))}
                  {errors.address && <p className="text-sm text-danger">{errors.address}</p>}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="عنوان" htmlFor="na-title" required error={errors.title}>
                    <Input id="na-title" value={newAddr.title} onChange={(e) => setNewAddr({ ...newAddr, title: e.target.value })} error={errors.title} placeholder="منزل، دفتر کار" />
                  </Field>
                  <Field label="جزئیات (واحد، طبقه)" htmlFor="na-details">
                    <Input id="na-details" value={newAddr.details} onChange={(e) => setNewAddr({ ...newAddr, details: e.target.value })} placeholder="مثلاً واحد ۴" />
                  </Field>
                  <SelectField
                    id="na-city"
                    label="شهر"
                    required
                    searchable
                    value={newAddr.city}
                    options={cityOptions}
                    onChange={(city) => setNewAddr({ ...newAddr, city, region: CITIES.find((c) => c.name === city)?.regions[0] ?? "" })}
                  />
                  <SelectField id="na-region" label="منطقه" required value={newAddr.region} options={regionSelectOptions} onChange={(region) => setNewAddr({ ...newAddr, region })} />
                  <div className="sm:col-span-2">
                    <Field label="نشانی کامل" htmlFor="na-line" required error={errors.addressLine} hint="خیابان، کوچه و پلاک">
                      <Textarea id="na-line" value={newAddr.addressLine} onChange={(e) => setNewAddr({ ...newAddr, addressLine: e.target.value })} error={errors.addressLine} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-3 text-sm sm:col-span-2">
                    <Toggle checked={newAddr.saveAddress} onChange={(v) => setNewAddr({ ...newAddr, saveAddress: v })} label="ذخیره نشانی" />
                    ذخیره این نشانی برای سفارش‌های بعدی
                  </label>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6" aria-labelledby="step-2">
              <h2 id="step-2" className="text-xl font-bold">زمان قرار</h2>
              <div className="space-y-3">
                <p className="text-sm font-medium">تاریخ</p>
                <DatePicker value={date} onChange={setDate} />
                {errors.scheduledDate && <p className="text-sm text-danger">{errors.scheduledDate}</p>}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">بازه زمانی</p>
                <TimeSlotPicker value={slot} onChange={setSlot} disabledIds={disabledSlots} />
                {disabledSlots.length > 0 && <p className="text-xs text-muted">بازه‌های گذشته امروز غیرفعال هستند.</p>}
                {errors.timeSlot && <p className="text-sm text-danger">{errors.timeSlot}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4 text-sm transition-colors hover:border-brand/30">
                  <span>
                    <span className="block font-semibold">خدمت فوری</span>
                    <span className="text-xs text-muted">هزینه فوری‌سازی تقریباً {formatPrice(estimate.urgentFee)}</span>
                  </span>
                  <Toggle checked={urgent} onChange={setUrgent} label="خدمت فوری" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4 text-sm transition-colors hover:border-brand/30">
                  <span>
                    <span className="block font-semibold">انعطاف زمانی</span>
                    <span className="text-xs text-muted">اگر زمان پیشنهادی تغییر کرد، به من اطلاع دهید</span>
                  </span>
                  <Toggle checked={flexible} onChange={setFlexible} label="انعطاف زمانی" />
                </label>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6" aria-labelledby="step-3">
              <h2 id="step-3" className="text-xl font-bold">بررسی و ثبت درخواست</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">خدمت</dt><dd className="mt-1 font-semibold">{service.title}</dd></div>
                <div><dt className="text-muted">دسته‌بندی</dt><dd className="mt-1 font-semibold">{service.categoryName}</dd></div>
                <div><dt className="text-muted">زمان قرار</dt><dd className="mt-1 font-semibold">{date || "—"} · {TIME_SLOTS.find((t) => t.id === slot)?.label ?? "—"}</dd></div>
                <div><dt className="text-muted">مدت تقریبی</dt><dd className="mt-1 font-semibold">{formatDuration(service.durationMinutes)}</dd></div>
                <div className="sm:col-span-2">
                  <dt className="text-muted">نشانی</dt>
                  <dd className="mt-1 font-semibold">{addressMode === "saved" ? `${selectedAddress?.city ?? ""}، ${selectedAddress?.region ?? ""}، ${selectedAddress?.addressLine ?? ""}` : `${newAddr.city}، ${newAddr.region}، ${newAddr.addressLine}`}</dd>
                </div>
              </dl>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="کد تخفیف (اختیاری)" htmlFor="coupon" hint="مثال: WELCOME10" error={errors.couponCode}>
                  <Input
                    id="coupon"
                    dir="ltr"
                    value={coupon}
                    onChange={(e) => {
                      setCoupon(e.target.value.toUpperCase());
                      setCouponInfo(null);
                    }}
                    error={errors.couponCode}
                    placeholder="کد تخفیف"
                  />
                </Field>
                <Button variant="outline" disabled={!coupon} loading={busy} onClick={checkCoupon} icon={<Tag className="size-4" aria-hidden="true" />}>
                  بررسی کد
                </Button>
              </div>
              {couponInfo && <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-strong">کد {couponInfo.code} معتبر است؛ {couponInfo.percent}٪ تخفیف پس از انتخاب متخصص اعمال می‌شود.</p>}
              <Card className="space-y-3 bg-canvas p-5 text-sm">
                <p className="font-semibold">برآورد اولیه</p>
                <p className="leading-7 text-muted">مبلغ نهایی بر اساس پیشنهاد متخصصی که انتخاب می‌کنید مشخص می‌شود. کارمزد خدمات ۳٪ و هزینه فوری (در صورت انتخاب) ۲۰٪ است.</p>
                <p className="flex justify-between font-bold"><span>شروع قیمت خدمت</span><span>{formatPrice(service.basePrice)}</span></p>
              </Card>
            </section>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)} icon={<ChevronLeft className="size-4 rotate-180" aria-hidden="true" />}>
              مرحله قبل
            </Button>
            {step < 3 ? (
              <Button onClick={() => validateStep(step) && setStep(step + 1)} icon={<ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />}>
                مرحله بعد
              </Button>
            ) : (
              <Button size="lg" loading={busy} disabled={!phoneVerified} onClick={submit}>
                ثبت درخواست و دریافت پیشنهاد
              </Button>
            )}
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-mint/50 text-brand">
                <CategoryIcon name="wrench" className="size-6" />
              </span>
              <div>
                <p className="text-xs text-muted">{service.categoryName}</p>
                <p className="font-bold">{service.title}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">شروع قیمت: <span className="font-semibold text-ink">{formatPrice(service.basePrice)}</span></p>
          </Card>
          <p className="px-2 text-xs leading-6 text-muted">پس از ثبت، درخواست برای متخصصان تأییدشده منطقه ارسال می‌شود و پیشنهادها در صفحه پیگیری سفارش نمایش داده می‌شوند.</p>
        </aside>
      </div>
    </main>
  );
}
