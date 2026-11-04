"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiClientError, Button, Card, Field, Input, Textarea, Toggle, useToast } from "@/components/ui";
import { CITIES, normalizeFa } from "@/lib/domain";

type Tree = { id: number; name: string; children: { id: number; name: string }[] }[];
type DocEntry = { name: string; dataUrl?: string };

const DAYS = [
  { id: "sat", label: "شنبه" },
  { id: "sun", label: "یکشنبه" },
  { id: "mon", label: "دوشنبه" },
  { id: "tue", label: "سه‌شنبه" },
  { id: "wed", label: "چهارشنبه" },
  { id: "thu", label: "پنجشنبه" },
  { id: "fri", label: "جمعه" },
];
const DOC_TYPES = [
  { id: "national_card", label: "تصویر کارت ملی", required: true },
  { id: "certificate", label: "تصویر مدرک یا گواهی تخصصی", required: true },
  { id: "license", label: "پروانه کسب (اختیاری)", required: false },
];
const MAX_DOC_BYTES = 1_500_000;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function BecomeProPage() {
  const router = useRouter();
  const toast = useToast();
  const [tree, setTree] = useState<Tree>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, DocEntry>>({});
  const [f, setF] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    headline: "",
    bio: "",
    categoryIds: [] as number[],
    skills: "",
    experienceYears: "3",
    serviceAreas: [] as string[],
    workingDays: ["sat", "sun", "mon", "tue", "wed", "thu"] as string[],
    workingFrom: "08:00",
    workingTo: "20:00",
    minPrice: "150000",
    hourlyRate: "120000",
    acceptTerms: false,
  });

  useEffect(() => {
    apiRequest<Tree>("GET", "/catalog/categories")
      .then(setTree)
      .catch(() => setTree([]));
  }, []);

  const leaves = tree.flatMap((p) => p.children.map((c) => ({ ...c, parent: p.name })));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function onDoc(typeId: string, file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("فقط تصویر JPG، PNG یا WebP مجاز است");
    if (file.size > MAX_DOC_BYTES) return toast.error("حجم هر مدرک حداکثر ۱٫۵ مگابایت است");
    const dataUrl = await readFile(file);
    setDocs((prev) => ({ ...prev, [typeId]: { name: file.name, dataUrl } }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const documents = DOC_TYPES.filter((d) => docs[d.id]?.dataUrl).map((d) => ({ type: d.id, name: docs[d.id]!.name, dataUrl: docs[d.id]!.dataUrl }));
    const missing: Record<string, string> = {};
    for (const d of DOC_TYPES) if (d.required && !docs[d.id]?.dataUrl) missing[`doc-${d.id}`] = `بارگذاری «${d.label}» الزامی است`;
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/pro/register", {
        fullName: f.fullName,
        phone: normalizeFa(f.phone),
        email: f.email || null,
        password: f.password,
        headline: f.headline,
        bio: f.bio,
        categoryIds: f.categoryIds,
        skills: f.skills.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
        experienceYears: Number(f.experienceYears),
        serviceAreas: f.serviceAreas,
        workingDays: f.workingDays,
        workingFrom: f.workingFrom,
        workingTo: f.workingTo,
        minPrice: Number(f.minPrice),
        hourlyRate: Number(f.hourlyRate),
        documents,
        acceptTerms: true,
      });
      toast.success("درخواست همکاری ثبت شد؛ پس از بررسی مدارک، نتیجه را خواهید دید.");
      router.push("/pro");
      router.refresh();
    } catch (err) {
      const fieldErrors = err instanceof ApiClientError ? err.fieldErrors ?? {} : {};
      setErrors({ form: err instanceof Error ? err.message : "ثبت درخواست انجام نشد", ...fieldErrors });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <div className="mb-8">
        <p className="text-sm font-medium text-brand">همکاری با آرنا</p>
        <h1 className="mt-2 text-3xl font-extrabold">ثبت‌نام به عنوان متخصص</h1>
        <p className="mt-3 leading-8 text-muted">
          مدارک شما بررسی می‌شود و تنها پس از تأیید مدیریت، امکان ارسال پیشنهاد به مشتریان فعال می‌شود. تأیید خودکار انجام نمی‌شود.
        </p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-6">
        <Card className="grid gap-5 p-6 md:grid-cols-2">
          <h2 className="font-bold md:col-span-2">اطلاعات حساب</h2>
          <Field label="نام و نام خانوادگی" htmlFor="bp-name" required error={errors.fullName}>
            <Input id="bp-name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} error={errors.fullName} />
          </Field>
          <Field label="شماره موبایل" htmlFor="bp-phone" required error={errors.phone}>
            <Input id="bp-phone" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
          </Field>
          <Field label="ایمیل (اختیاری)" htmlFor="bp-email" error={errors.email}>
            <Input id="bp-email" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
          </Field>
          <Field label="رمز عبور" htmlFor="bp-pass" required error={errors.password} hint="حداقل ۸ کاراکتر، شامل حرف و عدد">
            <Input id="bp-pass" type="password" dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errors.password} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-6">
          <h2 className="font-bold">تخصص و سوابق</h2>
          <Field label="عنوان تخصصی" htmlFor="bp-head" required error={errors.headline}>
            <Input id="bp-head" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} error={errors.headline} placeholder="مثلاً متخصص نشتی و لوله‌کشی ساختمان" />
          </Field>
          <Field label="معرفی کوتاه" htmlFor="bp-bio" required error={errors.bio}>
            <Textarea id="bp-bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} error={errors.bio} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">دسته‌بندی‌های خدماتی <span className="text-danger">*</span></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {leaves.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-mint/20">
                  <input type="checkbox" className="accent-brand" checked={f.categoryIds.includes(c.id)} onChange={() => setF({ ...f, categoryIds: toggle(f.categoryIds, c.id) })} />
                  {c.name} <span className="text-xs text-muted">({c.parent})</span>
                </label>
              ))}
            </div>
            {errors.categoryIds && <p className="mt-2 text-xs text-danger">{errors.categoryIds}</p>}
          </fieldset>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="مهارت‌ها (با ویرگول)" htmlFor="bp-skills" required error={errors.skills}>
              <Input id="bp-skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} error={errors.skills} />
            </Field>
            <Field label="سابقه کار (سال)" htmlFor="bp-exp">
              <Input id="bp-exp" dir="ltr" inputMode="numeric" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value.replace(/\D/g, "") })} />
            </Field>
          </div>
        </Card>

        <Card className="grid gap-5 p-6 md:grid-cols-2">
          <h2 className="font-bold md:col-span-2">مناطق، زمان و قیمت</h2>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-medium">شهرهای خدمت <span className="text-danger">*</span></legend>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <label key={c.slug} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-mint/30">
                  <input type="checkbox" className="accent-brand" checked={f.serviceAreas.includes(c.name)} onChange={() => setF({ ...f, serviceAreas: toggle(f.serviceAreas, c.name) })} />
                  {c.name}
                </label>
              ))}
            </div>
            {errors.serviceAreas && <p className="mt-2 text-xs text-danger">{errors.serviceAreas}</p>}
          </fieldset>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-medium">روزهای کاری</legend>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label key={d.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-mint/30">
                  <input type="checkbox" className="accent-brand" checked={f.workingDays.includes(d.id)} onChange={() => setF({ ...f, workingDays: toggle(f.workingDays, d.id) })} />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="ساعت شروع" htmlFor="bp-from">
            <Input id="bp-from" type="time" dir="ltr" value={f.workingFrom} onChange={(e) => setF({ ...f, workingFrom: e.target.value })} />
          </Field>
          <Field label="ساعت پایان" htmlFor="bp-to">
            <Input id="bp-to" type="time" dir="ltr" value={f.workingTo} onChange={(e) => setF({ ...f, workingTo: e.target.value })} />
          </Field>
          <Field label="حداقل قیمت (تومان)" htmlFor="bp-min">
            <Input id="bp-min" dir="ltr" inputMode="numeric" value={f.minPrice} onChange={(e) => setF({ ...f, minPrice: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="نرخ ساعتی (تومان)" htmlFor="bp-hour">
            <Input id="bp-hour" dir="ltr" inputMode="numeric" value={f.hourlyRate} onChange={(e) => setF({ ...f, hourlyRate: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </Card>

        <Card className="grid gap-5 p-6">
          <h2 className="font-bold">مدارک تأیید هویت و تخصص</h2>
          <p className="text-sm leading-7 text-muted">تصویر واضح مدارک را بارگذاری کنید (JPG، PNG یا WebP، حداکثر ۱٫۵ مگابایت). مدارک فقط برای بررسی تیم آرنا استفاده می‌شود.</p>
          {DOC_TYPES.map((d) => {
            const entry = docs[d.id];
            const id = `doc-${d.id}`;
            return (
              <div key={d.id} className="space-y-2">
                <label htmlFor={id} className="block text-sm font-medium">
                  {d.label}
                  {d.required && <span className="ms-1 text-danger" aria-hidden="true">*</span>}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={errors[id] ? `${id}-error` : undefined} onChange={(e) => void onDoc(d.id, e.target.files?.[0])} className="max-w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-mint/50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-strong" />
                  {entry?.dataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.dataUrl} alt={`پیش‌نمایش ${d.label}`} className="h-16 w-24 rounded-lg border border-line object-cover" />
                  )}
                </div>
                {errors[id] && <p id={`${id}-error`} className="text-xs text-danger">{errors[id]}</p>}
              </div>
            );
          })}
          {errors.documents && <p className="text-sm text-danger">{errors.documents}</p>}
          <label className="flex items-start gap-3 text-sm">
            <Toggle checked={f.acceptTerms} onChange={(v) => setF({ ...f, acceptTerms: v })} label="پذیرش قوانین همکاری" />
            <span>قوانین همکاری و کارمزد ۱۵٪ آرنا را می‌پذیرم.</span>
          </label>
          {errors.form && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">{errors.form}</p>}
          <Button type="submit" size="lg" loading={busy} disabled={!f.acceptTerms}>ارسال درخواست همکاری</Button>
        </Card>
      </form>
    </main>
  );
}
