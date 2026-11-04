"use client";

import Link from "next/link";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Car,
  CircleCheck,
  CircleX,
  Droplets,
  FileText,
  Hammer,
  Info,
  Laptop,
  Leaf,
  LoaderCircle,
  Paintbrush,
  Plug,
  Scissors,
  ShieldCheck,
  Snowflake,
  Sofa,
  Sparkles,
  Star,
  Tag,
  Truck,
  TriangleAlert,
  Users,
  Wallet,
  Wrench,
  Zap,
  X,
  Clock,
  Package,
  Receipt,
  Banknote,
  LayoutDashboard,
  MessageCircle,
  Bell,
  Heart,
  Settings,
  type LucideIcon,
  Camera,
  KeyRound,
  GraduationCap,
  PartyPopper,
  Ruler,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { TONE_CLASSES, faNum, type Tone } from "@/lib/domain";
import { ServiceIllustration, illustrationKind } from "@/components/illustrations/ServiceIllustration";

// ---------- Icons ----------

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  droplets: Droplets,
  zap: Zap,
  plug: Plug,
  paintbrush: Paintbrush,
  truck: Truck,
  snowflake: Snowflake,
  leaf: Leaf,
  sofa: Sofa,
  laptop: Laptop,
  car: Car,
  scissors: Scissors,
  hammer: Hammer,
  wrench: Wrench,
  shield: ShieldCheck,
  users: Users,
  briefcase: Briefcase,
  wallet: Wallet,
  receipt: Receipt,
  banknote: Banknote,
  dashboard: LayoutDashboard,
  message: MessageCircle,
  bell: Bell,
  heart: Heart,
  settings: Settings,
  tag: Tag,
  file: FileText,
  package: Package,
  clock: Clock,
  award: Award,
  star: Star,
  check: CircleCheck,
  x: CircleX,
  info: Info,
  warning: TriangleAlert,
  badge: BadgeCheck,
  camera: Camera,
  key: KeyRound,
  graduation: GraduationCap,
  party: PartyPopper,
  ruler: Ruler,
};

export function CategoryIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Wrench;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8} />;
}

// ---------- Toasts ----------

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const api = useMemo(
    () => ({
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      info: (m: string) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-[100] flex flex-col items-end gap-2 md:bottom-6 md:start-6 md:inset-x-auto md:items-start">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-4 text-sm shadow-lg md:w-auto ${
              t.kind === "error" ? "border-danger/30" : t.kind === "success" ? "border-success/30" : "border-line"
            }`}
          >
            {t.kind === "error" ? (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            ) : t.kind === "success" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            )}
            <p className="leading-6 text-ink">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ---------- API client ----------

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  constructor(message: string, status: number, code = "error", fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Calls the REST API. `path` is relative to /api, e.g. "/orders/12". */
export async function apiRequest<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError("اتصال به سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.", 0, "network");
  }
  type Envelope = { data?: T; error?: { message: string; code: string; fieldErrors?: Record<string, string> } };
  let json: Envelope | null = null;
  try {
    json = (await res.json()) as Envelope;
  } catch {
    json = null;
  }
  if (!res.ok) {
    // An expired session inside a dashboard sends the user to the dedicated explanation page.
    if (res.status === 401 && typeof window !== "undefined" && /^\/(account|pro|admin)(\/|$)/.test(window.location.pathname)) {
      window.location.assign("/session-expired");
    }
    const message = res.status === 401 ? "نشست شما منقضی شده است. دوباره وارد شوید." : json?.error?.message ?? "خطای ناشناخته‌ای رخ داد";
    throw new ApiClientError(message, res.status, json?.error?.code ?? "error", json?.error?.fieldErrors);
  }
  return (json?.data ?? null) as T;
}

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: path !== null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    apiRequest<T>("GET", path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ data: null, error: e instanceof Error ? e.message : "خطا", loading: false }));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload, setData: (data: T) => setState((s) => ({ ...s, data })) };
}

/** Runs an async mutation with loading flag and toast feedback. */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> => {
      if (pending) return undefined;
      setPending(key);
      try {
        const result = await fn();
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "خطای ناشناخته");
        return undefined;
      } finally {
        setPending(null);
      }
    },
    [pending, toast],
  );
  /** Like run(), but errors propagate to the caller so forms can show field-level messages. */
  const runStrict = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, successMessage?: string): Promise<T> => {
      setPending(key);
      try {
        const result = await fn();
        if (successMessage) toast.success(successMessage);
        return result;
      } finally {
        setPending(null);
      }
    },
    [toast],
  );

  return { run, runStrict, pending, busy: pending !== null };
}

// ---------- Buttons ----------

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";

const BUTTON_BASE =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 ease-premium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 select-none";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-sm hover:-translate-y-px hover:bg-brand-strong hover:shadow-lift",
  secondary: "bg-ink text-white hover:bg-night",
  outline: "border border-line bg-surface text-ink hover:border-brand/40 hover:text-brand",
  ghost: "text-ink hover:bg-brand/5 hover:text-brand",
  danger: "bg-danger text-white hover:bg-red-700",
  soft: "bg-mint/50 text-brand-strong hover:bg-mint",
};
const BUTTON_SIZES = {
  sm: "h-9 rounded-lg px-3 text-sm",
  md: "h-11 rounded-xl px-5 text-sm",
  lg: "h-13 rounded-xl px-6 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: keyof typeof BUTTON_SIZES = "md", fullWidth = false) {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${fullWidth ? "w-full" : ""}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  href,
  icon,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
  icon?: ReactNode;
}) {
  const classes = `${buttonClasses(variant, size, fullWidth)} ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

// ---------- Layout primitives ----------

export function Card({ className = "", children, interactive = false }: { className?: string; children: ReactNode; interactive?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-card ${
        interactive ? "transition duration-300 ease-premium hover:-translate-y-1 hover:shadow-lift hover:border-brand/25" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone | "brand"; children: ReactNode; className?: string }) {
  const map: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700",
    info: "bg-sky-50 text-sky-700",
    success: "bg-green-50 text-success",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-danger",
    brand: "bg-mint/60 text-brand-strong",
  };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${map[tone] ?? map.neutral} ${className}`}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 className="text-balance text-2xl font-extrabold leading-[1.45] tracking-tight text-ink md:text-[2.25rem]">{title}</h2>
        {description && <p className="mt-3 max-w-xl text-[15px] leading-8 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  return (
    <nav aria-label="مسیر صفحه" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="font-medium text-ink">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="transition hover:text-brand">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition duration-700 ease-premium motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ---------- Forms ----------

export function Field({ label, error, hint, htmlFor, children, required }: { label: string; error?: string; hint?: string; htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ms-1 text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1 text-xs text-danger">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-xl border bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70 transition duration-200 focus:outline-none focus:ring-4 disabled:bg-slate-50 disabled:text-muted";

export function Input({ error, className = "", id, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${inputId}-error` : undefined}
      className={`${INPUT_BASE} h-11 ${error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-line focus:border-brand focus:ring-brand/15"} ${className}`}
      {...props}
    />
  );
}

export function Textarea({ error, className = "", id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <textarea
      id={inputId}
      aria-invalid={error ? true : undefined}
      className={`${INPUT_BASE} min-h-24 py-3 leading-7 ${error ? "border-danger focus:ring-danger/15" : "border-line focus:border-brand focus:ring-brand/15"} ${className}`}
      {...props}
    />
  );
}

export function Select({ error, className = "", id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <select
      id={inputId}
      aria-invalid={error ? true : undefined}
      className={`${INPUT_BASE} h-11 cursor-pointer ${error ? "border-danger" : "border-line focus:border-brand focus:ring-brand/15"} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:opacity-50 ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5 rtl:-translate-x-0.5"}`} />
    </button>
  );
}

// ---------- Overlays ----------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 md:items-center md:p-6">
      <button type="button" aria-label="بستن" className="animate-fade-in absolute inset-0 bg-night/50 backdrop-blur-[2px]" onClick={onClose} tabIndex={-1} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`animate-sheet-up relative flex max-h-[92vh] w-full ${width} flex-col rounded-t-2xl bg-surface shadow-2xl md:rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="بستن پنجره" className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <button type="button" aria-label="بستن منو" className="animate-fade-in absolute inset-0 bg-night/50" onClick={onClose} tabIndex={-1} />
      <aside role="dialog" aria-modal="true" aria-labelledby={titleId} className="animate-drawer-in absolute inset-y-0 end-0 flex w-[88%] max-w-sm flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="بستن" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

// ---------- Feedback states ----------

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-shimmer rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] ${className}`} />;
}

export function SkeletonCards({ count = 3, className = "h-56" }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="در حال بارگذاری" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = "package", title, description, action }: { icon?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-mint/50 text-brand">
        <CategoryIcon name={icon} className="size-7" />
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && <p className="max-w-md text-sm leading-7 text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-6 py-10 text-center">
      <TriangleAlert className="size-8 text-danger" aria-hidden="true" />
      <p className="max-w-md text-sm leading-7 text-ink">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          تلاش مجدد
        </Button>
      )}
    </div>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return <LoaderCircle className={`animate-spin text-brand ${className}`} aria-label="در حال بارگذاری" />;
}

// ---------- Ratings & people ----------

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`امتیاز ${faNum(value.toFixed(1))} از ۵`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden="true" className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </span>
  );
}

export function Rating({ value, count, className = "" }: { value: number; count?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-semibold text-ink">{faNum(value.toFixed(1))}</span>
      {count != null && <span className="text-muted">({faNum(count)} نظر)</span>}
    </span>
  );
}

export function Avatar({ name, tone = "emerald", src, size = "md", verified = false }: { name: string; tone?: string; src?: string | null; size?: "sm" | "md" | "lg" | "xl"; verified?: boolean }) {
  const sizes = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-16 text-lg", xl: "size-24 text-2xl" };
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.emerald!;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <span className="relative inline-flex shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`${sizes[size]} rounded-full object-cover ring-2 ring-white`} />
      ) : (
        <span aria-hidden="true" className={`${sizes[size]} ${t.bg} ${t.fg} grid place-items-center rounded-full font-bold ring-2 ring-white`}>
          {initials}
        </span>
      )}
      {verified && (
        <span className="absolute -bottom-0.5 -end-0.5 grid size-4 place-items-center rounded-full bg-white">
          <BadgeCheck className="size-4 text-brand" aria-label="تأیید شده" />
        </span>
      )}
    </span>
  );
}

export function StatCard({ label, value, hint, icon = "receipt", tone = "emerald" }: { label: string; value: string; hint?: string; icon?: string; tone?: string }) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.emerald!;
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${t.bg} ${t.fg}`}>
        <CategoryIcon name={icon} className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

/** Illustrated cover: a bespoke service scene (see illustrations/ServiceIllustration). */
export function CoverArt({ tone = "emerald", icon = "wrench", title, className = "" }: { tone?: string; icon?: string; title: string; className?: string }) {
  return <ServiceIllustration tone={tone} kind={illustrationKind(icon)} title={title} className={className} />;
}

export function Tabs({ items, value, onChange }: { items: { value: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition duration-200 ${
            value === item.value ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {item.label}
          {item.count != null && <span className="rounded-full bg-slate-200/70 px-1.5 text-xs text-ink">{faNum(item.count)}</span>}
        </button>
      ))}
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback((message: string) => new Promise<boolean>((resolve) => setState({ message, resolve })), []);
  const dialog = state ? (
    <Modal
      open
      size="sm"
      title="تأیید عملیات"
      onClose={() => {
        state.resolve(false);
        setState(null);
      }}
      footer={
        <>
          <Button variant="outline" onClick={() => (state.resolve(false), setState(null))}>
            انصراف
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              state.resolve(true);
              setState(null);
            }}
          >
            تأیید
          </Button>
        </>
      }
    >
      <p className="leading-7 text-ink">{state.message}</p>
    </Modal>
  ) : null;
  return { confirm, dialog };
}

export function Pill({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition duration-200 ${
        active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand/40 hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}

export function useIsoDate() {
  return useMemo(() => new Date(), []);
}
