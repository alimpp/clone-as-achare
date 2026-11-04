"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, Button, Card, Field, Input, Toggle, useToast } from "@/components/ui";
import { normalizeFa } from "@/lib/domain";
import { OtpInput } from "@/components/forms/OtpInput";

type Errors = Record<string, string>;

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", password: "", acceptTerms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const res = await apiRequest<{ devCode: string }>("POST", "/auth/register", { ...form, phone: normalizeFa(form.phone), email: form.email || null, acceptTerms: true });
      setDevCode(res.devCode);
      toast.success("حساب ساخته شد. شماره موبایل خود را تأیید کنید.");
    } catch (err) {
      setErrors({ form: (err as Error).message, ...((err as { fieldErrors?: Errors }).fieldErrors ?? {}) });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await apiRequest("POST", "/auth/verify-phone", { code });
      toast.success("شماره موبایل تأیید شد");
      router.push("/account");
      router.refresh();
    } catch (err) {
      setErrors({ code: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="grid min-h-[80vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-lg space-y-6 p-7 shadow-lift md:p-9">
        {!devCode ? (
          <form className="space-y-5" onSubmit={submit} noValidate>
            <div><h1 className="text-2xl font-extrabold">ساخت حساب مشتری</h1><p className="mt-2 text-sm text-muted">برای ثبت سفارش و پیگیری خدمات، حساب بسازید.</p></div>
            <Field label="نام و نام خانوادگی" htmlFor="r-name" required error={errors.fullName}><Input id="r-name" autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={errors.fullName} /></Field>
            <Field label="شماره موبایل" htmlFor="r-phone" required error={errors.phone} hint="برای ورود و تأیید حساب استفاده می‌شود"><Input id="r-phone" dir="ltr" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} placeholder="09121234567" /></Field>
            <Field label="ایمیل (اختیاری)" htmlFor="r-email" error={errors.email}><Input id="r-email" dir="ltr" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} /></Field>
            <Field label="رمز عبور" htmlFor="r-pass" required error={errors.password} hint="حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد"><Input id="r-pass" type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} /></Field>
            <label className="flex items-start gap-3 text-sm leading-6"><Toggle checked={form.acceptTerms} onChange={(v) => setForm({ ...form, acceptTerms: v })} label="پذیرش قوانین" /><span>با <Link href="/" className="font-semibold text-brand">قوانین و مقررات آرنا</Link> موافقم.</span></label>
            {errors.acceptTerms && <p className="text-sm text-danger">{errors.acceptTerms}</p>}
            {errors.form && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">{errors.form}</p>}
            <Button type="submit" fullWidth size="lg" loading={busy} disabled={!form.acceptTerms}>ساخت حساب</Button>
            <p className="text-center text-sm text-muted">حساب دارید؟ <Link href="/login" className="font-semibold text-brand">ورود</Link> · <Link href="/become-a-pro" className="font-semibold text-brand">ثبت‌نام متخصص</Link></p>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={verify} noValidate>
            <div><h1 className="text-2xl font-extrabold">تأیید شماره موبایل</h1><p className="mt-2 text-sm leading-7 text-muted">کد ۶ رقمی ارسال‌شده به شماره شما را وارد کنید.</p></div>
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">حالت توسعه — کد آزمایشی: <span dir="ltr" className="font-mono font-bold">{devCode}</span></p>
            <Field label="کد تأیید" htmlFor="v-code" required error={errors.code}><OtpInput value={code} onChange={setCode} error={errors.code} /></Field>
            <Button type="submit" fullWidth size="lg" loading={busy}>تأیید و ورود</Button>
            <button type="button" className="w-full text-center text-sm text-muted hover:text-brand" onClick={() => router.push("/account")}>بعداً تأیید می‌کنم</button>
          </form>
        )}
      </Card>
    </main>
  );
}
