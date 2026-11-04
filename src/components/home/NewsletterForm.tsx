"use client";

import { useId, useState, type FormEvent } from "react";
import { apiRequest, ApiClientError, Button, Field, Input, useToast } from "@/components/ui";

/** Newsletter / promotional subscription. Stores the address in newsletter_subscribers. */
export function NewsletterForm() {
  const toast = useToast();
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await apiRequest("POST", "/newsletter", { email: email.trim() });
      setDone(true);
      toast.success("عضویت شما در خبرنامه ثبت شد");
    } catch (err) {
      const fieldError = err instanceof ApiClientError ? err.fieldErrors?.email : undefined;
      setError(fieldError ?? (err instanceof Error ? err.message : "ثبت عضویت انجام نشد"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
      <div className="grid items-center gap-6 rounded-3xl border border-line bg-surface p-6 md:grid-cols-2 md:p-10">
        <div>
          <h2 id={`${id}-title`} className="text-xl font-bold md:text-2xl">خبرنامه آرنا</h2>
          <p className="mt-2 leading-7 text-muted">پیشنهادهای فصلی، کدهای تخفیف و راهنمای نگهداری منزل را از طریق ایمیل دریافت کنید. هر زمان بخواهید می‌توانید لغو عضویت کنید.</p>
        </div>
        {done ? (
          <p role="status" className="rounded-xl bg-mint/40 p-4 text-sm font-semibold text-brand-strong">عضویت شما ثبت شد. ایمیل خوش‌آمدگویی به زودی ارسال می‌شود.</p>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <Field label="ایمیل" htmlFor={`${id}-email`} error={error}>
                <Input id={`${id}-email`} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} placeholder="name@example.com" />
              </Field>
            </div>
            <div className="sm:pt-7">
              <Button type="submit" loading={busy} disabled={email.trim().length < 5} fullWidth>عضویت</Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
