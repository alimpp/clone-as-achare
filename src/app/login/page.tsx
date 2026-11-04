"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, Button, Card, Field, Input, useToast } from "@/components/ui";
import { normalizeFa } from "@/lib/domain";
import { OtpInput } from "@/components/forms/OtpInput";

const DEMO = [
  { label: "مشتری نمونه", id: "09120000001", pass: "Demo1234" },
  { label: "متخصص نمونه", id: "09120000002", pass: "Demo1234" },
  { label: "مدیر سامانه", id: "09120000000", pass: "Admin1234" },
];

const ROLE_HOME: Record<string, string> = { customer: "/account", professional: "/pro", admin: "/admin" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "forgot" | "reset">(params.get("mode") === "forgot" ? "forgot" : "login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (identifier.trim().length < 3) return setErrors({ identifier: "شماره موبایل یا ایمیل را وارد کنید" });
    if (!password) return setErrors({ password: "رمز عبور را وارد کنید" });
    setBusy(true);
    try {
      const res = await apiRequest<{ user: { role: string } }>("POST", "/auth/login", { identifier: normalizeFa(identifier), password });
      toast.success("خوش آمدید");
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : ROLE_HOME[res.user.role] ?? "/account");
      router.refresh();
    } catch (err) {
      setErrors({ form: (err as Error).message, ...((err as { fieldErrors?: Record<string, string> }).fieldErrors ?? {}) });
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const res = await apiRequest<{ devCode: string | null }>("POST", "/auth/otp", { phone: normalizeFa(phone) });
      setDevCode(res.devCode);
      setMode("reset");
      toast.info("کد بازیابی ارسال شد");
    } catch (err) {
      setErrors({ phone: (err as Error).message, ...((err as { fieldErrors?: Record<string, string> }).fieldErrors ?? {}) });
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await apiRequest("POST", "/auth/reset-password", { phone: normalizeFa(phone), code, password: newPassword });
      toast.success("رمز عبور تغییر کرد. وارد شوید.");
      setMode("login");
      setIdentifier(phone);
      setPassword("");
    } catch (err) {
      setErrors({ form: (err as Error).message, ...((err as { fieldErrors?: Record<string, string> }).fieldErrors ?? {}) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="grid min-h-[80vh] place-items-center px-4 py-12">
      <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-brand">خوش برگشتید</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight">هر سفارش، یک قدم تا پایان کار</h1>
          <p className="mt-4 max-w-md leading-8 text-muted">وضعیت سفارش‌ها، پیشنهادها، گفتگو با متخصص و پرداخت‌ها را در یک حساب کاربری مدیریت کنید.</p>
        </div>
        <Card className="w-full space-y-6 p-7 shadow-lift md:p-9">
          <div className="flex gap-2 rounded-xl bg-slate-100 p-1" role="tablist">
            <button role="tab" aria-selected={mode !== "forgot" && mode !== "reset"} onClick={() => setMode("login")} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${mode === "login" ? "bg-surface shadow-sm text-brand" : "text-muted"}`}>ورود</button>
            <button role="tab" aria-selected={mode === "forgot" || mode === "reset"} onClick={() => setMode("forgot")} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${mode === "forgot" || mode === "reset" ? "bg-surface shadow-sm text-brand" : "text-muted"}`}>فراموشی رمز</button>
          </div>

          {mode === "login" && (
            <form className="space-y-5" onSubmit={login} noValidate>
              <Field label="شماره موبایل یا ایمیل" htmlFor="l-id" required error={errors.identifier}><Input id="l-id" dir="ltr" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={errors.identifier} placeholder="09121234567" /></Field>
              <Field label="رمز عبور" htmlFor="l-pass" required error={errors.password}><Input id="l-pass" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} /></Field>
              {errors.form && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">{errors.form}</p>}
              <Button type="submit" fullWidth size="lg" loading={busy}>ورود به حساب</Button>
              <p className="text-center text-sm text-muted">حساب ندارید؟ <Link href="/register" className="font-semibold text-brand hover:underline">ثبت‌نام</Link></p>
              <div className="rounded-xl border border-dashed border-line p-4">
                <p className="mb-3 text-xs font-semibold text-muted">حساب‌های نمایشی (حالت توسعه)</p>
                <div className="flex flex-wrap gap-2">{DEMO.map((d) => <button key={d.id} type="button" onClick={() => { setIdentifier(d.id); setPassword(d.pass); }} className="rounded-full border border-line px-3 py-1.5 text-xs transition hover:border-brand/40 hover:text-brand">{d.label}</button>)}</div>
              </div>
            </form>
          )}

          {mode === "forgot" && (
            <form className="space-y-5" onSubmit={requestCode} noValidate>
              <p className="text-sm leading-7 text-muted">شماره موبایل حساب خود را وارد کنید تا کد بازیابی برای شما صادر شود.</p>
              <Field label="شماره موبایل" htmlFor="f-phone" required error={errors.phone}><Input id="f-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} placeholder="09121234567" /></Field>
              <Button type="submit" fullWidth loading={busy}>دریافت کد بازیابی</Button>
            </form>
          )}

          {mode === "reset" && (
            <form className="space-y-5" onSubmit={reset} noValidate>
              {devCode && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">حالت توسعه — کد بازیابی: <span dir="ltr" className="font-mono font-bold">{devCode}</span></p>}
              <Field label="کد ۶ رقمی" htmlFor="r-code" required error={errors.code}><OtpInput value={code} onChange={setCode} error={errors.code} /></Field>
              <Field label="رمز عبور جدید" htmlFor="r-pass" required error={errors.password} hint="حداقل ۸ کاراکتر، شامل حرف و عدد"><Input id="r-pass" type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={errors.password} /></Field>
              {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
              <Button type="submit" fullWidth loading={busy}>تغییر رمز عبور</Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
