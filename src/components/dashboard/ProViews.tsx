"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest, ApiClientError, Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Spinner, Stars, StatCard, Tabs, Textarea, Toggle, useAction, useApi, useConfirm, useToast } from "@/components/ui";
import { ApiBlock, Chat, DashShell, NotificationsSection, readAsDataUrl, StatusBadge, TransactionTable, type ViewUser } from "./Views";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { CITIES, faNum, formatDate, formatPrice, formatRelative, PRO_VERIFICATION_LABELS, TIME_SLOTS, type OrderStatus, type ProVerificationStatus, type TransactionType } from "@/lib/domain";

const DAYS = [
  { id: "sat", label: "شنبه" },
  { id: "sun", label: "یکشنبه" },
  { id: "mon", label: "دوشنبه" },
  { id: "tue", label: "سه‌شنبه" },
  { id: "wed", label: "چهارشنبه" },
  { id: "thu", label: "پنجشنبه" },
  { id: "fri", label: "جمعه" },
];
const MAX_PORTFOLIO = 12;

const csv = (s: string) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const errorsFrom = (e: unknown): Record<string, string> => {
  if (e instanceof ApiClientError) return { ...(e.fieldErrors ?? {}), form: e.message };
  return { form: e instanceof Error ? e.message : "خطای ناشناخته" };
};

type ProProfileResponse = {
  user: { id: string; fullName: string; phone: string; email: string | null; avatarUrl: string | null };
  profile: {
    headline: string;
    bio: string;
    experienceYears: number;
    skills: string[];
    serviceAreas: string[];
    categoryIds: number[];
    workingHours: { days: string[]; from: string; to: string };
    pricing: { minPrice: number; hourlyRate: number; visitFee: number };
    portfolio: { title: string; description: string }[];
    verificationStatus: ProVerificationStatus;
    verificationNotes: string;
    isAvailable: boolean;
    completedJobs: number;
    rating: number;
    reviewsCount: number;
  };
  availableCategories: { id: number; name: string; parentName: string }[];
};

// =====================================================================
// Router
// =====================================================================

export function ProDashboard({ user, section }: { user: ViewUser; section: string[] }) {
  const profile = useApi<ProProfileResponse>("/pro/profile");
  const [head, arg] = section;

  if (profile.loading && !profile.data) return <DashShell user={user} title="پنل متخصص"><Spinner /></DashShell>;
  if (profile.error) return <DashShell user={user} title="پنل متخصص"><ErrorState message={profile.error} onRetry={profile.reload} /></DashShell>;
  if (!profile.data) return null;

  const status = profile.data.profile.verificationStatus;
  const alwaysOpen = head === "profile" || head === "notifications";
  if (status !== "verified" && !alwaysOpen) {
    return (
      <DashShell user={user} title="وضعیت همکاری" subtitle="دسترسی کامل به درخواست‌ها پس از تأیید مدارک فعال می‌شود.">
        <Card className="space-y-4 p-8 text-center">
          <h2 className="text-xl font-bold">{PRO_VERIFICATION_LABELS[status]}</h2>
          <p className="mx-auto max-w-xl leading-8 text-muted">
            {status === "rejected"
              ? `درخواست شما رد شد. ${profile.data.profile.verificationNotes || "برای جزئیات با پشتیبانی تماس بگیرید."}`
              : "مدارک شما در صف بررسی تیم آرنا قرار دارد. پس از تأیید، می‌توانید به درخواست‌های مشتریان پیشنهاد دهید."}
          </p>
          <Button href="/pro/profile" variant="outline">مشاهده و ویرایش پروفایل</Button>
        </Card>
      </DashShell>
    );
  }

  switch (head) {
    case undefined:
      return <ProOverview user={user} />;
    case "requests":
      return <ProRequests user={user} />;
    case "jobs":
      return <ProJobs user={user} />;
    case "calendar":
      return <ProCalendar user={user} />;
    case "earnings":
      return <ProEarnings user={user} />;
    case "reviews":
      return <ProReviews user={user} />;
    case "profile":
      return <ProProfileForm user={user} data={profile.data} reload={profile.reload} />;
    case "messages":
      return (
        <DashShell user={user} title="پیام‌ها" subtitle="گفتگو با مشتری مربوط به هر سفارش.">
          <Chat orderId={arg ? Number(arg) : null} ownRole="professional" />
        </DashShell>
      );
    case "notifications":
      return <NotificationsSection user={user} />;
    default:
      return <EmptyState title="صفحه یافت نشد" />;
  }
}

// =====================================================================
// Overview
// =====================================================================

type ProDashData = {
  stats: { newRequests: number; activeJobs: number; completedJobs: number; available: number; pending: number; rating: number; reviewsCount: number };
  upcoming: { id: number; code: string; status: OrderStatus; serviceTitle: string; city: string; scheduledAt: string; timeSlot: string }[];
  recentReviews: { rating: number; comment: string; author: string; createdAt: string }[];
};

function ProOverview({ user }: { user: ViewUser }) {
  const dash = useApi<ProDashData>("/pro/dashboard");
  return (
    <DashShell user={user} title={`سلام ${user.fullName.split(" ")[0]}`} subtitle="درخواست‌های جدید، کارهای در جریان و درآمد خود را اینجا دنبال کنید.">
      <ApiBlock state={dash}>
        {(data) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="درخواست‌های جدید" value={faNum(data.stats.newRequests)} icon="file" />
              <StatCard label="کارهای فعال" value={faNum(data.stats.activeJobs)} icon="briefcase" tone="sky" />
              <StatCard label="موجودی قابل برداشت" value={formatPrice(data.stats.available)} icon="banknote" tone="amber" hint={`در انتظار تکمیل: ${formatPrice(data.stats.pending)}`} />
              <StatCard label="امتیاز کل" value={`${faNum(data.stats.rating.toFixed(1))} از ۵`} icon="star" tone="rose" hint={`${faNum(data.stats.reviewsCount)} نظر · ${faNum(data.stats.completedJobs)} سفارش`} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">کارهای پیش رو</h2><Link href="/pro/jobs" className="text-sm text-brand">همه کارها</Link></div>
                {data.upcoming.length === 0 ? (
                  <EmptyState icon="briefcase" title="کار فعالی ندارید" description="با ارسال پیشنهاد به درخواست‌های جدید، کار دریافت کنید." action={<Button href="/pro/requests" size="sm">مشاهده درخواست‌ها</Button>} />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.upcoming.map((j) => (
                      <li key={j.id} className="flex items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{j.serviceTitle}</p>
                          <p className="text-xs text-muted">{j.code} · {formatDate(j.scheduledAt)} · {TIME_SLOTS.find((t) => t.id === j.timeSlot)?.label} · {j.city}</p>
                        </div>
                        <StatusBadge status={j.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-6">
                <h2 className="mb-4 font-bold">آخرین نظرات</h2>
                {data.recentReviews.length === 0 ? (
                  <p className="text-sm text-muted">هنوز نظری ثبت نشده است.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.recentReviews.map((r, i) => (
                      <li key={i} className="rounded-xl bg-canvas p-4">
                        <Stars value={r.rating} size="size-3.5" />
                        <p className="mt-2 text-sm leading-6">{r.comment}</p>
                        <p className="mt-2 text-xs text-muted">{r.author} · {formatRelative(r.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
// Requests and offers
// =====================================================================

function ProRequests({ user }: { user: ViewUser }) {
  const [tab, setTab] = useState("open");
  return (
    <DashShell user={user} title="درخواست‌ها و پیشنهادها" subtitle="درخواست‌های جدید در حوزه و منطقه شما و وضعیت پیشنهادهایی که ارسال کرده‌اید.">
      <Tabs items={[{ value: "open", label: "درخواست‌های باز" }, { value: "mine", label: "پیشنهادهای من" }]} value={tab} onChange={setTab} />
      {tab === "open" ? <OpenRequests /> : <MyOffers />}
    </DashShell>
  );
}

type RequestItem = {
  id: number;
  code: string;
  serviceTitle: string;
  city: string;
  region: string;
  addressLine: string;
  answers: Record<string, unknown>;
  notes: string;
  urgent: boolean;
  scheduledAt: string;
  timeSlot: string;
  basePrice: number;
  hasOffer: boolean;
};

function OpenRequests() {
  const list = useApi<RequestItem[]>("/pro/requests");
  const { runStrict, run, busy } = useAction();
  const [offerFor, setOfferFor] = useState<RequestItem | null>(null);
  const [price, setPrice] = useState("");
  const [arrival, setArrival] = useState("60");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<Record<string, string>>({});

  function closeOffer() {
    setOfferFor(null);
    setError({});
  }

  async function submitOffer() {
    if (!offerFor) return;
    setError({});
    try {
      await runStrict("offer", () => apiRequest("POST", `/pro/requests/${offerFor.id}/offer`, { price: Number(price), arrivalMinutes: Number(arrival), description: desc }), "پیشنهاد ارسال شد");
      setOfferFor(null);
      setPrice("");
      setDesc("");
      list.reload();
    } catch (e) {
      setError(errorsFrom(e));
    }
  }

  return (
    <>
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="درخواست جدیدی در حوزه شما نیست">
        {(items) => (
          <div className="grid gap-4">
            {items.map((r) => (
              <Card key={r.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{r.serviceTitle}</p>
                    <span className="text-xs text-muted" dir="ltr">{r.code}</span>
                    {r.urgent && <Badge tone="danger">فوری</Badge>}
                    {r.hasOffer && <Badge tone="brand">پیشنهاد داده‌اید</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.city}، {r.region}، {r.addressLine}</p>
                  <p className="mt-1 text-sm text-muted">{formatDate(r.scheduledAt)} · {TIME_SLOTS.find((t) => t.id === r.timeSlot)?.label} · برآورد پایه: {formatPrice(r.basePrice)}</p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {Object.entries(r.answers).map(([k, v]) => (
                      <div key={k}>
                        <dt className="inline text-muted">{k}: </dt>
                        <dd className="inline">{Array.isArray(v) ? v.join("، ") : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.notes && <p className="mt-3 rounded-lg bg-canvas p-3 text-sm">{r.notes}</p>}
                </div>
                {!r.hasOffer && (
                  <div className="flex gap-2 lg:flex-col">
                    <Button size="sm" onClick={() => setOfferFor(r)}>ارسال پیشنهاد</Button>
                    <Button size="sm" variant="ghost" loading={busy} onClick={async () => { const x = await run("decline", () => apiRequest("POST", `/pro/requests/${r.id}/decline`)); if (x !== undefined) list.reload(); }}>رد درخواست</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>

      <Modal open={offerFor !== null} onClose={closeOffer} title="ارسال پیشنهاد" footer={<><Button variant="outline" onClick={closeOffer}>انصراف</Button><Button loading={busy} onClick={submitOffer}>ارسال پیشنهاد</Button></>}>
        <div className="space-y-4">
          <Field label="مبلغ پیشنهادی (تومان)" htmlFor="offer-price" required error={error.price} hint="حداقل ۵۰٬۰۰۰ تومان">
            <MoneyInput id="offer-price" value={price} onChange={setPrice} error={error.price} />
          </Field>
          <Field label="زمان حضور (دقیقه)" htmlFor="offer-arrival" required error={error.arrivalMinutes}>
            <Input id="offer-arrival" dir="ltr" inputMode="numeric" value={arrival} onChange={(e) => setArrival(e.target.value.replace(/\D/g, ""))} error={error.arrivalMinutes} />
          </Field>
          <Field label="توضیحات پیشنهاد" htmlFor="offer-desc" required error={error.description} hint="جزئیات کار، گارانتی و ابزار (حداقل ۱۰ کاراکتر)">
            <Textarea id="offer-desc" value={desc} onChange={(e) => setDesc(e.target.value)} error={error.description} />
          </Field>
          {error.form && <p role="alert" className="text-sm text-danger">{error.form}</p>}
        </div>
      </Modal>
    </>
  );
}

type OfferRow = { id: number; orderCode: string; serviceTitle: string; city: string; price: number; arrivalMinutes: number; description: string; status: string; declinedByPro: boolean; orderStatus: OrderStatus; createdAt: string };

function offerState(o: OfferRow): { label: string; tone: "info" | "success" | "neutral" } {
  if (o.status === "submitted") return { label: "در انتظار انتخاب مشتری", tone: "info" };
  if (o.status === "selected") return { label: "انتخاب شدید", tone: "success" };
  if (o.declinedByPro) return { label: "درخواست را رد کردید", tone: "neutral" };
  return { label: "انتخاب نشد", tone: "neutral" };
}

function MyOffers() {
  const offers = useApi<OfferRow[]>("/pro/offers");
  return (
    <ApiBlock state={offers} empty={(d) => d.length === 0} emptyTitle="هنوز پیشنهادی ارسال نکرده‌اید">
      {(rows) => (
        <div className="grid gap-4">
          {rows.map((o) => {
            const st = offerState(o);
            return (
              <Card key={o.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold">{o.serviceTitle} <span className="text-xs font-normal text-muted" dir="ltr">{o.orderCode}</span></p>
                  <p className="text-sm text-muted">{o.city} · {formatRelative(o.createdAt)}</p>
                  {o.price > 0 && <p className="mt-1 text-sm">پیشنهاد: <span className="font-semibold">{formatPrice(o.price)}</span> · حضور تا {faNum(o.arrivalMinutes)} دقیقه</p>}
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </Card>
            );
          })}
        </div>
      )}
    </ApiBlock>
  );
}

// =====================================================================
// Jobs
// =====================================================================

type JobItem = { id: number; code: string; status: OrderStatus; serviceTitle: string; customerName: string; customerPhone: string | null; city: string; region: string; addressLine: string; addressDetails: string; scheduledAt: string; timeSlot: string; total: number; estimatedPrice: number; notes: string };

const NEXT_JOB_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }[]>> = {
  confirmed: [{ to: "on_the_way", label: "حرکت به سمت محل" }, { to: "in_progress", label: "شروع کار" }],
  on_the_way: [{ to: "in_progress", label: "شروع کار" }],
  in_progress: [{ to: "completed", label: "اتمام کار" }],
};

function ProJobs({ user }: { user: ViewUser }) {
  const jobs = useApi<JobItem[]>("/pro/jobs");
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  return (
    <DashShell user={user} title="کارهای من" subtitle="وضعیت هر کار را به‌روز کنید تا مشتری در جریان قرار گیرد.">
      {dialog}
      <ApiBlock state={jobs} empty={(d) => d.length === 0} emptyTitle="کاری به شما واگذار نشده است">
        {(list) => (
          <div className="grid gap-4">
            {list.map((j) => (
              <Card key={j.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{j.serviceTitle}</p>
                    <span className="text-xs text-muted" dir="ltr">{j.code}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{j.customerName} · {formatDate(j.scheduledAt)} · {TIME_SLOTS.find((t) => t.id === j.timeSlot)?.label}</p>
                  <p className="mt-1 text-sm">{j.city}، {j.region}، {j.addressLine} {j.addressDetails && `(${j.addressDetails})`}</p>
                  {j.customerPhone ? <p className="mt-1 text-sm" dir="ltr">{j.customerPhone}</p> : <p className="mt-1 text-xs text-muted">شماره مشتری پس از تأیید پرداخت نمایش داده می‌شود.</p>}
                  {j.notes && <p className="mt-2 rounded-lg bg-canvas p-2.5 text-sm">{j.notes}</p>}
                  <p className="mt-2 text-sm font-semibold">مبلغ: {formatPrice(j.total || j.estimatedPrice)}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  {(NEXT_JOB_STATUS[j.status] ?? []).map((a) => (
                    <Button key={a.to} size="sm" loading={busy} onClick={async () => {
                      if (a.to === "completed" && !(await confirm("کار را تکمیل‌شده ثبت می‌کنید؟ مبلغ به موجودی شما اضافه می‌شود."))) return;
                      const r = await run("st", () => apiRequest("POST", `/pro/jobs/${j.id}/status`, { status: a.to }), "وضعیت به‌روز شد");
                      if (r !== undefined) jobs.reload();
                    }}>{a.label}</Button>
                  ))}
                  {!["completed", "cancelled"].includes(j.status) && <Button href={`/pro/messages/${j.id}`} size="sm" variant="outline">گفتگو با مشتری</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
// Earnings
// =====================================================================

type EarningsData = { available: number; pending: number; totalEarned: number; totalCommission: number; totalWithdrawn: number; completedJobs: number; transactions: { id: number; type: TransactionType; amount: number; status: string; description: string; createdAt: string; direction: "credit" | "debit" }[] };

function ProEarnings({ user }: { user: ViewUser }) {
  const data = useApi<EarningsData>("/pro/earnings");
  const { runStrict, busy } = useAction();
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});

  async function requestWithdrawal() {
    setErr({});
    try {
      await runStrict("wd", () => apiRequest("POST", "/pro/withdrawals", { amount: Number(amount), iban }), "درخواست برداشت ثبت شد");
      setAmount("");
      setIban("");
      data.reload();
    } catch (e) {
      setErr(errorsFrom(e));
    }
  }

  return (
    <DashShell user={user} title="درآمد و برداشت" subtitle="مبلغ قابل برداشت، درآمد در انتظار و کارمزد کسرشده را ببینید. کارمزد پلتفرم ۱۵٪ است.">
      <ApiBlock state={data}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="قابل برداشت" value={formatPrice(d.available)} icon="wallet" />
              <StatCard label="در انتظار تکمیل کار" value={formatPrice(d.pending)} icon="clock" tone="amber" hint="سفارش‌های تأییدشده و در جریان" />
              <StatCard label="کل درآمد" value={formatPrice(d.totalEarned)} icon="banknote" tone="sky" hint={`${faNum(d.completedJobs)} کار انجام‌شده`} />
              <StatCard label="کارمزد کسرشده" value={formatPrice(d.totalCommission)} icon="receipt" tone="rose" />
            </div>
            <Card className="space-y-4 p-6">
              <h2 className="font-bold">درخواست برداشت</h2>
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Field label="مبلغ برداشت (تومان)" htmlFor="wd-amount" error={err.amount} hint="حداقل ۱۰۰٬۰۰۰ تومان">
                  <MoneyInput id="wd-amount" value={amount} onChange={setAmount} error={err.amount} />
                </Field>
                <Field label="شماره شبا" htmlFor="wd-iban" error={err.iban} hint="IR و ۲۴ رقم">
                  <Input id="wd-iban" dir="ltr" value={iban} onChange={(e) => setIban(e.target.value)} error={err.iban} placeholder="IR000000000000000000000000" />
                </Field>
                <Button loading={busy} disabled={!amount || !iban} onClick={requestWithdrawal}>ثبت درخواست</Button>
              </div>
              {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
            </Card>
            <h2 className="font-bold">تراکنش‌ها</h2>
            <TransactionTable rows={d.transactions} />
          </>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
// Reviews
// =====================================================================

type ReviewsData = { average: number; total: number; distribution: { star: number; count: number }[]; items: { id: number; rating: number; comment: string; author: string; serviceTitle: string; createdAt: string; reply: string | null; canReply: boolean }[] };

function ProReviews({ user }: { user: ViewUser }) {
  const data = useApi<ReviewsData>("/pro/reviews");
  const { run, busy } = useAction();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [text, setText] = useState("");
  return (
    <DashShell user={user} title="نظرات و امتیازها" subtitle="نظرات مشتریان را ببینید و در صورت نیاز پاسخ دهید.">
      <ApiBlock state={data}>
        {(d) => (
          <>
            <Card className="grid gap-6 p-6 md:grid-cols-[14rem_1fr]">
              <div className="text-center">
                <p className="text-4xl font-extrabold">{faNum(d.average.toFixed(1))}</p>
                <Stars value={d.average} />
                <p className="mt-2 text-sm text-muted">{faNum(d.total)} نظر</p>
              </div>
              <ul className="space-y-2">
                {d.distribution.map((x) => (
                  <li key={x.star} className="flex items-center gap-3 text-sm">
                    <span className="w-10">{faNum(x.star)} ★</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${d.total ? (x.count / d.total) * 100 : 0}%` }} /></span>
                    <span className="w-8 text-muted">{faNum(x.count)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="grid gap-4">
              {d.items.map((r) => (
                <Card key={r.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="font-semibold">{r.author}</p><p className="text-xs text-muted">{r.serviceTitle} · {formatRelative(r.createdAt)}</p></div>
                    <Stars value={r.rating} />
                  </div>
                  <p className="leading-7">{r.comment}</p>
                  {r.reply ? (
                    <p className="rounded-xl bg-canvas p-3 text-sm text-muted">پاسخ شما: {r.reply}</p>
                  ) : r.canReply && replyTo === r.id ? (
                    <div className="flex gap-2">
                      <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="متن پاسخ" placeholder="پاسخ کوتاه بنویسید" />
                      <Button loading={busy} disabled={text.trim().length < 2} onClick={async () => { const x = await run("reply", () => apiRequest("POST", `/pro/reviews/${r.id}/reply`, { reply: text }), "پاسخ ثبت شد"); if (x !== undefined) { setReplyTo(null); setText(""); data.reload(); } }}>ثبت</Button>
                    </div>
                  ) : r.canReply ? (
                    <Button size="sm" variant="outline" onClick={() => setReplyTo(r.id)}>پاسخ به نظر</Button>
                  ) : null}
                </Card>
              ))}
            </div>
          </>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
/** Agenda of upcoming work, grouped by Tehran day. Cancelled jobs are hidden. */
function ProCalendar({ user }: { user: ViewUser }) {
  const jobs = useApi<JobItem[]>("/pro/jobs");
  return (
    <DashShell user={user} title="تقویم کاری" subtitle="کارهای پیش رو به تفکیک روز و بازه زمانی.">
      <ApiBlock state={jobs} empty={(d) => d.filter((j) => j.status !== "cancelled").length === 0} emptyTitle="کاری در تقویم شما نیست">
        {(list) => {
          const active = list.filter((j) => j.status !== "cancelled").sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
          const groups = new Map<string, JobItem[]>();
          for (const j of active) {
            const day = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran" }).format(new Date(j.scheduledAt));
            groups.set(day, [...(groups.get(day) ?? []), j]);
          }
          return (
            <div className="space-y-7">
              {[...groups.entries()].map(([day, items]) => (
                <section key={day} aria-label={day} className="space-y-3">
                  <h2 className="flex items-center gap-3 text-sm font-bold text-ink">
                    <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
                    {day}
                    <span className="text-xs font-normal text-muted">{faNum(items.length)} کار</span>
                  </h2>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {items.map((j) => (
                      <li key={j.id}>
                        <Card className="flex items-start gap-4 p-4">
                          <div className="w-24 shrink-0 rounded-xl bg-brand-soft px-2 py-2.5 text-center text-xs font-bold leading-5 text-brand-strong">{TIME_SLOTS.find((t) => t.id === j.timeSlot)?.label}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{j.serviceTitle}</p>
                            <p className="mt-0.5 text-xs text-muted">{j.customerName} · {j.city}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <StatusBadge status={j.status} />
                              <span className="text-xs text-muted" dir="ltr">{j.code}</span>
                            </div>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          );
        }}
      </ApiBlock>
    </DashShell>
  );
}

// Profile management (info, services, pricing, hours, areas, portfolio, photo)
// =====================================================================

function ProProfileForm({ user, data, reload }: { user: ViewUser; data: ProProfileResponse; reload: () => void }) {
  const p = data.profile;
  const toast = useToast();
  const { runStrict, busy } = useAction();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(data.user.avatarUrl);
  const [err, setErr] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    headline: p.headline,
    bio: p.bio,
    experienceYears: String(p.experienceYears),
    skills: p.skills.join("، "),
    areas: p.serviceAreas,
    days: p.workingHours.days,
    from: p.workingHours.from,
    to: p.workingHours.to,
    minPrice: String(p.pricing.minPrice),
    hourlyRate: String(p.pricing.hourlyRate),
    visitFee: String(p.pricing.visitFee),
    isAvailable: p.isAvailable,
    categoryIds: p.categoryIds,
    portfolio: p.portfolio.map((x) => ({ ...x })),
  });
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 300_000) {
      toast.error("تصویر JPG/PNG/WebP تا ۳۰۰ کیلوبایت");
      return;
    }
    const url = await readAsDataUrl(file);
    try {
      await runStrict("avatar", () => apiRequest("PATCH", "/me", { fullName: data.user.fullName, email: data.user.email, avatarUrl: url }), "تصویر پروفایل به‌روز شد");
      setAvatarUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "بارگذاری تصویر انجام نشد");
    }
  }

  async function save() {
    setErr({});
    try {
      await runStrict("prof", () => apiRequest("PATCH", "/pro/profile", {
        headline: form.headline,
        bio: form.bio,
        experienceYears: Number(form.experienceYears),
        skills: csv(form.skills),
        serviceAreas: form.areas,
        workingDays: form.days,
        workingFrom: form.from,
        workingTo: form.to,
        minPrice: Number(form.minPrice),
        hourlyRate: Number(form.hourlyRate),
        visitFee: Number(form.visitFee),
        isAvailable: form.isAvailable,
        portfolio: form.portfolio.filter((x) => x.title.trim().length >= 2),
        categoryIds: form.categoryIds,
      }), "پروفایل ذخیره شد");
      reload();
    } catch (e) {
      setErr(errorsFrom(e));
    }
  }

  return (
    <DashShell user={user} title="مدیریت پروفایل" subtitle="اطلاعات، خدمات، قیمت‌ها، ساعات کاری، مناطق و نمونه کارها را مدیریت کنید." actions={<Button loading={busy} onClick={save}>ذخیره تغییرات</Button>}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-5 p-6">
            <h2 className="font-bold">اطلاعات حرفه‌ای</h2>
            <div className="flex items-center gap-4">
              <Avatar name={data.user.fullName} src={avatarUrl} size="xl" />
              <label className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-medium transition hover:border-brand/40 hover:text-brand">
                تغییر تصویر پروفایل
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void onAvatar(e.target.files?.[0])} />
              </label>
            </div>
            <Field label="عنوان تخصصی" htmlFor="pf-headline" required error={err.headline}><Input id="pf-headline" value={form.headline} onChange={(e) => set({ headline: e.target.value })} error={err.headline} /></Field>
            <Field label="معرفی" htmlFor="pf-bio" required error={err.bio}><Textarea id="pf-bio" value={form.bio} onChange={(e) => set({ bio: e.target.value })} error={err.bio} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="سابقه کار (سال)" htmlFor="pf-exp"><Input id="pf-exp" dir="ltr" inputMode="numeric" value={form.experienceYears} onChange={(e) => set({ experienceYears: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="مهارت‌ها (با ویرگول)" htmlFor="pf-skills" error={err.skills}><Input id="pf-skills" value={form.skills} onChange={(e) => set({ skills: e.target.value })} error={err.skills} /></Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">دسته‌بندی‌های خدماتی</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.availableCategories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-mint/20">
                    <input type="checkbox" className="accent-brand" checked={form.categoryIds.includes(c.id)} onChange={() => set({ categoryIds: toggleIn(form.categoryIds, c.id) })} />
                    {c.name} <span className="text-xs text-muted">({c.parentName})</span>
                  </label>
                ))}
              </div>
              {err.categoryIds && <p className="mt-2 text-xs text-danger">{err.categoryIds}</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">مناطق خدمت</legend>
              <div className="flex flex-wrap gap-2">
                {CITIES.map((c) => (
                  <label key={c.slug} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-mint/30">
                    <input type="checkbox" className="accent-brand" checked={form.areas.includes(c.name)} onChange={() => set({ areas: toggleIn(form.areas, c.name) })} />
                    {c.name}
                  </label>
                ))}
              </div>
              {err.serviceAreas && <p className="mt-2 text-xs text-danger">{err.serviceAreas}</p>}
            </fieldset>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">نمونه کارها (پرتفوی)</h2>
              <Button size="sm" variant="outline" disabled={form.portfolio.length >= MAX_PORTFOLIO} onClick={() => set({ portfolio: [...form.portfolio, { title: "", description: "" }] })}>افزودن نمونه کار</Button>
            </div>
            {form.portfolio.length === 0 && <p className="text-sm text-muted">هنوز نمونه کاری ثبت نشده است. نمونه کارها به پروفایل شما در صفحه خدمات نمایش داده می‌شود.</p>}
            {form.portfolio.map((item, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
                <Field label="عنوان پروژه" htmlFor={`pf-pt-${i}`}><Input id={`pf-pt-${i}`} value={item.title} onChange={(e) => set({ portfolio: form.portfolio.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} /></Field>
                <Field label="توضیح کوتاه" htmlFor={`pf-pd-${i}`}><Input id={`pf-pd-${i}`} value={item.description} onChange={(e) => set({ portfolio: form.portfolio.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} /></Field>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => set({ portfolio: form.portfolio.filter((_, j) => j !== i) })}>حذف</Button>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="font-bold">قیمت و زمان کاری</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="حداقل قیمت" htmlFor="pf-min"><Input id="pf-min" dir="ltr" inputMode="numeric" value={form.minPrice} onChange={(e) => set({ minPrice: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="نرخ ساعتی" htmlFor="pf-hour"><Input id="pf-hour" dir="ltr" inputMode="numeric" value={form.hourlyRate} onChange={(e) => set({ hourlyRate: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="هزینه رفت‌وآمد" htmlFor="pf-visit"><Input id="pf-visit" dir="ltr" inputMode="numeric" value={form.visitFee} onChange={(e) => set({ visitFee: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="پذیرش سفارش" htmlFor="pf-av"><div className="flex h-11 items-center"><Toggle checked={form.isAvailable} onChange={(v) => set({ isAvailable: v })} label="پذیرش سفارش جدید" /></div></Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">روزهای کاری</legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs has-[:checked]:border-brand has-[:checked]:bg-mint/30">
                    <input type="checkbox" className="accent-brand" checked={form.days.includes(d.id)} onChange={() => set({ days: toggleIn(form.days, d.id) })} />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="شروع" htmlFor="pf-from"><Input id="pf-from" type="time" dir="ltr" value={form.from} onChange={(e) => set({ from: e.target.value })} /></Field>
              <Field label="پایان" htmlFor="pf-to"><Input id="pf-to" type="time" dir="ltr" value={form.to} onChange={(e) => set({ to: e.target.value })} /></Field>
            </div>
          </Card>
          <Card className="space-y-3 p-6">
            <h2 className="font-bold">وضعیت تأیید</h2>
            <Badge tone={p.verificationStatus === "verified" ? "success" : p.verificationStatus === "rejected" ? "danger" : "warning"}>{PRO_VERIFICATION_LABELS[p.verificationStatus]}</Badge>
            {p.verificationNotes && <p className="text-sm text-muted">{p.verificationNotes}</p>}
            <p className="text-xs text-muted">امتیاز {faNum(p.rating.toFixed(1))} · {faNum(p.reviewsCount)} نظر · {faNum(p.completedJobs)} سفارش انجام‌شده</p>
            {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
          </Card>
        </div>
      </div>
    </DashShell>
  );
}
