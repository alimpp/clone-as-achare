"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, MapPin, Search, TrendingUp, X } from "lucide-react";
import { apiRequest, CategoryIcon, Skeleton } from "@/components/ui";
import { CITIES, formatPrice, POPULAR_SEARCHES } from "@/lib/domain";

const RECENT_KEY = "arena-recent-searches";
const CITY_KEY = "arena-city";
const DEFAULT_CITY = "تهران";

interface Suggestion {
  services: { title: string; slug: string; categoryName: string; basePrice: number }[];
  categories: { name: string; slug: string }[];
}

type Option = { key: string; label: string; href: string; meta?: string };

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const next = [term, ...readRecent().filter((t) => t !== term)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/** Selected city, persisted in localStorage. Used by hero search and booking defaults. */
export function useSelectedCity(): [string, (city: string) => void] {
  const [city, setCity] = useState(DEFAULT_CITY);
  useEffect(() => {
    const stored = localStorage.getItem(CITY_KEY);
    if (stored && CITIES.some((c) => c.name === stored)) setCity(stored);
  }, []);
  return [
    city,
    (next: string) => {
      setCity(next);
      localStorage.setItem(CITY_KEY, next);
    },
  ];
}

export function LocationSelect({ compact = false }: { compact?: boolean }) {
  const [city, setCity] = useSelectedCity();
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        انتخاب شهر
      </label>
      <MapPin className={`pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-brand ${compact ? "" : "start-3.5"}`} aria-hidden="true" />
      <select
        id={id}
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className={`h-11 cursor-pointer appearance-none rounded-xl border border-line bg-surface ps-9 pe-8 text-sm font-medium text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 ${compact ? "w-32" : "w-full"}`}
      >
        {CITIES.map((c) => (
          <option key={c.slug} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SearchBox({
  autoFocus = false,
  defaultValue = "",
  onNavigate,
  variant = "default",
}: {
  autoFocus?: boolean;
  defaultValue?: string;
  onNavigate?: () => void;
  variant?: "default" | "hero";
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Suggestion | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Debounced suggestions (250 ms) with stale-request protection.
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      apiRequest<Suggestion>("GET", `/search/suggest?q=${encodeURIComponent(term)}`)
        .then((res) => {
          if (!alive) return;
          setData(res);
          setError(null);
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : "خطا");
        })
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [value]);

  const options: Option[] = useMemo(() => {
    const term = value.trim();
    if (term.length < 2) {
      return [
        ...recent.map((r) => ({ key: `r-${r}`, label: r, href: `/search?q=${encodeURIComponent(r)}`, meta: "جستجوی اخیر" })),
      ];
    }
    if (!data) return [];
    return [
      ...data.services.map((s) => ({ key: `s-${s.slug}`, label: s.title, href: `/services/${s.slug}`, meta: `${s.categoryName} · از ${formatPrice(s.basePrice)}` })),
      ...data.categories.map((c) => ({ key: `c-${c.slug}`, label: c.name, href: `/categories/${c.slug}`, meta: "دسته‌بندی" })),
    ];
  }, [value, data, recent]);

  function submit(term?: string) {
    const q = (term ?? value).trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    saveRecent(q);
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function choose(option: Option) {
    if (option.meta !== "جستجوی اخیر") saveRecent(option.label);
    setOpen(false);
    onNavigate?.();
    router.push(option.href);
  }

  function onKeyDown(e: import("react").KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[active];
      if (opt) choose(opt);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && (value.trim().length >= 2 || (value.trim().length === 0));
  const noResults = value.trim().length >= 2 && !loading && data && data.services.length === 0 && data.categories.length === 0;
  const isHero = variant === "hero";

  return (
    <div className="relative w-full" role="search">
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-surface transition duration-200 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 ${
          isHero ? "border-brand/20 p-2 shadow-lift" : "border-line p-1.5 shadow-sm"
        }`}
      >
        <Search className="ms-3 size-5 shrink-0 text-brand" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={value}
          placeholder="مثلاً نشتی لوله، تعمیر کولر، نظافت منزل"
          onChange={(e) => {
            setValue(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted/80 focus:outline-none md:text-sm"
          aria-label="جستجوی خدمات"
        />
        {value && (
          <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setValue(""); inputRef.current?.focus(); }} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-slate-100">
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => submit()}
          className={`${isHero ? "h-11 px-6" : "h-10 px-4"} shrink-0 rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-strong active:scale-[0.98]`}
        >
          جستجو
        </button>
      </div>

      {showPanel && (
        <div className="animate-fade-up absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          {value.trim().length === 0 ? (
            <div className="p-4">
              {recent.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <Clock className="size-3.5" aria-hidden="true" /> جستجوهای اخیر
                  </p>
                  <ul id={listId} role="listbox" className="space-y-1">
                    {recent.map((r, i) => (
                      <li key={r} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(r)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm transition ${active === i ? "bg-brand/5 text-brand" : "hover:bg-slate-50"}`}>
                          {r}
                          <ArrowLeft className="size-4 text-muted" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <TrendingUp className="size-3.5" aria-hidden="true" /> پرتکرارترین جستجوها
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((p) => (
                  <button key={p} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(p)} className="rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:border-brand/40 hover:text-brand">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : loading && !data ? (
            <div className="space-y-2 p-4" role="status" aria-label="در حال جستجو">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-danger">{error}</p>
          ) : noResults ? (
            <div className="p-5 text-center">
              <p className="font-semibold text-ink">نتیجه‌ای برای «{value.trim()}» پیدا نشد</p>
              <p className="mt-1 text-sm text-muted">عبارت دیگری را امتحان کنید یا از دسته‌بندی‌ها استفاده کنید.</p>
              <Link href="/categories" onClick={() => setOpen(false)} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
                مشاهده همه دسته‌بندی‌ها
              </Link>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label="پیشنهادها" className="max-h-96 overflow-y-auto p-2">
              {options.map((opt, i) => (
                <li key={opt.key} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(opt)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition ${active === i ? "bg-brand/5" : "hover:bg-slate-50"}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint/40 text-brand">
                      <CategoryIcon name={opt.meta === "دسته‌بندی" ? "wrench" : "sparkles"} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{opt.label}</span>
                      {opt.meta && <span className="block truncate text-xs text-muted">{opt.meta}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
