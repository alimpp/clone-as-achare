"use client";

import { useState } from "react";
import { apiRequest, ApiClientError, Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, StatCard, Tabs, Textarea, Toggle, useAction, useApi, useConfirm } from "@/components/ui";
import { ApiBlock, DashShell, OrderTimeline, StatusBadge, TransactionTable, type ViewUser } from "./Views";
import { CATEGORY_TONES, formatDate, formatDateTime, formatPrice, formatRelative, faNum, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PRO_VERIFICATION_LABELS, ROLE_LABELS, ADMIN_TRANSITIONS as ADMIN_TRANSITIONS_BY_STATUS, type OrderStatus, type ProVerificationStatus, type TransactionType } from "@/lib/domain";

const csv = (s: string) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const errorsFrom = (e: unknown): Record<string, string> => {
  if (e instanceof ApiClientError) return { ...(e.fieldErrors ?? {}), form: e.message };
  if (e instanceof SyntaxError) return { form: "قالب JSON نامعتبر است؛ ساختار سؤال‌ها و سؤالات متداول را بررسی کنید." };
  return { form: e instanceof Error ? e.message : "خطای ناشناخته" };
};

export function AdminDashboard({ user, section }: { user: ViewUser; section: string[] }) {
  const [head] = section;
  switch (head) {
    case undefined:
      return <AdminOverview user={user} />;
    case "users":
      return <AdminUsers user={user} />;
    case "professionals":
      return <AdminProfessionals user={user} />;
    case "catalog":
      return <AdminCatalog user={user} />;
    case "orders":
      return <AdminOrders user={user} />;
    case "finance":
      return <AdminFinance user={user} />;
    case "content":
      return <AdminContent user={user} />;
    case "reports":
      return <AdminReports user={user} />;
    case "offers":
      return <AdminOffers user={user} />;
    case "logs":
      return <AdminLogs user={user} />;
    default:
      return <EmptyState title="صفحه یافت نشد" />;
  }
}

/** Dependency-free SVG bar chart. */
export function BarChart({ values, labels, height = 180 }: { values: number[]; labels: string[]; height?: number }) {
  const max = Math.max(1, ...values);
  const w = 100 / Math.max(values.length, 1);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" className="h-48 w-full" role="img" aria-label="نمودار ستونی">
        {values.map((v, i) => {
          const h = (v / max) * (height / 2 - 6);
          return <rect key={i} x={i * w + w * 0.18} y={height / 2 - h} width={w * 0.64} height={Math.max(h, 0.5)} rx="0.6" className="fill-brand transition-all duration-700 hover:fill-lime" />;
        })}
      </svg>
      <div className="mt-2 flex justify-between gap-1 text-[10px] text-muted">
        {labels.map((l, i) => (
          <span key={i} className="truncate">{i % 2 === 0 ? l : ""}</span>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Overview
// =====================================================================

function AdminOverview({ user }: { user: ViewUser }) {
  const data = useApi<{ kpis: Record<string, number>; series: { day: string; orders: number; revenue: number }[]; activity: { id: number; action: string; entity: string; details: string; createdAt: string }[]; recentOrders: { id: number; code: string; status: OrderStatus; total: number; serviceTitle: string; createdAt: string }[] }>("/admin/overview");
  return (
    <DashShell user={user} title="نمای کلی مدیریت" subtitle="وضعیت کسب‌وکار بر اساس داده‌های واقعی سامانه.">
      <ApiBlock state={data}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="مشتریان" value={faNum(d.kpis.customers)} icon="users" />
              <StatCard label="متخصصان تأییدشده" value={faNum(d.kpis.professionals)} icon="badge" tone="sky" hint={`${faNum(d.kpis.pendingApprovals)} درخواست در انتظار`} />
              <StatCard label="کل سفارش‌ها" value={faNum(d.kpis.totalOrders)} icon="package" tone="amber" hint={`${faNum(d.kpis.completedOrders)} انجام شده · ${faNum(d.kpis.cancelledOrders)} لغو`} />
              <StatCard label="مجموع پرداخت‌ها" value={formatPrice(d.kpis.gmv)} icon="wallet" tone="rose" hint={`کمیسیون: ${formatPrice(d.kpis.commission)}`} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6 lg:col-span-2">
                <h2 className="mb-4 font-bold">سفارش‌ها در ۱۴ روز گذشته</h2>
                <BarChart values={d.series.map((s) => s.orders)} labels={d.series.map((s) => s.day.slice(5))} />
                <p className="mt-3 text-xs text-muted">هر ستون تعداد سفارش‌های ثبت‌شده در آن روز (تقویم تهران) است.</p>
              </Card>
              <Card className="p-6">
                <h2 className="mb-4 font-bold">فعالیت اخیر</h2>
                <ul className="space-y-3 text-sm">
                  {d.activity.map((a) => (
                    <li key={a.id} className="border-b border-line pb-3 last:border-0">
                      <p className="font-medium">{a.action}</p>
                      <p className="truncate text-xs text-muted">{a.details || a.entity} · {formatRelative(a.createdAt)}</p>
                    </li>
                  ))}
                  {d.activity.length === 0 && <li className="text-muted">فعالیتی ثبت نشده است.</li>}
                </ul>
              </Card>
            </div>
            <Card className="p-6">
              <h2 className="mb-4 font-bold">آخرین سفارش‌ها</h2>
              <ul className="divide-y divide-line">
                {d.recentOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span>{o.serviceTitle} <span className="text-muted" dir="ltr">· {o.code}</span></span>
                    <span className="flex items-center gap-3"><StatusBadge status={o.status} /><span className="font-semibold">{formatPrice(o.total)}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
// Users
// =====================================================================

type UserRow = { id: string; fullName: string; phone: string; email: string | null; role: string; status: string; phoneVerified: boolean; createdAt: string };

function AdminUsers({ user }: { user: ViewUser }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const qs = new URLSearchParams({ q, role, status }).toString();
  const list = useApi<UserRow[]>(`/admin/users?${qs}`);
  const { run, busy } = useAction();
  return (
    <DashShell user={user} title="مدیریت کاربران" subtitle="جستجو، جزئیات، ویرایش اطلاعات، تغییر نقش و تعلیق یا فعال‌سازی حساب کاربران.">
      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_12rem_12rem]">
        <Input type="search" placeholder="جستجوی نام، موبایل یا ایمیل" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی کاربر" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="فیلتر نقش">
          <option value="all">همه نقش‌ها</option><option value="customer">مشتری</option><option value="professional">متخصص</option><option value="admin">مدیر</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="فیلتر وضعیت">
          <option value="all">همه وضعیت‌ها</option><option value="active">فعال</option><option value="suspended">تعلیق‌شده</option>
        </Select>
      </Card>
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="کاربری یافت نشد">
        {(rows) => (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">فهرست کاربران</caption>
              <thead className="bg-canvas text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start">نام</th>
                  <th scope="col" className="px-4 py-3 text-start">موبایل</th>
                  <th scope="col" className="px-4 py-3 text-start">نقش</th>
                  <th scope="col" className="px-4 py-3 text-start">وضعیت</th>
                  <th scope="col" className="px-4 py-3 text-start">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{u.fullName}</td>
                    <td className="px-4 py-3" dir="ltr">{u.phone}</td>
                    <td className="px-4 py-3">
                      <Select aria-label={`نقش ${u.fullName}`} value={u.role} disabled={busy || u.id === user.id} onChange={async (e) => { const r = await run("role", () => apiRequest("PATCH", `/admin/users/${u.id}`, { role: e.target.value }), "نقش تغییر کرد"); if (r !== undefined) list.reload(); }} className="h-9 w-40 py-1 text-xs">
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-3"><Badge tone={u.status === "active" ? "success" : "danger"}>{u.status === "active" ? "فعال" : "تعلیق"}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDetailId(u.id)}>جزئیات</Button>
                        <Button size="sm" variant={u.status === "active" ? "danger" : "soft"} disabled={u.id === user.id} loading={busy} onClick={async () => { const r = await run("st", () => apiRequest("PATCH", `/admin/users/${u.id}`, { status: u.status === "active" ? "suspended" : "active" }), "وضعیت حساب تغییر کرد"); if (r !== undefined) list.reload(); }}>
                          {u.status === "active" ? "تعلیق" : "فعال‌سازی"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </ApiBlock>
      <Modal open={detailId !== null} onClose={() => setDetailId(null)} title="جزئیات کاربر" size="lg">
        {detailId && <UserEditor id={detailId} onSaved={list.reload} />}
      </Modal>
    </DashShell>
  );
}

function UserEditor({ id, onSaved }: { id: string; onSaved: () => void }) {
  const d = useApi<{ user: { id: string; fullName: string; email: string | null; phone: string; role: string; status: string; phoneVerified: boolean; createdAt: string }; orderStats: { total: number; spent: number }; recentOrders: { id: number; code: string; status: OrderStatus; total: number; createdAt: string }[] }>(`/admin/users/${id}`);
  const { runStrict, busy } = useAction();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (!d.data) return null;
  const u = d.data.user;
  const nameValue = name ?? u.fullName;
  const emailValue = email ?? (u.email ?? "");

  async function save() {
    setErr({});
    try {
      await runStrict("user-save", () => apiRequest("PATCH", `/admin/users/${id}`, { fullName: nameValue, email: emailValue.trim() || null }), "اطلاعات کاربر ذخیره شد");
      setName(null);
      setEmail(null);
      d.reload();
      onSaved();
    } catch (e) {
      setErr(errorsFrom(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={u.fullName} size="lg" />
        <div>
          <p className="font-bold">{u.fullName}</p>
          <p className="text-sm text-muted">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role} · {u.status === "active" ? "فعال" : "تعلیق‌شده"} · عضویت {formatDate(u.createdAt)}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="تعداد سفارش" value={faNum(d.data.orderStats.total)} icon="package" />
        <StatCard label="مجموع خرید" value={formatPrice(d.data.orderStats.spent)} icon="wallet" tone="amber" />
        <StatCard label="شماره موبایل" value={u.phone} icon="shield" tone="sky" hint={u.phoneVerified ? "تأیید شده" : "تأیید نشده"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی" htmlFor="ue-name" required error={err.fullName}><Input id="ue-name" value={nameValue} onChange={(e) => setName(e.target.value)} error={err.fullName} /></Field>
        <Field label="ایمیل" htmlFor="ue-email" error={err.email}><Input id="ue-email" dir="ltr" type="email" value={emailValue} onChange={(e) => setEmail(e.target.value)} error={err.email} /></Field>
      </div>
      {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
      <div className="flex justify-end"><Button loading={busy} onClick={save}>ذخیره اطلاعات</Button></div>
      <div>
        <h3 className="mb-3 font-bold">آخرین سفارش‌ها</h3>
        {d.data.recentOrders.length === 0 ? <p className="text-sm text-muted">سفارشی ثبت نشده است.</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {d.data.recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span dir="ltr">{o.code}</span>
                <StatusBadge status={o.status} />
                <span>{formatPrice(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Professionals
// =====================================================================

type ProRow = { userId: string; fullName: string; phone: string; email: string | null; status: string; headline: string; bio: string; experienceYears: number; skills: string[]; serviceAreas: string[]; categories: string[]; documents: { type: string; name: string; status: string; dataUrl?: string }[]; verificationStatus: ProVerificationStatus; verificationNotes: string; rating: number; reviewsCount: number; completedJobs: number; createdAt: string };

function AdminProfessionals({ user }: { user: ViewUser }) {
  const [status, setStatus] = useState("pending");
  const list = useApi<ProRow[]>(`/admin/professionals?status=${status}`);
  const { run, busy } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <DashShell user={user} title="بررسی متخصصان" subtitle="مدارک را بررسی کنید. تنها پس از تأیید شما، متخصص می‌تواند پیشنهاد دهد.">
      <Tabs items={[{ value: "pending", label: "در انتظار" }, { value: "verified", label: "تأیید شده" }, { value: "rejected", label: "رد شده" }, { value: "all", label: "همه" }]} value={status} onChange={setStatus} />
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="موردی در این فهرست نیست">
        {(rows) => (
          <div className="grid gap-4">
            {rows.map((p) => (
              <Card key={p.userId} className="grid gap-5 p-6 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={p.fullName} size="md" />
                    <div>
                      <p className="font-bold">{p.fullName}</p>
                      <p className="text-xs text-muted" dir="ltr">{p.phone}{p.email ? ` · ${p.email}` : ""}</p>
                    </div>
                    <Badge tone={p.verificationStatus === "verified" ? "success" : p.verificationStatus === "rejected" ? "danger" : "warning"}>{PRO_VERIFICATION_LABELS[p.verificationStatus]}</Badge>
                  </div>
                  <p className="text-sm">{p.headline} · {faNum(p.experienceYears)} سال سابقه</p>
                  <p className="text-sm text-muted">دسته‌ها: {p.categories.join("، ") || "—"} · مناطق: {p.serviceAreas.join("، ") || "—"}</p>
                  <p className="text-xs text-muted">امتیاز {faNum(p.rating.toFixed(1))} · {faNum(p.reviewsCount)} نظر · {faNum(p.completedJobs)} سفارش انجام‌شده</p>
                  <div className="flex flex-wrap gap-3">
                    {p.documents.map((d, i) => (
                      <figure key={i} className="w-36 text-xs">
                        {d.dataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.dataUrl} alt={`${d.type}: ${d.name}`} className="h-24 w-36 rounded-lg border border-line object-cover" />
                        ) : (
                          <div className="grid h-24 w-36 place-items-center rounded-lg border border-dashed border-line text-muted">بدون تصویر</div>
                        )}
                        <figcaption className="mt-1 truncate text-muted">{d.type} · {d.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                  <p className="text-sm leading-7 text-muted">{p.bio}</p>
                  {p.verificationNotes && <p className="text-xs text-muted">یادداشت قبلی: {p.verificationNotes}</p>}
                </div>
                {p.verificationStatus !== "verified" && (
                  <div className="flex min-w-56 flex-col gap-2">
                    <Textarea aria-label="یادداشت بررسی" placeholder="یادداشت (برای رد الزامی است)" value={notes[p.userId] ?? ""} onChange={(e) => setNotes({ ...notes, [p.userId]: e.target.value })} className="min-h-16" />
                    <Button size="sm" loading={busy} onClick={async () => { const r = await run("ap", () => apiRequest("POST", `/admin/professionals/${p.userId}/decision`, { decision: "approve", notes: notes[p.userId] ?? "" }), "متخصص تأیید شد"); if (r !== undefined) list.reload(); }}>تأیید متخصص</Button>
                    <Button size="sm" variant="danger" loading={busy} disabled={(notes[p.userId] ?? "").trim().length < 2} onClick={async () => { const r = await run("rj", () => apiRequest("POST", `/admin/professionals/${p.userId}/decision`, { decision: "reject", notes: notes[p.userId] ?? "" }), "درخواست رد شد"); if (r !== undefined) list.reload(); }}>رد درخواست</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
// Catalog: categories and services (full records are sent on save, so no field is reset)
// =====================================================================

type CatRow = { id: number; parentId: number | null; slug: string; name: string; description: string; iconKey: string; tone: string; seoTitle: string; seoDescription: string; sortOrder: number; isActive: boolean; serviceCount: number };
type SvcRow = { id: number; categoryId: number; categoryName: string; slug: string; title: string; shortDescription: string; description: string; basePrice: number; durationMinutes: number; isPopular: boolean; isActive: boolean; keywords: string[]; questions: unknown[]; faqs: unknown[]; benefits: string[]; steps: string[]; requirements: string[]; priceFactors: string[]; formFamily: string; seoTitle: string; seoDescription: string; tone: string };

type CatForm = { id?: number; name: string; slug: string; parentId: string; description: string; iconKey: string; tone: string; seoTitle: string; seoDescription: string; sortOrder: string; isActive: boolean };
const EMPTY_CAT: CatForm = { name: "", slug: "", parentId: "", description: "", iconKey: "wrench", tone: "emerald", seoTitle: "", seoDescription: "", sortOrder: "100", isActive: true };
const catToForm = (c: CatRow): CatForm => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId ? String(c.parentId) : "", description: c.description, iconKey: c.iconKey, tone: c.tone, seoTitle: c.seoTitle, seoDescription: c.seoDescription, sortOrder: String(c.sortOrder), isActive: c.isActive });

type SvcForm = { id?: number; categoryId: string; slug: string; title: string; shortDescription: string; description: string; benefits: string; steps: string; requirements: string; priceFactors: string; keywords: string; basePrice: string; durationMinutes: string; formFamily: string; questions: string; faqs: string; seoTitle: string; seoDescription: string; tone: string; isPopular: boolean; isActive: boolean };
const svcToForm = (s: SvcRow): SvcForm => ({
  id: s.id, categoryId: String(s.categoryId), slug: s.slug, title: s.title, shortDescription: s.shortDescription, description: s.description,
  benefits: s.benefits.join("\n"), steps: s.steps.join("\n"), requirements: s.requirements.join("\n"), priceFactors: s.priceFactors.join("\n"),
  keywords: s.keywords.join("، "), basePrice: String(s.basePrice), durationMinutes: String(s.durationMinutes), formFamily: s.formFamily,
  questions: JSON.stringify(s.questions, null, 2), faqs: JSON.stringify(s.faqs, null, 2), seoTitle: s.seoTitle, seoDescription: s.seoDescription,
  tone: s.tone, isPopular: s.isPopular, isActive: s.isActive,
});
const EMPTY_SVC: SvcForm = { categoryId: "", slug: "", title: "", shortDescription: "", description: "", benefits: "", steps: "", requirements: "", priceFactors: "", keywords: "", basePrice: "300000", durationMinutes: "60", formFamily: "general", questions: "[]", faqs: "[]", seoTitle: "", seoDescription: "", tone: "emerald", isPopular: false, isActive: true };

const ICON_OPTIONS = ["sparkles", "droplets", "zap", "plug", "paintbrush", "truck", "snowflake", "leaf", "sofa", "laptop", "car", "scissors", "hammer", "wrench", "file", "tag", "package", "clock"];

function AdminCatalog({ user }: { user: ViewUser }) {
  const cats = useApi<CatRow[]>("/admin/categories");
  const svcs = useApi<SvcRow[]>("/admin/services");
  const { runStrict, run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const [catForm, setCatForm] = useState<CatForm | null>(null);
  const [svcForm, setSvcForm] = useState<SvcForm | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const leaves = (cats.data ?? []).filter((c) => c.parentId != null);
  const parents = (cats.data ?? []).filter((c) => c.parentId == null);

  async function saveCat() {
    if (!catForm) return;
    setErr({});
    const body = { name: catForm.name, slug: catForm.slug, parentId: catForm.parentId ? Number(catForm.parentId) : null, description: catForm.description, iconKey: catForm.iconKey, tone: catForm.tone, seoTitle: catForm.seoTitle, seoDescription: catForm.seoDescription, sortOrder: Number(catForm.sortOrder) || 0, isActive: catForm.isActive };
    try {
      await runStrict("cat", () => apiRequest(catForm.id ? "PUT" : "POST", catForm.id ? `/admin/categories/${catForm.id}` : "/admin/categories", body), "دسته‌بندی ذخیره شد");
      setCatForm(null);
      cats.reload();
    } catch (e) {
      setErr(errorsFrom(e));
    }
  }

  async function saveSvc() {
    if (!svcForm) return;
    setErr({});
    try {
      const body = {
        categoryId: Number(svcForm.categoryId), slug: svcForm.slug, title: svcForm.title, shortDescription: svcForm.shortDescription, description: svcForm.description,
        benefits: lines(svcForm.benefits), steps: lines(svcForm.steps), requirements: lines(svcForm.requirements), priceFactors: lines(svcForm.priceFactors),
        keywords: csv(svcForm.keywords), basePrice: Number(svcForm.basePrice), durationMinutes: Number(svcForm.durationMinutes), formFamily: svcForm.formFamily,
        questions: JSON.parse(svcForm.questions) as unknown[], faqs: JSON.parse(svcForm.faqs) as unknown[],
        seoTitle: svcForm.seoTitle, seoDescription: svcForm.seoDescription, tone: svcForm.tone, isPopular: svcForm.isPopular, isActive: svcForm.isActive,
      };
      await runStrict("svc", () => apiRequest(svcForm.id ? "PUT" : "POST", svcForm.id ? `/admin/services/${svcForm.id}` : "/admin/services", body), "خدمت ذخیره شد");
      setSvcForm(null);
      svcs.reload();
    } catch (e) {
      setErr(errorsFrom(e));
    }
  }

  return (
    <DashShell user={user} title="خدمات و دسته‌بندی‌ها" subtitle="دسته‌بندی‌های سلسله‌مراتبی، خدمات، قیمت‌ها، SEO و فرم‌های پویای هر خدمت.">
      {dialog}
      <section className="space-y-3" aria-labelledby="cats-h">
        <div className="flex items-center justify-between"><h2 id="cats-h" className="font-bold">دسته‌بندی‌ها</h2><Button size="sm" onClick={() => { setErr({}); setCatForm({ ...EMPTY_CAT }); }}>دسته‌بندی جدید</Button></div>
        <ApiBlock state={cats}>
          {(rows) => (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">دسته‌بندی‌ها</caption>
                <thead className="bg-canvas text-xs text-muted"><tr><th scope="col" className="px-4 py-3 text-start">نام</th><th scope="col" className="px-4 py-3 text-start">سطح</th><th scope="col" className="px-4 py-3 text-start">خدمات</th><th scope="col" className="px-4 py-3 text-start">وضعیت</th><th scope="col" className="px-4 py-3 text-start">عملیات</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium">{c.parentId ? `— ${c.name}` : c.name}</td>
                      <td className="px-4 py-3 text-muted">{c.parentId ? "زیرمجموعه" : "اصلی"}</td>
                      <td className="px-4 py-3">{faNum(c.serviceCount)}</td>
                      <td className="px-4 py-3"><Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "فعال" : "غیرفعال"}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setErr({}); setCatForm(catToForm(c)); }}>ویرایش</Button>
                          <Button size="sm" variant="ghost" className="text-danger" onClick={async () => { if (!(await confirm(`«${c.name}» حذف شود؟`))) return; const r = await run("dc", () => apiRequest("DELETE", `/admin/categories/${c.id}`), "دسته‌بندی حذف شد"); if (r !== undefined) cats.reload(); }}>حذف</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </ApiBlock>
      </section>

      <section className="space-y-3" aria-labelledby="svcs-h">
        <div className="flex items-center justify-between">
          <h2 id="svcs-h" className="font-bold">خدمات</h2>
          <Button size="sm" disabled={leaves.length === 0} onClick={() => { setErr({}); setSvcForm({ ...EMPTY_SVC, categoryId: String(leaves[0]?.id ?? "") }); }}>خدمت جدید</Button>
        </div>
        <ApiBlock state={svcs}>
          {(rows) => (
            <div className="grid gap-3">
              {rows.map((s) => (
                <Card key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.title} {!s.isActive && <Badge>غیرفعال</Badge>} {s.isPopular && <Badge tone="brand">پرطرفدار</Badge>}</p>
                    <p className="text-xs text-muted">{s.categoryName} · از {formatPrice(s.basePrice)} · {faNum(s.durationMinutes)} دقیقه · {faNum(s.questions.length)} سؤال فرم</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setErr({}); setSvcForm(svcToForm(s)); }}>ویرایش</Button>
                </Card>
              ))}
            </div>
          )}
        </ApiBlock>
      </section>

      <Modal open={catForm !== null} onClose={() => setCatForm(null)} title={catForm?.id ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"} footer={<><Button variant="outline" onClick={() => setCatForm(null)}>انصراف</Button><Button loading={busy} onClick={saveCat}>ذخیره</Button></>}>
        {catForm && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام" htmlFor="c-name" required error={err.name}><Input id="c-name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} error={err.name} /></Field>
            <Field label="نامک (slug)" htmlFor="c-slug" required error={err.slug}><Input id="c-slug" dir="ltr" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} error={err.slug} /></Field>
            <Field label="والد" htmlFor="c-parent" hint="برای دسته اصلی خالی بگذارید"><Select id="c-parent" value={catForm.parentId} onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })}><option value="">— دسته اصلی —</option>{parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="ترتیب نمایش" htmlFor="c-sort"><Input id="c-sort" dir="ltr" inputMode="numeric" value={catForm.sortOrder} onChange={(e) => setCatForm({ ...catForm, sortOrder: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="آیکون" htmlFor="c-icon"><Select id="c-icon" value={catForm.iconKey} onChange={(e) => setCatForm({ ...catForm, iconKey: e.target.value })}>{ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}</Select></Field>
            <Field label="رنگ" htmlFor="c-tone"><Select id="c-tone" value={catForm.tone} onChange={(e) => setCatForm({ ...catForm, tone: e.target.value })}>{CATEGORY_TONES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
            <div className="sm:col-span-2"><Field label="توضیحات" htmlFor="c-desc"><Textarea id="c-desc" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="عنوان سئو" htmlFor="c-seo-t" hint="حداکثر ۱۲۰ کاراکتر"><Input id="c-seo-t" value={catForm.seoTitle} onChange={(e) => setCatForm({ ...catForm, seoTitle: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="توضیح سئو" htmlFor="c-seo-d"><Textarea id="c-seo-d" value={catForm.seoDescription} onChange={(e) => setCatForm({ ...catForm, seoDescription: e.target.value })} /></Field></div>
            <label className="flex items-center gap-3 text-sm sm:col-span-2"><Toggle checked={catForm.isActive} onChange={(v) => setCatForm({ ...catForm, isActive: v })} label="فعال" />فعال باشد</label>
            {err.form && <p role="alert" className="text-sm text-danger sm:col-span-2">{err.form}</p>}
          </div>
        )}
      </Modal>

      <Modal size="lg" open={svcForm !== null} onClose={() => setSvcForm(null)} title={svcForm?.id ? "ویرایش خدمت" : "خدمت جدید"} footer={<><Button variant="outline" onClick={() => setSvcForm(null)}>انصراف</Button><Button loading={busy} onClick={saveSvc}>ذخیره خدمت</Button></>}>
        {svcForm && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="عنوان" htmlFor="s-title" required error={err.title}><Input id="s-title" value={svcForm.title} onChange={(e) => setSvcForm({ ...svcForm, title: e.target.value })} error={err.title} /></Field>
            <Field label="نامک" htmlFor="s-slug" required error={err.slug}><Input id="s-slug" dir="ltr" value={svcForm.slug} onChange={(e) => setSvcForm({ ...svcForm, slug: e.target.value })} error={err.slug} /></Field>
            <Field label="دسته (زیرمجموعه)" htmlFor="s-cat" required error={err.categoryId}><Select id="s-cat" value={svcForm.categoryId} onChange={(e) => setSvcForm({ ...svcForm, categoryId: e.target.value })}>{leaves.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="قیمت شروع (تومان)" htmlFor="s-price" error={err.basePrice}><Input id="s-price" dir="ltr" inputMode="numeric" value={svcForm.basePrice} onChange={(e) => setSvcForm({ ...svcForm, basePrice: e.target.value.replace(/\D/g, "") })} error={err.basePrice} /></Field>
            <Field label="مدت (دقیقه)" htmlFor="s-dur" error={err.durationMinutes}><Input id="s-dur" dir="ltr" inputMode="numeric" value={svcForm.durationMinutes} onChange={(e) => setSvcForm({ ...svcForm, durationMinutes: e.target.value.replace(/\D/g, "") })} error={err.durationMinutes} /></Field>
            <Field label="کلیدواژه‌ها (با ویرگول)" htmlFor="s-kw"><Input id="s-kw" value={svcForm.keywords} onChange={(e) => setSvcForm({ ...svcForm, keywords: e.target.value })} /></Field>
            <Field label="خانواده فرم" htmlFor="s-family" hint="برای گزارش‌گیری؛ در فرم سفارش استفاده نمی‌شود"><Input id="s-family" dir="ltr" value={svcForm.formFamily} onChange={(e) => setSvcForm({ ...svcForm, formFamily: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="توضیح کوتاه" htmlFor="s-short"><Input id="s-short" value={svcForm.shortDescription} onChange={(e) => setSvcForm({ ...svcForm, shortDescription: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="توضیحات" htmlFor="s-desc"><Textarea id="s-desc" value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })} /></Field></div>
            <Field label="مزایا (هر خط یک مورد)" htmlFor="s-benefits"><Textarea id="s-benefits" value={svcForm.benefits} onChange={(e) => setSvcForm({ ...svcForm, benefits: e.target.value })} /></Field>
            <Field label="مراحل سفارش (هر خط یک مرحله)" htmlFor="s-steps"><Textarea id="s-steps" value={svcForm.steps} onChange={(e) => setSvcForm({ ...svcForm, steps: e.target.value })} /></Field>
            <Field label="پیش‌نیازها (هر خط یک مورد)" htmlFor="s-req"><Textarea id="s-req" value={svcForm.requirements} onChange={(e) => setSvcForm({ ...svcForm, requirements: e.target.value })} /></Field>
            <Field label="عوامل مؤثر در قیمت (هر خط یک مورد)" htmlFor="s-pf"><Textarea id="s-pf" value={svcForm.priceFactors} onChange={(e) => setSvcForm({ ...svcForm, priceFactors: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="فرم پویای سفارش (JSON آرایه سؤال‌ها)" htmlFor="s-q" error={err.questions} hint="نوع‌ها: text, textarea, select, radio, checkbox, number, date, time, file, boolean"><Textarea id="s-q" dir="ltr" className="min-h-40 font-mono text-xs" value={svcForm.questions} onChange={(e) => setSvcForm({ ...svcForm, questions: e.target.value })} error={err.questions} /></Field></div>
            <div className="sm:col-span-2"><Field label="سؤالات متداول (JSON)" htmlFor="s-faq" error={err.faqs}><Textarea id="s-faq" dir="ltr" className="min-h-24 font-mono text-xs" value={svcForm.faqs} onChange={(e) => setSvcForm({ ...svcForm, faqs: e.target.value })} error={err.faqs} /></Field></div>
            <div className="sm:col-span-2 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <h3 className="text-sm font-bold sm:col-span-2">سئو و نمایش</h3>
              <Field label="عنوان سئو" htmlFor="s-seo-t"><Input id="s-seo-t" value={svcForm.seoTitle} onChange={(e) => setSvcForm({ ...svcForm, seoTitle: e.target.value })} /></Field>
              <Field label="رنگ" htmlFor="s-tone"><Select id="s-tone" value={svcForm.tone} onChange={(e) => setSvcForm({ ...svcForm, tone: e.target.value })}>{CATEGORY_TONES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
              <div className="sm:col-span-2"><Field label="توضیح سئو" htmlFor="s-seo-d"><Textarea id="s-seo-d" value={svcForm.seoDescription} onChange={(e) => setSvcForm({ ...svcForm, seoDescription: e.target.value })} /></Field></div>
              <label className="flex items-center gap-3 text-sm"><Toggle checked={svcForm.isPopular} onChange={(v) => setSvcForm({ ...svcForm, isPopular: v })} label="پرطرفدار" />پرطرفدار</label>
              <label className="flex items-center gap-3 text-sm"><Toggle checked={svcForm.isActive} onChange={(v) => setSvcForm({ ...svcForm, isActive: v })} label="فعال بودن خدمت" />خدمت فعال باشد (قابل سفارش)</label>
            </div>
            {err.form && <p role="alert" className="text-sm text-danger sm:col-span-2">{err.form}</p>}
          </div>
        )}
      </Modal>
    </DashShell>
  );
}

// =====================================================================
// Orders
// =====================================================================

type AdminOrderRow = { id: number; code: string; status: OrderStatus; paymentStatus: string; disputeStatus: string; serviceTitle: string; customerName: string; professionalName: string | null; total: number; city: string; createdAt: string };
type AdminOrderDetail = {
  order: { id: number; code: string; status: OrderStatus; paymentStatus: string; disputeStatus: string; disputeNote: string; cancelReason: string | null; total: number; estimatedPrice: number; urgentFee: number; serviceFee: number; discount: number; city: string; region: string; addressLine: string; scheduledAt: string; timeSlot: string; createdAt: string; statusHistory: { status: OrderStatus; at: string; note: string }[] };
  service: { title: string };
  customer: { fullName: string; phone: string };
  professional: { fullName: string; phone: string } | null;
  offers: { id: number; price: number; arrivalMinutes: number; status: string; isDemo: boolean; professionalName: string }[];
  payments: { id: number; amount: number; status: string; provider: string; providerRef: string; createdAt: string }[];
};

function AdminOrders({ user }: { user: ViewUser }) {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const list = useApi<AdminOrderRow[]>(`/admin/orders?status=${status}&q=${encodeURIComponent(q)}`);
  const pros = useApi<{ id: string; fullName: string }[]>("/admin/pro-options");
  const { run, busy } = useAction();
  const [nextStatus, setNextStatus] = useState<Record<number, string>>({});
  const [assignTo, setAssignTo] = useState<Record<number, string>>({});
  const [cancelReason, setCancelReason] = useState<Record<number, string>>({});
  const { confirm, dialog } = useConfirm();
  return (
    <DashShell user={user} title="مدیریت سفارش‌ها" subtitle="جزئیات کامل، تغییر وضعیت مجاز، واگذاری به متخصص، لغو و رسیدگی به اختلاف‌ها.">
      {dialog}
      <Card className="grid gap-3 p-4 md:grid-cols-[14rem_1fr]">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="فیلتر وضعیت">
          <option value="all">همه وضعیت‌ها</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کد، خدمت یا مشتری" aria-label="جستجوی سفارش" />
      </Card>
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="سفارشی یافت نشد">
        {(rows) => (
          <div className="grid gap-4">
            {rows.map((o) => {
              const allowed = ADMIN_TRANSITIONS_BY_STATUS[o.status].filter((s) => s !== "cancelled");
              const canAssign = ["waiting_offers", "offers_received"].includes(o.status);
              const canCancel = ADMIN_TRANSITIONS_BY_STATUS[o.status].includes("cancelled");
              return (
                <Card key={o.id} className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{o.serviceTitle} <span className="text-xs font-normal text-muted" dir="ltr">{o.code}</span></p>
                      <p className="text-xs text-muted">{o.customerName} · {o.city} · {formatDate(o.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={o.status} />
                      <Badge>{PAYMENT_STATUS_LABELS[o.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS] ?? o.paymentStatus}</Badge>
                      {o.disputeStatus !== "none" && <Badge tone={o.disputeStatus === "open" ? "danger" : "neutral"}>اختلاف: {o.disputeStatus === "open" ? "باز" : "بسته"}</Badge>}
                      <Button size="sm" variant="outline" onClick={() => setDetailId(o.id)}>جزئیات</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span>متخصص: <b>{o.professionalName ?? "—"}</b></span>
                    <span>مبلغ: <b>{formatPrice(o.total)}</b></span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex gap-2">
                      <Select aria-label="وضعیت بعدی" value={nextStatus[o.id] ?? ""} onChange={(e) => setNextStatus({ ...nextStatus, [o.id]: e.target.value })} className="h-10">
                        <option value="">تغییر وضعیت…</option>
                        {allowed.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                      </Select>
                      <Button size="sm" variant="outline" disabled={!nextStatus[o.id] || busy} onClick={async () => { const r = await run("os", () => apiRequest("POST", `/admin/orders/${o.id}/status`, { status: nextStatus[o.id] }), "وضعیت تغییر کرد"); if (r !== undefined) list.reload(); }}>اعمال</Button>
                    </div>
                    {canAssign && (
                      <div className="flex gap-2">
                        <Select aria-label="انتخاب متخصص" value={assignTo[o.id] ?? ""} onChange={(e) => setAssignTo({ ...assignTo, [o.id]: e.target.value })} className="h-10">
                          <option value="">واگذاری به متخصص…</option>
                          {(pros.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </Select>
                        <Button size="sm" variant="outline" disabled={!assignTo[o.id] || busy} onClick={async () => { const r = await run("as", () => apiRequest("POST", `/admin/orders/${o.id}/assign`, { professionalId: assignTo[o.id] }), "واگذار شد"); if (r !== undefined) list.reload(); }}>واگذاری</Button>
                      </div>
                    )}
                    {canCancel && (
                      <div className="flex gap-2">
                        <Input aria-label="دلیل لغو" placeholder="دلیل لغو" value={cancelReason[o.id] ?? ""} onChange={(e) => setCancelReason({ ...cancelReason, [o.id]: e.target.value })} className="h-10" />
                        <Button size="sm" variant="danger" disabled={(cancelReason[o.id] ?? "").length < 3 || busy} onClick={async () => { if (!(await confirm("سفارش لغو شود؟ در صورت پرداخت، بازپرداخت انجام می‌شود."))) return; const r = await run("ac", () => apiRequest("POST", `/admin/orders/${o.id}/cancel`, { reason: cancelReason[o.id] }), "سفارش لغو شد"); if (r !== undefined) list.reload(); }}>لغو</Button>
                      </div>
                    )}
                  </div>
                  {o.disputeStatus !== "none" && (
                    <div>
                      <Button size="sm" variant="soft" onClick={async () => { const r = await run("dp", () => apiRequest("POST", `/admin/orders/${o.id}/dispute`, { disputeStatus: o.disputeStatus === "open" ? "resolved" : "open", note: "بررسی مدیریت" }), "وضعیت اختلاف به‌روز شد"); if (r !== undefined) list.reload(); }}>{o.disputeStatus === "open" ? "بستن اختلاف" : "بازگشایی اختلاف"}</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ApiBlock>
      <Modal open={detailId !== null} onClose={() => setDetailId(null)} title="جزئیات سفارش" size="lg">
        {detailId !== null && <AdminOrderPanel id={detailId} />}
      </Modal>
    </DashShell>
  );
}

function AdminOrderPanel({ id }: { id: number }) {
  const d = useApi<AdminOrderDetail>(`/admin/orders/${id}`);
  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (!d.data) return null;
  const { order, customer, professional, offers, payments, service } = d.data;
  return (
    <div className="space-y-6 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="text-muted">خدمت</p><p className="mt-1 font-semibold">{service.title}</p></div>
        <div><p className="text-muted">کد سفارش</p><p className="mt-1 font-semibold" dir="ltr">{order.code}</p></div>
        <div><p className="text-muted">مشتری</p><p className="mt-1 font-semibold">{customer.fullName} <span dir="ltr" className="text-muted">{customer.phone}</span></p></div>
        <div><p className="text-muted">متخصص</p><p className="mt-1 font-semibold">{professional ? `${professional.fullName} (${professional.phone})` : "—"}</p></div>
        <div className="sm:col-span-2"><p className="text-muted">نشانی و زمان</p><p className="mt-1">{order.city}، {order.region}، {order.addressLine} · {formatDateTime(order.scheduledAt)}</p></div>
        <div><p className="text-muted">وضعیت پرداخت</p><p className="mt-1">{PAYMENT_STATUS_LABELS[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS] ?? order.paymentStatus}</p></div>
        <div><p className="text-muted">جمع کل</p><p className="mt-1 font-bold">{formatPrice(order.total)}</p></div>
      </div>
      {order.disputeNote && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">یادداشت اختلاف: {order.disputeNote}</p>}
      {order.cancelReason && <p className="rounded-xl bg-red-50 p-3 text-danger">دلیل لغو: {order.cancelReason}</p>}
      <section>
        <h3 className="mb-3 font-bold">پیشنهادها ({faNum(offers.length)})</h3>
        {offers.length === 0 ? <p className="text-muted">پیشنهادی ثبت نشده است.</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>{o.professionalName}{o.isDemo && <span className="ms-2 text-xs text-sky-700">(نمایشی)</span>}</span>
                <span className="text-muted">{o.price > 0 ? formatPrice(o.price) : "—"} · {o.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-3 font-bold">پرداخت‌ها</h3>
        {payments.length === 0 ? <p className="text-muted">پرداختی ثبت نشده است.</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span dir="ltr">{p.providerRef}</span>
                <span className="text-muted">{formatPrice(p.amount)} · {p.provider === "sandbox" ? "آزمایشی" : p.provider} · {p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-3 font-bold">تاریخچه وضعیت</h3>
        <OrderTimeline status={order.status} />
        <ul className="mt-4 space-y-2 text-muted">
          {[...order.statusHistory].reverse().map((h, i) => (
            <li key={i}>{h.note || ORDER_STATUS_LABELS[h.status]} · {formatRelative(h.at)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// =====================================================================
// Finance
// =====================================================================

function AdminFinance({ user }: { user: ViewUser }) {
  const data = useApi<{ totals: Record<string, number>; transactions: { id: number; type: TransactionType; amount: number; status: string; description: string; userName: string; createdAt: string }[]; payments: { id: number; orderCode: string; amount: number; status: string; provider: string; createdAt: string }[]; pendingWithdrawals: { id: number; userName: string; amount: number; description: string; createdAt: string }[] }>("/admin/finance");
  const { run, busy } = useAction();
  return (
    <DashShell user={user} title="مالی و پرداخت‌ها" subtitle="پرداخت‌ها، کمیسیون‌ها، بازپرداخت‌ها و درخواست‌های برداشت متخصصان.">
      <ApiBlock state={data}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="پرداخت مشتریان" value={formatPrice(d.totals.payments)} icon="wallet" />
              <StatCard label="کمیسیون پلتفرم" value={formatPrice(d.totals.commissions)} icon="receipt" tone="sky" />
              <StatCard label="بازپرداخت‌ها" value={formatPrice(d.totals.refunds)} icon="banknote" tone="rose" />
              <StatCard label="برداشت‌های در انتظار" value={formatPrice(d.totals.pendingWithdrawals)} icon="clock" tone="amber" />
            </div>
            <Card className="space-y-3 p-6">
              <h2 className="font-bold">درخواست‌های برداشت متخصصان</h2>
              {d.pendingWithdrawals.length === 0 ? <p className="text-sm text-muted">درخواست در انتظاری وجود ندارد.</p> : d.pendingWithdrawals.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-4">
                  <div>
                    <p className="font-semibold">{w.userName} · {formatPrice(w.amount)}</p>
                    <p className="text-xs text-muted">{w.description} · {formatRelative(w.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={busy} onClick={async () => { const r = await run("wa", () => apiRequest("POST", `/admin/withdrawals/${w.id}`, { decision: "approve" }), "برداشت تأیید شد"); if (r !== undefined) data.reload(); }}>تأیید پرداخت</Button>
                    <Button size="sm" variant="danger" loading={busy} onClick={async () => { const r = await run("wr", () => apiRequest("POST", `/admin/withdrawals/${w.id}`, { decision: "reject" }), "درخواست رد شد"); if (r !== undefined) data.reload(); }}>رد</Button>
                  </div>
                </div>
              ))}
            </Card>
            <h2 className="font-bold">تراکنش‌ها</h2>
            <TransactionTable rows={d.transactions.map((t) => ({ ...t, description: `${t.userName} — ${t.description}`, direction: undefined }))} />
            <h2 className="font-bold">پرداخت‌های درگاه ({faNum(d.payments.length)})</h2>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <caption className="sr-only">پرداخت‌های درگاه</caption>
                <thead className="bg-canvas text-xs text-muted"><tr><th scope="col" className="px-4 py-3 text-start">سفارش</th><th scope="col" className="px-4 py-3 text-start">مبلغ</th><th scope="col" className="px-4 py-3 text-start">درگاه</th><th scope="col" className="px-4 py-3 text-start">وضعیت</th><th scope="col" className="px-4 py-3 text-start">تاریخ</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.payments.map((p) => (
                    <tr key={p.id}><td className="px-4 py-3" dir="ltr">{p.orderCode}</td><td className="px-4 py-3">{formatPrice(p.amount)}</td><td className="px-4 py-3">{p.provider === "sandbox" ? "آزمایشی" : p.provider}</td><td className="px-4 py-3">{PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS] ?? p.status}</td><td className="px-4 py-3 text-muted">{formatDateTime(p.createdAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </ApiBlock>
    </DashShell>
  );
}

// =====================================================================
// Content: banners, FAQs, blog, pages, coupons, reviews
// =====================================================================

type FieldDef = { key: string; label: string; kind?: "text" | "textarea" | "number" | "bool" | "select"; options?: readonly string[]; ltr?: boolean };
type KindDef = { id: "banners" | "faqs" | "blog" | "pages" | "coupons"; label: string; primary: string; secondary: string; fields: FieldDef[] };

const CONTENT_KINDS: KindDef[] = [
  { id: "banners", label: "بنرها", primary: "title", secondary: "subtitle", fields: [
    { key: "title", label: "عنوان" }, { key: "subtitle", label: "متن توضیح", kind: "textarea" }, { key: "ctaLabel", label: "متن دکمه" },
    { key: "ctaHref", label: "مسیر دکمه", ltr: true }, { key: "tone", label: "رنگ", kind: "select", options: ["emerald", "sky", "amber", "rose", "violet", "lime"] },
    { key: "sortOrder", label: "ترتیب نمایش", kind: "number", ltr: true }, { key: "isActive", label: "فعال", kind: "bool" },
  ] },
  { id: "faqs", label: "سؤالات متداول", primary: "question", secondary: "answer", fields: [
    { key: "question", label: "سؤال" }, { key: "answer", label: "پاسخ", kind: "textarea" },
    { key: "scope", label: "نمایش در", kind: "select", options: ["home", "general"] }, { key: "sortOrder", label: "ترتیب", kind: "number", ltr: true }, { key: "isActive", label: "فعال", kind: "bool" },
  ] },
  { id: "blog", label: "مقالات", primary: "title", secondary: "excerpt", fields: [
    { key: "slug", label: "نامک (انگلیسی یا فارسی، بدون فاصله)", ltr: true }, { key: "title", label: "عنوان" }, { key: "excerpt", label: "خلاصه", kind: "textarea" },
    { key: "body", label: "متن (پاراگراف‌ها با یک خط خالی جدا شوند)", kind: "textarea" }, { key: "isPublished", label: "منتشر شده", kind: "bool" },
  ] },
  { id: "pages", label: "صفحات ثابت", primary: "title", secondary: "slug", fields: [
    { key: "slug", label: "نامک (مثلاً about)", ltr: true }, { key: "title", label: "عنوان" }, { key: "body", label: "متن (پاراگراف‌ها با یک خط خالی جدا شوند)", kind: "textarea" }, { key: "isPublished", label: "منتشر شده", kind: "bool" },
  ] },
  { id: "coupons", label: "کدهای تخفیف", primary: "code", secondary: "percent", fields: [
    { key: "code", label: "کد", ltr: true }, { key: "percent", label: "درصد تخفیف", kind: "number", ltr: true }, { key: "maxAmount", label: "سقف تخفیف (تومان)", kind: "number", ltr: true },
    { key: "minTotal", label: "حداقل مبلغ سفارش (تومان)", kind: "number", ltr: true }, { key: "isActive", label: "فعال", kind: "bool" },
  ] },
];

function AdminContent({ user }: { user: ViewUser }) {
  const [kind, setKind] = useState<string>("banners");
  const isReview = kind === "reviews";
  const meta = CONTENT_KINDS.find((k) => k.id === kind);
  const list = useApi<Record<string, unknown>[]>(isReview ? "/admin/reviews" : `/admin/content/${kind}`);
  const { run, runStrict, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  function openNew() {
    setErr({});
    setDraft(meta ? Object.fromEntries(meta.fields.map((f) => [f.key, f.kind === "bool" ? (f.key === "isPublished" ? false : true) : f.kind === "number" ? (f.key === "percent" ? 10 : f.key === "maxAmount" ? 100000 : 0) : f.key === "tone" ? "emerald" : f.key === "scope" ? "home" : f.key === "ctaLabel" ? "مشاهده" : f.key === "ctaHref" ? "/categories" : ""])) : null);
  }

  function openEdit(row: Record<string, unknown>) {
    setErr({});
    if (!meta) return;
    setDraft({ id: row.id, ...Object.fromEntries(meta.fields.map((f) => [f.key, row[f.key] ?? (f.kind === "bool" ? false : f.kind === "number" ? 0 : "")])) });
  }

  async function save() {
    if (!draft || !meta) return;
    setErr({});
    const body: Record<string, unknown> = {};
    for (const f of meta.fields) {
      const v = draft[f.key];
      body[f.key] = f.kind === "number" ? Number(v) : f.kind === "bool" ? Boolean(v) : String(v ?? "");
    }
    if (draft.id) body.id = Number(draft.id);
    try {
      await runStrict("content-save", () => apiRequest("POST", `/admin/content/${kind}`, body), "ذخیره شد");
      setDraft(null);
      list.reload();
    } catch (e) {
      setErr(errorsFrom(e));
    }
  }

  return (
    <DashShell user={user} title="محتوا، تخفیف‌ها و نظرات" subtitle="بنرهای صفحه اصلی، سؤالات متداول، مقالات، صفحات ثابت، کدهای تخفیف و مدیریت نظرات." actions={!isReview ? <Button size="sm" onClick={openNew}>افزودن</Button> : undefined}>
      {dialog}
      <Tabs items={[...CONTENT_KINDS.map((k) => ({ value: k.id, label: k.label })), { value: "reviews", label: "نظرات" }]} value={kind} onChange={setKind} />
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="موردی ثبت نشده است">
        {(rows) => (
          <div className="grid gap-3">
            {rows.map((row) => {
              const id = Number(row.id);
              const primary = String(row[meta?.primary ?? "comment"] ?? row.authorName ?? "");
              const secondary = String(row[meta?.secondary ?? "body"] ?? row.serviceTitle ?? "");
              const active = row.isActive ?? row.isPublished ?? row.status !== "hidden";
              return (
                <Card key={id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{primary}</p>
                    <p className="truncate text-xs text-muted">{secondary}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge tone={active ? "success" : "neutral"}>{active ? "فعال / منتشر" : "غیرفعال"}</Badge>
                    {isReview ? (
                      <Button size="sm" variant="outline" loading={busy} onClick={async () => { const r = await run("mod", () => apiRequest("POST", `/admin/reviews/${id}/moderate`, { status: row.status === "hidden" ? "published" : "hidden" }), "وضعیت نظر تغییر کرد"); if (r !== undefined) list.reload(); }}>
                        {row.status === "hidden" ? "انتشار" : "پنهان‌سازی"}
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>ویرایش</Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={async () => { if (!(await confirm("این مورد حذف شود؟"))) return; const r = await run("del", () => apiRequest("DELETE", `/admin/content/${kind}/${id}`), "حذف شد"); if (r !== undefined) list.reload(); }}>حذف</Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </ApiBlock>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "ویرایش" : "افزودن"} size="lg" footer={<><Button variant="outline" onClick={() => setDraft(null)}>انصراف</Button><Button loading={busy} onClick={save}>ذخیره</Button></>}>
        {draft && meta && (
          <div className="grid gap-4 sm:grid-cols-2">
            {meta.fields.map((f) => {
              const id = `ct-${f.key}`;
              const value = draft[f.key];
              if (f.kind === "bool") {
                return (
                  <label key={f.key} className="flex items-center gap-3 text-sm sm:col-span-2">
                    <Toggle checked={value === true} onChange={(v) => setDraft({ ...draft, [f.key]: v })} label={f.label} />
                    {f.label}
                  </label>
                );
              }
              const wide = f.kind === "textarea";
              return (
                <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
                  <Field label={f.label} htmlFor={id} error={err[f.key]}>
                    {f.kind === "textarea" ? (
                      <Textarea id={id} value={String(value ?? "")} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} error={err[f.key]} className="min-h-28" />
                    ) : f.kind === "select" ? (
                      <Select id={id} value={String(value ?? "")} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    ) : (
                      <Input id={id} dir={f.ltr ? "ltr" : undefined} inputMode={f.kind === "number" ? "numeric" : undefined} value={String(value ?? "")} onChange={(e) => setDraft({ ...draft, [f.key]: f.kind === "number" ? e.target.value.replace(/[^\d]/g, "") : e.target.value })} error={err[f.key]} />
                    )}
                  </Field>
                </div>
              );
            })}
            {err.form && <p role="alert" className="text-sm text-danger sm:col-span-2">{err.form}</p>}
          </div>
        )}
      </Modal>
    </DashShell>
  );
}

// =====================================================================
// Reports
// =====================================================================

function AdminReports({ user }: { user: ViewUser }) {
  const data = useApi<{ months: string[]; customerGrowth: number[]; proGrowth: number[]; orderTrend: number[]; revenueTrend: number[]; statusCounts: { status: OrderStatus; count: number }[]; rates: { cancellation: number; conversion: number }; totals: { orders: number; revenue: number; refunds: number }; topServices: { title: string; count: number; revenue: number }[]; definitions: Record<string, string> }>("/admin/reports");
  return (
    <DashShell user={user} title="گزارش‌ها" subtitle="روند درآمد، سفارش‌ها و رشد کاربران در شش ماه گذشته. تعریف هر نرخ زیر کارت آن آمده است.">
      <ApiBlock state={data}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="کل درآمد پرداختی" value={formatPrice(d.totals.revenue)} icon="wallet" />
              <StatCard label="کل سفارش‌ها" value={faNum(d.totals.orders)} icon="package" tone="sky" />
              <StatCard label="نرخ لغو" value={`${faNum((d.rates.cancellation * 100).toFixed(1))}٪`} icon="x" tone="rose" hint={d.definitions.cancellation} />
              <StatCard label="نرخ تبدیل" value={`${faNum((d.rates.conversion * 100).toFixed(1))}٪`} icon="check" tone="amber" hint={d.definitions.conversion} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6"><h2 className="mb-3 font-bold">درآمد ماهانه</h2><BarChart values={d.revenueTrend} labels={d.months} /></Card>
              <Card className="p-6"><h2 className="mb-3 font-bold">سفارش‌های ماهانه</h2><BarChart values={d.orderTrend} labels={d.months} /></Card>
              <Card className="p-6"><h2 className="mb-3 font-bold">رشد مشتریان (ثبت‌نام جدید)</h2><BarChart values={d.customerGrowth} labels={d.months} /></Card>
              <Card className="p-6"><h2 className="mb-3 font-bold">رشد متخصصان (ثبت‌نام جدید)</h2><BarChart values={d.proGrowth} labels={d.months} /></Card>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <h2 className="mb-4 font-bold">توزیع وضعیت سفارش‌ها</h2>
                <ul className="space-y-2 text-sm">{d.statusCounts.filter((s) => s.count > 0).map((s) => (<li key={s.status} className="flex justify-between"><span>{ORDER_STATUS_LABELS[s.status]}</span><b>{faNum(s.count)}</b></li>))}</ul>
              </Card>
              <Card className="p-6">
                <h2 className="mb-4 font-bold">پرتقاضاترین خدمات</h2>
                <ul className="space-y-2 text-sm">{d.topServices.map((s) => (<li key={s.title} className="flex justify-between gap-3"><span className="truncate">{s.title}</span><span className="shrink-0 text-muted">{faNum(s.count)} سفارش · {formatPrice(s.revenue)}</span></li>))}</ul>
              </Card>
            </div>
          </>
        )}
      </ApiBlock>
    </DashShell>
  );
}

type AdminOfferRow = { id: number; orderId: number; orderCode: string; serviceTitle: string; professionalName: string; price: number; arrivalMinutes: number; status: string; isDemo: boolean; createdAt: string };
const OFFER_TABS = [
  { value: "all", label: "همه" },
  { value: "submitted", label: "در انتظار انتخاب" },
  { value: "selected", label: "انتخاب‌شده" },
  { value: "declined", label: "انتخاب نشده" },
];
const OFFER_STATUS: Record<string, { label: string; tone: "info" | "success" | "neutral" }> = {
  submitted: { label: "در انتظار انتخاب", tone: "info" },
  selected: { label: "انتخاب‌شده", tone: "success" },
  declined: { label: "انتخاب نشده", tone: "neutral" },
  rejected: { label: "رد شده", tone: "neutral" },
};

/** All offers across orders, filterable by outcome and searchable by code or professional. */
function AdminOffers({ user }: { user: ViewUser }) {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const list = useApi<AdminOfferRow[]>(`/admin/offers?status=${status}`);
  return (
    <DashShell user={user} title="پیشنهادهای متخصصان" subtitle="همه پیشنهادهای ثبت‌شده روی سفارش‌ها و وضعیت انتخاب هرکدام.">
      <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <Tabs items={OFFER_TABS} value={status} onChange={setStatus} />
        <div className="w-full md:w-64">
          <Input type="search" placeholder="جستجو در کد یا نام متخصص" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی پیشنهاد" />
        </div>
      </Card>
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="پیشنهادی با این فیلتر نیست">
        {(rows) => {
          const needle = q.trim();
          const shown = needle ? rows.filter((r) => `${r.orderCode} ${r.professionalName} ${r.serviceTitle}`.includes(needle)) : rows;
          return (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <caption className="sr-only">پیشنهادهای متخصصان</caption>
                <thead className="bg-canvas text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start">سفارش</th>
                    <th scope="col" className="px-4 py-3 text-start">خدمت</th>
                    <th scope="col" className="px-4 py-3 text-start">متخصص</th>
                    <th scope="col" className="px-4 py-3 text-start">قیمت</th>
                    <th scope="col" className="px-4 py-3 text-start">زمان حضور</th>
                    <th scope="col" className="px-4 py-3 text-start">وضعیت</th>
                    <th scope="col" className="px-4 py-3 text-start">ثبت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((r) => {
                    const st = OFFER_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium" dir="ltr">{r.orderCode}</td>
                        <td className="px-4 py-3">{r.serviceTitle}</td>
                        <td className="px-4 py-3">{r.professionalName}{r.isDemo && <span className="ms-2 text-xs text-sky-700">(نمایشی)</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{r.price > 0 ? formatPrice(r.price) : "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{r.arrivalMinutes ? `${faNum(r.arrivalMinutes)} دقیقه` : "—"}</td>
                        <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{formatRelative(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        }}
      </ApiBlock>
    </DashShell>
  );
}

type AuditRow = { id: number; actorId: string | null; action: string; entity: string; entityId: string; details: string; createdAt: string };

/** Activity log of administrative actions, newest first, searchable. */
function AdminLogs({ user }: { user: ViewUser }) {
  const logs = useApi<AuditRow[]>("/admin/audit");
  const [q, setQ] = useState("");
  return (
    <DashShell user={user} title="گزارش فعالیت مدیران" subtitle="تغییرات مهم سامانه: تأیید متخصص، تغییر وضعیت سفارش، ویرایش محتوا و تنظیمات.">
      <Card className="p-4">
        <Input type="search" placeholder="جستجو در عملیات، موجودیت یا شرح" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی فعالیت" />
      </Card>
      <ApiBlock state={logs} empty={(d) => d.length === 0} emptyTitle="فعالیتی ثبت نشده است">
        {(rows) => {
          const needle = q.trim();
          const shown = needle ? rows.filter((r) => `${r.action} ${r.entity} ${r.details}`.includes(needle)) : rows;
          return (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">گزارش فعالیت</caption>
                <thead className="bg-canvas text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start">زمان</th>
                    <th scope="col" className="px-4 py-3 text-start">عملیات</th>
                    <th scope="col" className="px-4 py-3 text-start">موجودیت</th>
                    <th scope="col" className="px-4 py-3 text-start">شرح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(r.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium" dir="ltr">{r.action}</td>
                      <td className="px-4 py-3 text-muted">{r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</td>
                      <td className="px-4 py-3 text-muted">{r.details || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        }}
      </ApiBlock>
    </DashShell>
  );
}

// Re-exported for the admin pages that render a status-aware empty state.
export { ErrorState as AdminErrorState, formatDateTime, Modal as AdminModal, Button as AdminButton, ApiClientError as AdminApiError, Tabs as AdminTabs, Card as AdminCard, Badge as AdminBadge };
