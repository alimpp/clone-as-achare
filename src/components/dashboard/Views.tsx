"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FileText, Heart, LogOut, Paperclip, Send, Star } from "lucide-react";
import {
  apiRequest,
  Avatar,
  Badge,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonCards,
  Spinner,
  StatCard,
  Stars,
  Tabs,
  Textarea,
  Toggle,
  useAction,
  useApi,
  useConfirm,
  useToast,
} from "@/components/ui";
import { Logo } from "@/components/layout/SiteHeader";
import { SelectField } from "@/components/forms/SelectField";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import {
  CITIES,
  DISPUTE_STATUSES,
  faNum,
  formatDate,
  formatDateTime,
  formatPrice,
  formatRelative,
  NOTIFICATION_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  ORDER_TIMELINE,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
  ROLE_LABELS,
  TIME_SLOTS,
  TRANSACTION_LABELS,
  type FormQuestion,
  type NotificationType,
  type OrderStatus,
  type PaymentStatus,
  type Role,
  type TransactionType,
} from "@/lib/domain";

export type ViewUser = { id: string; fullName: string; role: Role; phone: string; phoneVerified: boolean; avatarUrl: string | null };


// ---------- Navigation ----------

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: Record<Role, NavItem[]> = {
  customer: [
    { href: "/account", label: "داشبورد", icon: "dashboard" },
    { href: "/account/orders", label: "سفارش‌های من", icon: "package" },
    { href: "/account/messages", label: "پیام‌ها", icon: "message" },
    { href: "/account/addresses", label: "نشانی‌ها", icon: "shield" },
    { href: "/account/favorites", label: "علاقه‌مندی‌ها", icon: "heart" },
    { href: "/account/reviews", label: "نظرات", icon: "star" },
    { href: "/account/notifications", label: "اعلان‌ها", icon: "bell" },
    { href: "/account/wallet", label: "کیف پول", icon: "wallet" },
    { href: "/account/security", label: "امنیت و رمز عبور", icon: "shield" },
    { href: "/account/profile", label: "پروفایل", icon: "settings" },
  ],
  professional: [
    { href: "/pro", label: "داشبورد", icon: "dashboard" },
    { href: "/pro/requests", label: "درخواست‌ها و پیشنهادها", icon: "file" },
    { href: "/pro/jobs", label: "کارهای من", icon: "briefcase" },
    { href: "/pro/calendar", label: "تقویم کاری", icon: "clock" },
    { href: "/pro/earnings", label: "درآمد و برداشت", icon: "banknote" },
    { href: "/pro/reviews", label: "نظرات", icon: "star" },
    { href: "/pro/messages", label: "پیام‌ها", icon: "message" },
    { href: "/pro/notifications", label: "اعلان‌ها", icon: "bell" },
    { href: "/pro/profile", label: "مدیریت پروفایل", icon: "settings" },
  ],
  admin: [
    { href: "/admin", label: "نمای کلی", icon: "dashboard" },
    { href: "/admin/users", label: "کاربران", icon: "users" },
    { href: "/admin/professionals", label: "متخصصان", icon: "badge" },
    { href: "/admin/catalog", label: "خدمات و دسته‌ها", icon: "package" },
    { href: "/admin/orders", label: "سفارش‌ها", icon: "file" },
    { href: "/admin/finance", label: "مالی", icon: "wallet" },
    { href: "/admin/offers", label: "پیشنهادها", icon: "file" },
    { href: "/admin/logs", label: "گزارش فعالیت", icon: "info" },
    { href: "/admin/content", label: "محتوا و تخفیف", icon: "tag" },
    { href: "/admin/reports", label: "گزارش‌ها", icon: "clock" },
  ],
};

const SECTION_ROOT: Record<Role, string> = { customer: "/account", professional: "/pro", admin: "/admin" };

export function DashShell({ user, title, subtitle, children, actions }: { user: ViewUser; title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const items = NAV[user.role];
  const root = SECTION_ROOT[user.role];

  function isActive(href: string) {
    return href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
  }

  async function logout() {
    try {
      await apiRequest("POST", "/auth/logout");
      router.push("/login");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خروج انجام نشد");
    }
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl gap-6 px-4 py-6 md:px-6 md:py-10">
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-2xl border border-line bg-surface p-4 md:flex">
        <div className="mb-6 px-2">
          <Logo compact />
          <p className="mt-2 text-xs font-medium text-muted">پنل {ROLE_LABELS[user.role]}</p>
        </div>
        <nav aria-label="منوی پنل" className="flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${isActive(item.href) ? "bg-brand-soft text-brand-strong before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-brand" : "text-ink hover:bg-slate-50 hover:text-brand"}`}>
              <CategoryIcon name={item.icon} className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-muted" dir="ltr">{user.phone}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger transition hover:bg-red-50">
            <LogOut className="size-4" aria-hidden="true" /> خروج
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-5 md:hidden">
          <SelectField
            label="بخش پنل"
            value={items.find((item) => isActive(item.href))?.href ?? root}
            options={items.map((item) => ({ value: item.href, label: item.label, icon: <CategoryIcon name={item.icon} className="size-4" /> }))}
            onChange={(href) => {
              if (href) router.push(href);
            }}
          />
        </div>
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted">{ROLE_LABELS[user.role]} · {user.fullName}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink md:text-[2rem]">{title}</h1>
            {subtitle && <p className="mt-2 max-w-2xl leading-7 text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
        <div className="stagger space-y-6">{children}</div>
      </div>
    </div>
  );
}

// ---------- Shared building blocks ----------

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return <p className="rounded-xl bg-red-50 p-4 text-sm text-danger">این سفارش لغو شده است.</p>;
  const currentIndex = ORDER_TIMELINE.indexOf(status === "pending" ? "waiting_offers" : status);
  return (
    <ol className="space-y-0" aria-label="مراحل سفارش">
      {ORDER_TIMELINE.map((step, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {i < ORDER_TIMELINE.length - 1 && <span className={`absolute start-[13px] top-7 h-full w-0.5 ${i < currentIndex ? "bg-brand" : "bg-line"}`} aria-hidden="true" />}
            <span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${done ? "bg-brand text-white" : "bg-slate-200 text-muted"} ${current ? "ring-4 ring-brand/20" : ""}`}>
              {done ? "✓" : faNum(i + 1)}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-semibold ${done ? "text-ink" : "text-muted"}`}>{ORDER_STATUS_LABELS[step]}</p>
              {current && <p className="text-xs text-brand">وضعیت فعلی</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Heart toggle backed by the shared favourites context (works for services and professionals). */
export function FavoriteButton({ type, id, label }: { type: "service" | "professional"; id: string; label: string }) {
  const fav = useFavorites();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const active = fav.has(type, id);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `حذف ${label} از علاقه‌مندی‌ها` : `افزودن ${label} به علاقه‌مندی‌ها`}
      disabled={busy || !fav.ready}
      onClick={async () => {
        setBusy(true);
        try {
          const on = await fav.toggle(type, id);
          toast.success(on ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "ذخیره انجام نشد");
        } finally {
          setBusy(false);
        }
      }}
      className={`grid size-11 shrink-0 place-items-center rounded-xl border transition duration-200 active:scale-95 disabled:opacity-60 ${active ? "border-red-200 bg-red-50 text-danger" : "border-line bg-surface text-muted hover:text-danger"}`}
    >
      <Heart className={`size-5 ${active ? "fill-current" : ""}`} aria-hidden="true" />
    </button>
  );
}

export function ListSkeleton() {
  return <SkeletonCards count={3} className="h-28" />;
}

export function ApiBlock<T>({ state, children, empty, emptyTitle }: { state: { data: T | null; error: string | null; loading: boolean; reload: () => void }; children: (data: T) => ReactNode; empty?: (data: T) => boolean; emptyTitle?: string }) {
  if (state.loading && state.data === null) return <ListSkeleton />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (state.data === null) return null;
  if (empty && empty(state.data)) return <EmptyState icon="package" title={emptyTitle ?? "موردی برای نمایش نیست"} />;
  return <>{children(state.data)}</>;
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="امتیاز">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${faNum(n)} ستاره`} onClick={() => onChange(n)} className="grid size-11 place-items-center rounded-lg transition hover:scale-110">
          <Star className={`size-7 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

// ---------- Chat ----------

interface ChatMessage {
  id: number;
  body: string;
  attachment: { name: string; type: string; size: number; dataUrl: string } | null;
  mine: boolean;
  createdAt: string;
}

export function Chat({ orderId, ownRole }: { orderId: number | null; ownRole: Role }) {
  const list = useApi<{ id: number; orderId: number; orderCode: string; serviceTitle: string; otherName: string; lastMessage: string; lastAt: string; unread: number }[]>("/conversations");
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; type: string; size: number; dataUrl: string } | null>(null);
  const [thread, setThread] = useState<{ orderCode: string; serviceTitle: string; messages: ChatMessage[]; orderStatus: string } | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { runStrict, busy } = useAction();
  const toast = useToast();

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    const load = () =>
      apiRequest<{ orderCode: string; serviceTitle: string; messages: ChatMessage[]; orderStatus: string }>("GET", `/conversations/${orderId}`)
        .then((d) => {
          if (alive) {
            setThread(d);
            setThreadError(null);
          }
        })
        .catch((e: unknown) => {
          if (alive) setThreadError(e instanceof Error ? e.message : "خطا");
        });
    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages.length]);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return toast.error("فقط تصویر JPG، PNG یا WebP مجاز است");
    if (f.size > 1_500_000) return toast.error("حجم تصویر حداکثر ۱٫۵ مگابایت است");
    setFile({ name: f.name, type: f.type, size: f.size, dataUrl: await readAsDataUrl(f) });
  }

  async function send() {
    if (!orderId || (!text.trim() && !file)) return;
    try {
      await runStrict("send", () => apiRequest("POST", `/conversations/${orderId}/messages`, { body: text.trim(), attachment: file }));
      setText("");
      setFile(null);
      setThread(await apiRequest<NonNullable<typeof thread>>("GET", `/conversations/${orderId}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ارسال پیام انجام نشد");
    }
  }

  const conversations = list.data ?? [];
  const messagesBase = ownRole === "professional" ? "/pro/messages" : "/account/messages";
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card className="max-h-[70vh] overflow-y-auto p-2">
        {list.loading && !list.data ? (
          <Spinner />
        ) : conversations.length === 0 ? (
          <EmptyState icon="message" title="گفتگویی وجود ندارد" description="پس از انتخاب متخصص برای سفارش، گفتگو با او فعال می‌شود." />
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`${messagesBase}/${c.orderId}`} aria-current={orderId === c.orderId ? "true" : undefined} className={`flex flex-col gap-1 rounded-xl p-3 transition ${orderId === c.orderId ? "bg-brand/10" : "hover:bg-slate-50"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.otherName}</span>
                    {c.unread > 0 && <span className="rounded-full bg-brand px-2 text-xs text-white">{faNum(c.unread)}</span>}
                  </span>
                  <span className="truncate text-xs text-muted">{c.serviceTitle} · {c.orderCode}</span>
                  <span className="truncate text-xs text-muted">{c.lastMessage}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex min-h-[60vh] flex-col overflow-hidden">
        {!orderId ? (
          <EmptyState icon="message" title="یک گفتگو را انتخاب کنید" description="پیام‌های مربوط به هر سفارش در همین بخش نگهداری می‌شوند." />
        ) : threadError ? (
          <div className="p-6"><ErrorState message={threadError} /></div>
        ) : !thread ? (
          <div className="p-6"><Spinner /></div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p className="font-bold">{thread.serviceTitle}</p>
                <p className="text-xs text-muted">سفارش {thread.orderCode} · {ORDER_STATUS_LABELS[thread.orderStatus as OrderStatus]}</p>
              </div>
              <span className="rounded-full bg-mint/40 px-3 py-1 text-xs text-brand-strong">به‌روزرسانی خودکار</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/60 p-5" aria-live="polite">
              {thread.messages.length === 0 && <p className="py-10 text-center text-sm text-muted">هنوز پیامی ارسال نشده است.</p>}
              {thread.messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${m.mine ? "rounded-ee-sm bg-brand text-white" : "rounded-es-sm bg-surface text-ink"}`}>
                    {m.attachment && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.attachment.dataUrl} alt={m.attachment.name} className="mb-2 max-h-48 rounded-lg" />
                    )}
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    <p className={`mt-1 text-[11px] ${m.mine ? "text-white/70" : "text-muted"}`}>{formatRelative(m.createdAt)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="flex items-end gap-2 border-t border-line p-4" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line text-muted hover:text-brand">
                <span className="sr-only">افزودن تصویر</span>
                <Paperclip className="size-5" aria-hidden="true" />
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0])} />
              </label>
              <div className="min-w-0 flex-1">
                {file && <p className="mb-1 truncate text-xs text-brand">پیوست: {file.name}</p>}
                <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="پیام خود را بنویسید…" aria-label="متن پیام" maxLength={2000} className="min-h-11 resize-none py-2.5" />
              </div>
              <Button type="submit" loading={busy} disabled={!text.trim() && !file} icon={<Send className="size-4 rtl:rotate-180" />}>ارسال</Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------- Customer: orders ----------

export type OrderListItem = {
  id: number;
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  serviceTitle: string;
  total: number;
  scheduledAt: string;
  timeSlot: string;
  professionalName: string | null;
  city: string;
  urgent: boolean;
};

type OrderDetail = {
  order: {
    id: number;
    code: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    disputeStatus: string;
    estimatedPrice: number;
    urgentFee: number;
    serviceFee: number;
    discount: number;
    total: number;
    city: string;
    region: string;
    addressLine: string;
    addressDetails: string;
    scheduledAt: string;
    timeSlot: string;
    notes: string;
    cancelReason: string | null;
    statusHistory: { status: OrderStatus; at: string; note: string }[];
    createdAt: string;
    couponCode: string | null;
  };
  service: { title: string; slug: string };
  professional: { userId: string; fullName: string; phone: string } | null;
  offers: {
    id: number;
    price: number;
    arrivalMinutes: number;
    description: string;
    status: string;
    isDemo: boolean;
    professional: { userId: string; fullName: string; headline: string; rating: number; reviewsCount: number; completedJobs: number; experienceYears: number; verified: boolean; avatarTone: string } | null;
    latestReview: { rating: number; comment: string; author: string } | null;
  }[];
  payments: { id: number; amount: number; status: string; providerRef: string; failureReason: string | null; createdAt: string }[];
  conversationId: number | null;
  review: { id: number; rating: number; comment: string; reply: string | null; createdAt: string } | null;
  canCancel: boolean;
  canReschedule: boolean;
};

const ORDER_FILTERS = [
  { value: "all", label: "همه" },
  { value: "waiting_offers", label: "در انتظار پیشنهاد" },
  { value: "professional_selected", label: "انتخاب‌شده" },
  { value: "confirmed", label: "تأیید شده" },
  { value: "in_progress", label: "در حال انجام" },
  { value: "completed", label: "انجام شده" },
  { value: "cancelled", label: "لغو شده" },
];

function OrdersList() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const qs = new URLSearchParams({ status, ...(q ? { q } : {}) }).toString();
  const orders = useApi<OrderListItem[]>(`/orders?${qs}`);
  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <Tabs items={ORDER_FILTERS.map((f) => ({ value: f.value, label: f.label }))} value={status} onChange={setStatus} />
        <div className="w-full md:w-64">
          <Input type="search" placeholder="جستجو در کد، خدمت یا شهر" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی سفارش" />
        </div>
      </Card>
      <ApiBlock state={orders} empty={(d) => d.length === 0} emptyTitle="سفارشی با این فیلتر وجود ندارد">
        {(list) => (
          <div className="grid gap-4">
            {list.map((o) => (
              <Card key={o.id} interactive className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{o.serviceTitle}</span>
                    <span className="text-xs text-muted" dir="ltr">{o.code}</span>
                    {o.urgent && <Badge tone="danger">فوری</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(o.scheduledAt)} · {TIME_SLOTS.find((t) => t.id === o.timeSlot)?.label} · {o.city}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={o.status} />
                    <PaymentBadge status={o.paymentStatus} />
                    {o.professionalName && <Badge>متخصص: {o.professionalName}</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
                  <p className="font-bold">{o.total ? formatPrice(o.total) : "—"}</p>
                  <Button href={`/account/orders/${o.id}`} size="sm" variant="outline">جزئیات و پیگیری</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>
    </div>
  );
}

/** Customer review of a completed order: shows it and allows editing within 7 days. */
function ReviewBlock({ review, onSaved }: { review: NonNullable<OrderDetail["review"]>; onSaved: () => void }) {
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const editable = Date.now() - new Date(review.createdAt).getTime() < 7 * 86_400_000;
  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">نظر شما</h2>
        {editable && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>ویرایش نظر</Button>}
      </div>
      {editing ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run("review-edit", () => apiRequest("PUT", `/reviews/${review.id}`, { rating, comment }), "نظر ویرایش شد");
            if (r !== undefined) {
              setEditing(false);
              onSaved();
            }
          }}
        >
          <StarPicker value={rating} onChange={setRating} />
          <Field label="نظر شما" htmlFor="review-edit-text" hint="حداقل ۱۰ کاراکتر">
            <Textarea id="review-edit-text" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={comment.trim().length < 10}>ذخیره</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>انصراف</Button>
          </div>
        </form>
      ) : (
        <>
          <Stars value={review.rating} />
          <p className="leading-7">{review.comment}</p>
          {review.reply && <p className="rounded-xl bg-canvas p-3 text-sm text-muted">پاسخ متخصص: {review.reply}</p>}
          {!editable && <p className="text-xs text-muted">مهلت ویرایش نظر (۷ روز) گذشته است.</p>}
        </>
      )}
    </Card>
  );
}

function OrderDetailView({ id, user }: { id: number; user: ViewUser }) {
  const detail = useApi<OrderDetail>(`/orders/${id}`);
  const toast = useToast();
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newSlot, setNewSlot] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");
  const [sandboxRef, setSandboxRef] = useState<string | null>(null);
  const status = detail.data?.order.status;

  // Poll while the order is still waiting for offers or payment.
  useEffect(() => {
    if (!status || !["waiting_offers", "pending", "offers_received"].includes(status)) return;
    const t = window.setInterval(() => detail.reload(), 4000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (detail.loading && !detail.data) return <SkeletonCards count={2} className="h-40" />;
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return null;
  const d = detail.data;
  const o = d.order;

  async function selectOffer(offerId: number) {
    const ok = await confirm("این متخصص انتخاب شود؟ پس از انتخاب، پیشنهادهای دیگر بسته می‌شوند.");
    if (!ok) return;
    const res = await run("select", () => apiRequest("POST", `/orders/${id}/select-offer`, { offerId }), "متخصص انتخاب شد");
    if (res !== undefined) detail.reload();
  }

  async function startPayment() {
    const res = await run("init", () => apiRequest<{ providerRef: string }>("POST", `/orders/${id}/payment/init`));
    if (res) setSandboxRef(res.providerRef);
  }

  async function verifyPayment(outcome: "success" | "failed") {
    const res = await run("pay", () => apiRequest("POST", `/orders/${id}/payment/verify`, { outcome }), outcome === "success" ? "پرداخت آزمایشی موفق ثبت شد" : "پرداخت ناموفق ثبت شد");
    setSandboxRef(null);
    if (res !== undefined) detail.reload();
  }

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/account/orders" className="text-brand hover:underline">← همه سفارش‌ها</Link>
        <span className="text-muted">/</span>
        <span className="font-semibold" dir="ltr">{o.code}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{d.service.title}</h2>
                <p className="mt-1 text-sm text-muted">ثبت شده در {formatDateTime(o.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={o.status} />
                <PaymentBadge status={o.paymentStatus} />
              </div>
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">زمان قرار</dt><dd className="mt-1 font-medium">{formatDate(o.scheduledAt)} · {TIME_SLOTS.find((t) => t.id === o.timeSlot)?.label}</dd></div>
              <div><dt className="text-muted">نشانی</dt><dd className="mt-1 font-medium">{o.city}، {o.region}، {o.addressLine} {o.addressDetails && `(${o.addressDetails})`}</dd></div>
              {o.notes && <div className="sm:col-span-2"><dt className="text-muted">توضیحات</dt><dd className="mt-1 leading-7">{o.notes}</dd></div>}
              {o.cancelReason && <div className="sm:col-span-2"><dt className="text-muted">دلیل لغو</dt><dd className="mt-1 text-danger">{o.cancelReason}</dd></div>}
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              {d.canReschedule && <Button variant="outline" size="sm" onClick={() => setRescheduleOpen(true)}>تغییر زمان</Button>}
              {d.canCancel && <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>لغو سفارش</Button>}
              {o.total > 0 && <Button href={`/account/orders/${id}/invoice`} variant="outline" size="sm" icon={<FileText className="size-4" aria-hidden="true" />}>صورت‌حساب</Button>}
              {(o.status === "completed" || o.status === "in_progress") && o.disputeStatus === "none" && <Button variant="outline" size="sm" onClick={() => setDisputeOpen(true)}>ثبت اختلاف</Button>}
              {o.disputeStatus !== "none" && <Badge tone="warning">اختلاف: {DISPUTE_STATUSES.includes(o.disputeStatus as never) ? (o.disputeStatus === "open" ? "باز" : "بررسی شده") : o.disputeStatus}</Badge>}
            </div>
          </Card>

          {(o.status === "waiting_offers" || o.status === "pending") && (
            <Card className="flex items-center gap-4 border-brand/20 p-6">
              <Spinner className="size-8" />
              <div>
                <p className="font-bold">در انتظار پیشنهاد متخصصان</p>
                <p className="mt-1 text-sm text-muted">درخواست شما برای متخصصان تأییدشده منطقه ارسال شد. این صفحه به‌صورت خودکار به‌روز می‌شود.</p>
              </div>
            </Card>
          )}

          {o.status === "offers_received" && (
            <section aria-labelledby="offers-title" className="space-y-4">
              <div className="flex items-end justify-between">
                <h2 id="offers-title" className="text-lg font-bold">پیشنهادهای متخصصان ({faNum(d.offers.length)})</h2>
                <p className="text-xs text-muted">برای مقایسه، قیمت و زمان حضور را بسنجید.</p>
              </div>
              <div className="grid gap-4">
                {d.offers.map((offer) => (
                  <Card key={offer.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <Avatar name={offer.professional?.fullName ?? "متخصص"} tone={offer.professional?.avatarTone} size="lg" verified={offer.professional?.verified} />
                      <div className="min-w-0">
                        <p className="font-bold">{offer.professional?.fullName}</p>
                        <p className="text-sm text-muted">{offer.professional?.headline}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                          <Stars value={offer.professional?.rating ?? 0} size="size-3.5" />
                          <span>{faNum(offer.professional?.completedJobs ?? 0)} سفارش</span>
                          <span>{faNum(offer.professional?.experienceYears ?? 0)} سال سابقه</span>
                          {offer.professional?.verified && <Badge tone="brand">تأیید شده</Badge>}
                          {offer.isDemo && <Badge tone="info">پیشنهاد نمایشی</Badge>}
                        </div>
                        <p className="mt-2 text-sm leading-6">{offer.description}</p>
                        {offer.latestReview && <p className="mt-2 rounded-lg bg-canvas p-2.5 text-xs leading-5 text-muted">«{offer.latestReview.comment}» — {offer.latestReview.author}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 md:w-48 md:flex-col md:items-stretch">
                      <div className="text-start md:text-center">
                        <p className="text-xs text-muted">برآورد قیمت</p>
                        <p className="text-lg font-bold">{formatPrice(offer.price)}</p>
                        <p className="text-xs text-muted">حضور تا {faNum(offer.arrivalMinutes)} دقیقه دیگر</p>
                      </div>
                      <Button onClick={() => selectOffer(offer.id)} loading={busy} size="sm">انتخاب این متخصص</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {o.status === "professional_selected" && o.paymentStatus !== "paid" && (
            <Card className="space-y-5 p-6">
              <h2 className="text-lg font-bold">خلاصه سفارش و پرداخت</h2>
              <PriceBreakdownView order={o} />
              {d.professional && <p className="text-sm text-muted">متخصص: <span className="font-semibold text-ink">{d.professional.fullName}</span></p>}
              {sandboxRef ? (
                <div className="animate-fade-up rounded-2xl border border-amber-300 bg-amber-50 p-5">
                  <p className="font-bold text-amber-900">درگاه پرداخت آزمایشی (Sandbox)</p>
                  <p className="mt-2 text-sm leading-7 text-amber-900/80">هیچ مبلغ واقعی پرداخت نمی‌شود. کد مرجع: <span dir="ltr" className="font-mono">{sandboxRef}</span></p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button loading={busy} onClick={() => verifyPayment("success")}>شبیه‌سازی: پرداخت موفق</Button>
                    <Button variant="danger" loading={busy} onClick={() => verifyPayment("failed")}>شبیه‌سازی: پرداخت ناموفق</Button>
                  </div>
                </div>
              ) : (
                <Button size="lg" loading={busy} onClick={startPayment}>تأیید خلاصه و پرداخت آزمایشی</Button>
              )}
              {d.payments[0]?.status === "failed" && <p role="alert" className="text-sm text-danger">آخرین پرداخت ناموفق بود؛ می‌توانید دوباره تلاش کنید.</p>}
            </Card>
          )}

          {d.conversationId && (
            <Card className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-bold">گفتگو با متخصص</p>
                <p className="text-sm text-muted">پیام‌های مربوط به این سفارش</p>
              </div>
              <Button href={`/account/messages/${o.id}`} variant="soft" size="sm">باز کردن گفتگو</Button>
            </Card>
          )}

          {o.status === "completed" && !d.review && (
            <Card className="space-y-4 p-6">
              <h2 className="text-lg font-bold">امتیاز و نظر شما</h2>
              <StarPicker value={reviewRating} onChange={setReviewRating} />
              <Field label="نظر شما" htmlFor="review-text" hint="حداقل ۱۰ کاراکتر">
                <Textarea id="review-text" value={reviewText} onChange={(e) => setReviewText(e.target.value)} maxLength={1000} placeholder="تجربه خود را از این خدمت بنویسید" />
              </Field>
              <Button
                loading={busy}
                disabled={reviewText.trim().length < 10}
                onClick={async () => {
                  const res = await run("review", () => apiRequest("POST", `/orders/${id}/review`, { rating: reviewRating, comment: reviewText }), "نظر شما ثبت شد");
                  if (res !== undefined) detail.reload();
                }}
              >
                ثبت نظر
              </Button>
            </Card>
          )}
          {d.review && <ReviewBlock review={d.review} onSaved={detail.reload} />}
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-5 font-bold">پیگیری سفارش</h2>
            <OrderTimeline status={o.status} />
          </Card>
          {o.status !== "offers_received" && o.total > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 font-bold">صورت‌حساب</h2>
              <PriceBreakdownView order={o} />
            </Card>
          )}
          <Card className="p-6">
            <h2 className="mb-3 font-bold">تاریخچه</h2>
            <ul className="space-y-3 text-sm">
              {[...o.statusHistory].reverse().map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{h.note || ORDER_STATUS_LABELS[h.status]}</span>
                  <span className="shrink-0 text-xs text-muted">{formatRelative(h.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="لغو سفارش" size="sm" footer={
        <>
          <Button variant="outline" onClick={() => setCancelOpen(false)}>بازگشت</Button>
          <Button variant="danger" loading={busy} disabled={cancelReason.trim().length < 3} onClick={async () => {
            const res = await run("cancel", () => apiRequest("POST", `/orders/${id}/cancel`, { reason: cancelReason }), "سفارش لغو شد");
            if (res !== undefined) { setCancelOpen(false); detail.reload(); }
          }}>تأیید لغو</Button>
        </>
      }>
        <Field label="دلیل لغو" htmlFor="cancel-reason" required hint="در صورت پرداخت، مبلغ به کیف پول شما بازمی‌گردد.">
          <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="مثلاً زمان دیگری نیاز دارم" />
        </Field>
      </Modal>

      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="تغییر زمان قرار" size="sm" footer={
        <>
          <Button variant="outline" onClick={() => setRescheduleOpen(false)}>انصراف</Button>
          <Button loading={busy} disabled={!newDate || !newSlot} onClick={async () => {
            const res = await run("resched", () => apiRequest("POST", `/orders/${id}/reschedule`, { scheduledDate: newDate, timeSlot: newSlot }), "زمان قرار تغییر کرد");
            if (res !== undefined) { setRescheduleOpen(false); detail.reload(); }
          }}>ثبت زمان جدید</Button>
        </>
      }>
        <div className="space-y-4">
          <DatePicker value={newDate} onChange={setNewDate} />
          <TimeSlotPicker value={newSlot} onChange={setNewSlot} />
        </div>
      </Modal>

      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title="ثبت اختلاف" size="sm" footer={
        <>
          <Button variant="outline" onClick={() => setDisputeOpen(false)}>انصراف</Button>
          <Button variant="danger" loading={busy} disabled={disputeNote.trim().length < 10} onClick={async () => {
            const res = await run("dispute", () => apiRequest("POST", `/orders/${id}/dispute`, { note: disputeNote }), "اختلاف ثبت شد");
            if (res !== undefined) { setDisputeOpen(false); detail.reload(); }
          }}>ثبت اختلاف</Button>
        </>
      }>
        <Field label="شرح موضوع" htmlFor="dispute-note" required hint="حداقل ۱۰ کاراکتر">
          <Textarea id="dispute-note" value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

function PriceBreakdownView({ order }: { order: { estimatedPrice: number; urgentFee: number; serviceFee: number; discount: number; total: number; couponCode: string | null } }) {
  const rows: [string, number, boolean?][] = [
    ["مبلغ خدمت (پیشنهاد متخصص)", order.estimatedPrice],
    ["هزینه فوری", order.urgentFee],
    ["کارمزد خدمات", order.serviceFee],
    ["تخفیف" + (order.couponCode ? ` (${order.couponCode})` : ""), -order.discount, true],
  ];
  return (
    <div className="space-y-3 text-sm">
      {rows.map(([label, value, isDiscount]) => (
        <div key={label} className="flex justify-between gap-4">
          <span className="text-muted">{label}</span>
          <span className={isDiscount && value !== 0 ? "font-medium text-success" : "font-medium"}>{value === 0 ? "—" : `${value < 0 ? "−" : ""}${formatPrice(Math.abs(value))}`}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
        <span>جمع کل</span>
        <span>{formatPrice(order.total)}</span>
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const days = useMemo(() => {
    const list: { iso: string; label: string; weekday: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() + i * 86_400_000);
      const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      list.push({
        iso,
        label: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short", timeZone: "Asia/Tehran" }).format(d),
        weekday: new Intl.DateTimeFormat("fa-IR", { weekday: "short", timeZone: "Asia/Tehran" }).format(d),
      });
    }
    return list;
  }, []);
  return (
    <div role="radiogroup" aria-label="تاریخ قرار" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {days.map((d) => (
        <button key={d.iso} type="button" role="radio" aria-checked={value === d.iso} onClick={() => onChange(d.iso)} className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border p-3 transition ${value === d.iso ? "border-brand bg-brand text-white shadow-lift" : "border-line bg-surface hover:border-brand/40"}`}>
          <span className="text-xs opacity-80">{d.weekday}</span>
          <span className="text-base font-bold">{d.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Time-slot picker. Slots listed in `disabledIds` are shown but cannot be chosen. */
export function TimeSlotPicker({ value, onChange, disabledIds = [] }: { value: string; onChange: (v: string) => void; disabledIds?: string[] }) {
  return (
    <div role="radiogroup" aria-label="بازه زمانی" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {TIME_SLOTS.map((slot) => {
        const disabled = disabledIds.includes(slot.id);
        return (
          <button
            key={slot.id}
            type="button"
            role="radio"
            aria-checked={value === slot.id}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => onChange(slot.id)}
            className={`rounded-xl border px-3 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${value === slot.id ? "border-brand bg-mint/40 font-semibold text-brand-strong" : "border-line bg-surface hover:border-brand/40"}`}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Customer: overview and sections ----------

function OverviewCustomer({ user }: { user: ViewUser }) {
  const orders = useApi<OrderListItem[]>("/orders");
  const notes = useApi<{ items: { id: number; type: NotificationType; title: string; body: string; createdAt: string; isRead: boolean; link: string }[]; unread: number }>("/notifications");
  const favs = useApi<{ id: number; type: string; title: string; href: string; subtitle: string }[]>("/favorites");
  const active = (orders.data ?? []).filter((o) => !["completed", "cancelled"].includes(o.status));
  const spent = (orders.data ?? []).filter((o) => o.status === "completed").reduce((s, o) => s + o.total, 0);
  return (
    <DashShell user={user} title={`خوش آمدید، ${user.fullName.split(" ")[0]}`} subtitle="وضعیت سفارش‌ها، پیشنهادها و اعلان‌های خود را اینجا ببینید." actions={<Button href="/categories" icon={<CategoryIcon name="sparkles" className="size-4" />}>ثبت سفارش جدید</Button>}>
      {!user.phoneVerified && (
        <Card className="flex flex-col gap-3 border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">شماره موبایل شما تأیید نشده است. برای ثبت سفارش، ابتدا آن را تأیید کنید.</p>
          <Button href="/account/profile" variant="secondary" size="sm">تأیید شماره</Button>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="سفارش‌های فعال" value={faNum(active.length)} icon="package" />
        <StatCard label="سفارش‌های انجام‌شده" value={faNum((orders.data ?? []).filter((o) => o.status === "completed").length)} icon="check" tone="sky" />
        <StatCard label="مجموع پرداختی" value={formatPrice(spent)} icon="receipt" tone="amber" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">سفارش‌های فعال</h2><Link href="/account/orders" className="text-sm text-brand">همه</Link></div>
          {active.length === 0 ? (
            <EmptyState icon="package" title="سفارش فعالی ندارید" description="یک خدمت را انتخاب کنید و در چند دقیقه پیشنهاد دریافت کنید." action={<Button href="/categories" size="sm">مشاهده خدمات</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {active.slice(0, 4).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-4">
                  <Link href={`/account/orders/${o.id}`} className="min-w-0 hover:text-brand">
                    <p className="truncate font-semibold">{o.serviceTitle}</p>
                    <p className="text-xs text-muted" dir="ltr">{o.code} · {formatDate(o.scheduledAt)}</p>
                  </Link>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">اعلان‌های اخیر</h2><Link href="/account/notifications" className="text-sm text-brand">همه</Link></div>
          <ApiBlock state={notes} empty={(d) => d.items.length === 0} emptyTitle="اعلانی ندارید">
            {(d) => (
              <ul className="space-y-3">
                {d.items.slice(0, 4).map((n) => (
                  <li key={n.id} className="rounded-xl bg-canvas p-3">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-1 text-xs text-muted">{formatRelative(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </ApiBlock>
        </Card>
      </div>
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">خدمات و متخصصان ذخیره‌شده</h2><Link href="/account/favorites" className="text-sm text-brand">مدیریت</Link></div>
        <ApiBlock state={favs} empty={(d) => d.length === 0} emptyTitle="هنوز موردی را ذخیره نکرده‌اید">
          {(d) => <div className="flex flex-wrap gap-2">{d.slice(0, 6).map((f) => <Link key={f.id} href={f.href} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand/40 hover:text-brand">{f.title}</Link>)}</div>}
        </ApiBlock>
      </Card>
    </DashShell>
  );
}

function CustomerOrdersSection({ user, id }: { user: ViewUser; id?: number }) {
  return (
    <DashShell user={user} title={id ? "جزئیات سفارش" : "سفارش‌های من"} subtitle={id ? undefined : "همه سفارش‌ها، پیشنهادها و وضعیت پرداخت را در یک جا ببینید."}>
      {id ? <OrderDetailView id={id} user={user} /> : <OrdersList />}
    </DashShell>
  );
}

function CustomerMessagesSection({ user, orderId }: { user: ViewUser; orderId?: number }) {
  return (
    <DashShell user={user} title="پیام‌ها" subtitle="گفتگو با متخصص مربوط به هر سفارش.">
      <Chat orderId={orderId ?? null} ownRole="customer" />
    </DashShell>
  );
}

function AddressesSection({ user }: { user: ViewUser }) {
  const list = useApi<{ id: number; title: string; city: string; region: string; addressLine: string; details: string; isDefault: boolean }[]>("/addresses");
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<null | { id?: number; title: string; city: string; region: string; addressLine: string; details: string; isDefault: boolean }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const regions: readonly string[] = CITIES.find((c) => c.name === editing?.city)?.regions ?? [];

  async function save() {
    if (!editing) return;
    setErrors({});
    const payload = { title: editing.title, city: editing.city, region: editing.region, addressLine: editing.addressLine, details: editing.details, isDefault: editing.isDefault };
    try {
      await run("addr", () => apiRequest(editing.id ? "PUT" : "POST", editing.id ? `/addresses/${editing.id}` : "/addresses", payload), "نشانی ذخیره شد");
      setEditing(null);
      list.reload();
    } catch (e) {
      const err = e as { fieldErrors?: Record<string, string>; message: string };
      setErrors(err.fieldErrors ?? { form: err.message });
    }
  }

  return (
    <DashShell user={user} title="نشانی‌های من" subtitle="نشانی‌های پرکاربرد را ذخیره کنید تا در ثبت سفارش سریع‌تر انتخاب کنید." actions={<Button onClick={() => setEditing({ title: "", city: "تهران", region: CITIES[0]!.regions[0]!, addressLine: "", details: "", isDefault: false })}>افزودن نشانی</Button>}>
      {dialog}
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="هنوز نشانی ذخیره نکرده‌اید">
        {(items) => (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((a) => (
              <Card key={a.id} className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{a.title}</p>
                  {a.isDefault && <Badge tone="brand">پیش‌فرض</Badge>}
                </div>
                <p className="text-sm leading-7 text-muted">{a.city}، {a.region}، {a.addressLine}{a.details ? ` - ${a.details}` : ""}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...a })}>ویرایش</Button>
                  {!a.isDefault && <Button size="sm" variant="ghost" loading={busy} onClick={async () => { const r = await run("def", () => apiRequest("POST", `/addresses/${a.id}/default`)); if (r !== undefined) list.reload(); }}>انتخاب به‌عنوان پیش‌فرض</Button>}
                  <Button size="sm" variant="ghost" className="text-danger" onClick={async () => { if (!(await confirm("این نشانی حذف شود؟"))) return; const r = await run("del", () => apiRequest("DELETE", `/addresses/${a.id}`), "نشانی حذف شد"); if (r !== undefined) list.reload(); }}>حذف</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "ویرایش نشانی" : "نشانی جدید"} footer={<><Button variant="outline" onClick={() => setEditing(null)}>انصراف</Button><Button loading={busy} onClick={save}>ذخیره</Button></>}>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="عنوان" htmlFor="addr-title" required error={errors.title}><Input id="addr-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} error={errors.title} placeholder="منزل، دفتر" /></Field>
            <Field label="شهر" htmlFor="addr-city" required><Select id="addr-city" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value, region: CITIES.find((c) => c.name === e.target.value)!.regions[0]! })}>{CITIES.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}</Select></Field>
            <Field label="منطقه" htmlFor="addr-region" required><Select id="addr-region" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })}>{regions.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
            <Field label="جزئیات تکمیلی" htmlFor="addr-details" hint="واحد، طبقه، پلاک"><Input id="addr-details" value={editing.details} onChange={(e) => setEditing({ ...editing, details: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="نشانی کامل" htmlFor="addr-line" required error={errors.addressLine}><Textarea id="addr-line" value={editing.addressLine} onChange={(e) => setEditing({ ...editing, addressLine: e.target.value })} error={errors.addressLine} /></Field></div>
            <label className="flex items-center gap-3 text-sm sm:col-span-2"><Toggle checked={editing.isDefault} onChange={(v) => setEditing({ ...editing, isDefault: v })} label="نشانی پیش‌فرض" />نشانی پیش‌فرض باشد</label>
            {errors.form && <p className="text-sm text-danger sm:col-span-2">{errors.form}</p>}
          </div>
        )}
      </Modal>
    </DashShell>
  );
}

function ProfileSection({ user }: { user: ViewUser }) {
  const [form, setForm] = useState({ fullName: user.fullName, email: "", avatarUrl: user.avatarUrl ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const { run, runStrict, busy } = useAction();
  const toast = useToast();

  useEffect(() => {
    apiRequest<{ user: { email: string | null } | null }>("GET", "/auth/me")
      .then((r) => setForm((f) => ({ ...f, email: r.user?.email ?? "" })))
      .catch(() => undefined);
  }, []);

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 300_000) return toast.error("تصویر JPG/PNG/WebP تا ۳۰۰ کیلوبایت");
    const url = await readAsDataUrl(file);
    setForm((f) => ({ ...f, avatarUrl: url }));
  }

  async function save() {
    setErrors({});
    try {
      await runStrict("save", () => apiRequest("PATCH", "/me", { fullName: form.fullName, email: form.email || null, avatarUrl: form.avatarUrl || null }), "پروفایل ذخیره شد");
    } catch (e) {
      setErrors((e as { fieldErrors?: Record<string, string> }).fieldErrors ?? { form: (e as Error).message });
    }
  }

  return (
    <DashShell user={user} title="پروفایل" subtitle="اطلاعات شخصی و تصویر پروفایل خود را ویرایش کنید.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          <div className="flex items-center gap-4">
            <Avatar name={form.fullName} src={form.avatarUrl || null} size="xl" />
            <label className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-medium transition hover:border-brand/40 hover:text-brand">
              تغییر تصویر
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void onAvatar(e.target.files?.[0])} />
            </label>
          </div>
          <Field label="نام و نام خانوادگی" htmlFor="p-name" required error={errors.fullName}><Input id="p-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={errors.fullName} /></Field>
          <Field label="ایمیل" htmlFor="p-email" hint="اختیاری" error={errors.email}><Input id="p-email" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} /></Field>
          <Field label="شماره موبایل" htmlFor="p-phone" hint="شماره موبایل برای ورود استفاده می‌شود. تغییر شماره در نسخه فعلی پشتیبانی نمی‌شود."><Input id="p-phone" dir="ltr" value={user.phone} disabled readOnly /></Field>
          <Button loading={busy} onClick={save}>ذخیره تغییرات</Button>
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="font-bold">تأیید شماره موبایل</h2>
          {user.phoneVerified ? <Badge tone="success">شماره تأیید شده است</Badge> : (
            <>
              <p className="text-sm leading-7 text-muted">برای ثبت سفارش باید شماره موبایل خود را تأیید کنید. در حالت توسعه، کد در همین صفحه نمایش داده می‌شود.</p>
              <Button variant="soft" loading={busy} onClick={async () => { const r = await run("otp", () => apiRequest<{ devCode: string }>("POST", "/auth/verify-phone/send")); if (r) setDevCode(r.devCode); }}>ارسال کد تأیید</Button>
              {devCode && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">حالت توسعه (کد آزمایشی): <span dir="ltr" className="font-mono font-bold">{devCode}</span></p>}
              <Input inputMode="numeric" maxLength={6} dir="ltr" placeholder="۶ رقم" value={code} onChange={(e) => setCode(e.target.value)} aria-label="کد تأیید" />
              <Button loading={busy} disabled={code.length !== 6} onClick={async () => { const r = await run("verify", () => apiRequest("POST", "/auth/verify-phone", { code }), "شماره تأیید شد"); if (r !== undefined) window.location.reload(); }}>تأیید</Button>
            </>
          )}
        </Card>
      </div>
    </DashShell>
  );
}

function FavoritesSection({ user }: { user: ViewUser }) {
  const list = useApi<{ id: number; type: "service" | "professional"; targetId: string; title: string; subtitle: string; href: string; rating: number; basePrice: number }[]>("/favorites");
  const { run } = useAction();
  return (
    <DashShell user={user} title="علاقه‌مندی‌ها" subtitle="خدمات و متخصصانی که ذخیره کرده‌اید.">
      <ApiBlock state={list} empty={(d) => d.length === 0} emptyTitle="موردی ذخیره نشده است">
        {(items) => (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((f) => (
              <Card key={f.id} className="flex items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <Link href={f.href} className="font-bold hover:text-brand">{f.title}</Link>
                  <p className="truncate text-sm text-muted">{f.subtitle}</p>
                  <p className="mt-1 text-xs text-muted">{f.type === "service" ? `از ${formatPrice(f.basePrice)}` : "متخصص"} · امتیاز {faNum(f.rating.toFixed(1))}</p>
                </div>
                <button type="button" aria-label={`حذف ${f.title} از علاقه‌مندی‌ها`} onClick={async () => { const r = await run("fav", () => apiRequest("POST", "/favorites/toggle", { targetType: f.type, targetId: f.targetId }), "حذف شد"); if (r !== undefined) list.reload(); }} className="grid size-10 place-items-center rounded-xl text-danger hover:bg-red-50">
                  <Heart className="size-5 fill-current" aria-hidden="true" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>
    </DashShell>
  );
}

function ReviewsSection({ user }: { user: ViewUser }) {
  const orders = useApi<OrderListItem[]>("/orders?status=completed");
  return (
    <DashShell user={user} title="نظرات من" subtitle="برای سفارش‌های انجام‌شده می‌توانید امتیاز و نظر ثبت کنید. ویرایش نظر تا ۷ روز امکان‌پذیر است.">
      <ApiBlock state={orders} empty={(d) => d.length === 0} emptyTitle="هنوز سفارش انجام‌شده‌ای ندارید">
        {(list) => (
          <div className="grid gap-4">
            {list.map((o) => (
              <Card key={o.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{o.serviceTitle}</p>
                  <p className="text-sm text-muted">{o.code} · {formatDate(o.scheduledAt)} · {o.professionalName ?? "—"}</p>
                </div>
                <Button href={`/account/orders/${o.id}`} size="sm" variant="outline">ثبت یا مشاهده نظر</Button>
              </Card>
            ))}
          </div>
        )}
      </ApiBlock>
    </DashShell>
  );
}

/** Notifications centre. Used by customers and professionals (same API). */
export function NotificationsSection({ user }: { user: ViewUser }) {
  const list = useApi<{ items: { id: number; type: NotificationType; title: string; body: string; isRead: boolean; link: string; createdAt: string }[]; unread: number }>("/notifications");
  const { run } = useAction();
  return (
    <DashShell user={user} title="اعلان‌ها" subtitle={list.data ? `${faNum(list.data.unread)} اعلان خوانده‌نشده` : undefined} actions={<Button variant="outline" size="sm" onClick={async () => { const r = await run("readall", () => apiRequest("POST", "/notifications/read", {})); if (r !== undefined) list.reload(); }}>علامت‌گذاری همه به‌عنوان خوانده‌شده</Button>}>
      <ApiBlock state={list} empty={(d) => d.items.length === 0} emptyTitle="اعلانی وجود ندارد">
        {(d) => (
          <Card className="divide-y divide-line">
            {d.items.map((n) => (
              <div key={n.id} className={`flex gap-4 p-5 ${n.isRead ? "" : "bg-mint/10"}`}>
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.isRead ? "bg-slate-300" : "bg-brand"}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{n.title}</p>
                    <Badge>{NOTIFICATION_LABELS[n.type]}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted">{n.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span>{formatRelative(n.createdAt)}</span>
                    {n.link && <Link href={n.link} className="font-semibold text-brand hover:underline" onClick={() => void apiRequest("POST", "/notifications/read", { id: n.id })}>مشاهده</Link>}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </ApiBlock>
    </DashShell>
  );
}

function WalletSection({ user }: { user: ViewUser }) {
  const wallet = useApi<{ balance: number; transactions: { id: number; type: TransactionType; amount: number; status: string; description: string; createdAt: string; direction: "credit" | "debit" }[] }>("/wallet");
  const [amount, setAmount] = useState("200000");
  const { run, busy } = useAction();
  return (
    <DashShell user={user} title="کیف پول" subtitle="موجودی، بازپرداخت‌ها و تراکنش‌های شما.">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="موجودی کیف پول" value={formatPrice(wallet.data?.balance ?? 0)} icon="wallet" hint="بازپرداخت لغو سفارش‌ها به این بخش اضافه می‌شود." />
        <Card className="space-y-3 p-5">
          <p className="font-bold">شارژ آزمایشی کیف پول</p>
          <p className="text-xs leading-6 text-muted">این شارژ در محیط آزمایشی انجام می‌شود و هیچ پرداخت واقعی صورت نمی‌گیرد.</p>
          <div className="flex gap-2">
            <Input inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} aria-label="مبلغ شارژ به تومان" />
            <Button loading={busy} onClick={async () => { const r = await run("dep", () => apiRequest("POST", "/wallet/deposit", { amount: Number(amount) }), "کیف پول شارژ شد"); if (r !== undefined) wallet.reload(); }}>شارژ</Button>
          </div>
        </Card>
      </div>
      <ApiBlock state={wallet} empty={(d) => d.transactions.length === 0} emptyTitle="تراکنشی ثبت نشده است">
        {(d) => <TransactionTable rows={d.transactions} />}
      </ApiBlock>
    </DashShell>
  );
}

export function TransactionTable({ rows }: { rows: { id: number; type: TransactionType | string; amount: number; status: string; description: string; createdAt: string; direction?: "credit" | "debit" }[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">تراکنش‌ها</caption>
        <thead className="bg-canvas text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">تاریخ</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">نوع</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">شرح</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">مبلغ</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">وضعیت</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((t) => (
            <tr key={t.id} className="transition hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(t.createdAt)}</td>
              <td className="px-4 py-3">{TRANSACTION_LABELS[t.type as TransactionType] ?? t.type}</td>
              <td className="max-w-xs truncate px-4 py-3 text-muted">{t.description}</td>
              <td className={`whitespace-nowrap px-4 py-3 font-semibold ${t.direction === "credit" ? "text-success" : t.direction === "debit" ? "text-danger" : ""}`}>{t.direction === "debit" ? "−" : t.direction === "credit" ? "+" : ""}{formatPrice(t.amount)}</td>
              <td className="px-4 py-3"><Badge tone={t.status === "completed" ? "success" : t.status === "pending" ? "warning" : t.status === "rejected" ? "danger" : "neutral"}>{t.status === "completed" ? "انجام شده" : t.status === "pending" ? "در انتظار" : t.status === "rejected" ? "رد شده" : t.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Password change for the signed-in customer. Other sessions are revoked on success. */
function SecuritySection({ user }: { user: ViewUser }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { runStrict, busy } = useAction();

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setErrors({});
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: "تکرار رمز عبور با رمز جدید یکسان نیست" });
      return;
    }
    try {
      await runStrict("password", () => apiRequest("POST", "/me/password", { currentPassword: form.currentPassword, newPassword: form.newPassword }), "رمز عبور تغییر کرد. سایر نشست‌های شما خارج شدند.");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      const fieldErrors = (err as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
      setErrors({ ...fieldErrors, form: fieldErrors.currentPassword ? "" : (err as Error).message });
    }
  }

  return (
    <DashShell user={user} title="امنیت و رمز عبور" subtitle="رمز عبور خود را تغییر دهید. پس از تغییر، نشست‌های دیگر شما در دستگاه‌های دیگر خارج می‌شوند.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          <h2 className="font-bold">تغییر رمز عبور</h2>
          <form onSubmit={submit} noValidate className="space-y-5">
            <Field label="رمز عبور فعلی" htmlFor="sec-cur" required error={errors.currentPassword}>
              <Input id="sec-cur" type="password" dir="ltr" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} error={errors.currentPassword} />
            </Field>
            <Field label="رمز عبور جدید" htmlFor="sec-new" required error={errors.newPassword} hint="حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد">
              <Input id="sec-new" type="password" dir="ltr" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} error={errors.newPassword} />
            </Field>
            <Field label="تکرار رمز عبور جدید" htmlFor="sec-conf" required error={errors.confirm}>
              <Input id="sec-conf" type="password" dir="ltr" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={errors.confirm} />
            </Field>
            {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
            <Button type="submit" loading={busy} disabled={!form.currentPassword || form.newPassword.length < 8 || !form.confirm}>
              ذخیره رمز عبور جدید
            </Button>
          </form>
        </Card>
        <Card className="space-y-3 p-6">
          <h2 className="font-bold">وضعیت حساب</h2>
          <p className="text-sm leading-7 text-muted">شماره موبایل: <span dir="ltr" className="font-semibold text-ink">{user.phone}</span></p>
          {user.phoneVerified ? <Badge tone="success">شماره تأیید شده است</Badge> : <Badge tone="warning">شماره تأیید نشده است</Badge>}
          <p className="text-xs leading-6 text-muted">تغییر شماره موبایل در نسخه فعلی پشتیبانی نمی‌شود.</p>
        </Card>
      </div>
    </DashShell>
  );
}

export function CustomerDashboard({ user, section }: { user: ViewUser; section: string[] }) {
  const [head, arg] = section;
  switch (head) {
    case undefined:
      return <OverviewCustomer user={user} />;
    case "orders":
      return <CustomerOrdersSection user={user} id={arg ? Number(arg) : undefined} />;
    case "messages":
      return <CustomerMessagesSection user={user} orderId={arg ? Number(arg) : undefined} />;
    case "addresses":
      return <AddressesSection user={user} />;
    case "profile":
      return <ProfileSection user={user} />;
    case "favorites":
      return <FavoritesSection user={user} />;
    case "reviews":
      return <ReviewsSection user={user} />;
    case "notifications":
      return <NotificationsSection user={user} />;
    case "wallet":
      return <WalletSection user={user} />;
    case "security":
      return <SecuritySection user={user} />;
    default:
      return <EmptyState title="صفحه یافت نشد" />;
  }
}


