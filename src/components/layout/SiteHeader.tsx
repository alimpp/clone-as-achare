"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, House, LogOut, Menu, Search, User, Wrench } from "lucide-react";
import { apiRequest, Button, CategoryIcon, Drawer, Modal, useToast } from "@/components/ui";
import { LocationSelect, SearchBox } from "@/components/search/SearchBox";
import { ROLE_LABELS, type Role } from "@/lib/domain";

export interface HeaderUser {
  fullName: string;
  role: Role;
  avatarUrl: string | null;
}

export interface HeaderCategory {
  id: number;
  slug: string;
  name: string;
  iconKey: string;
  tone: string;
  children: { slug: string; name: string }[];
}

const DASHBOARD_PREFIXES = ["/account", "/pro", "/admin", "/messages"];

export function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Brand mark and wordmark. `inverse` is for dark surfaces. */
export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="آرنا - صفحه اصلی">
      <span className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-brand shadow-sm transition duration-500 group-hover:-rotate-6 group-hover:shadow-lift">
        <svg viewBox="0 0 40 40" className="size-7" aria-hidden="true">
          <path d="M9 30 L20 9 L31 30" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14.5 22 H25.5" stroke="#C8F169" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={`text-xl font-black tracking-tight ${inverse ? "text-white" : "text-ink"}`}>آرنا</span>
          <span className={`mt-1.5 hidden whitespace-nowrap text-[11px] sm:block ${inverse ? "text-white/55" : "text-muted"}`}>بازار تخصصی خدمات منزل</span>
        </span>
      )}
    </Link>
  );
}

const NAV_LINK = "link-underline whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-ink/80 transition-colors hover:text-brand";

export function SiteHeader({ user, categories }: { user: HeaderUser | null; categories: HeaderCategory[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setMegaOpen(false);
  }, [pathname]);

  if (isDashboardPath(pathname)) return null;

  async function logout() {
    try {
      await apiRequest("POST", "/auth/logout");
      toast.info("با موفقیت خارج شدید");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خروج انجام نشد");
    }
  }

  const dashboardHref = user ? (user.role === "admin" ? "/admin" : user.role === "professional" ? "/pro" : "/account") : "/login";

  return (
    <header className={`sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500 ${scrolled ? "border-line bg-canvas/85 backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        پرش به محتوای اصلی
      </a>
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-3 px-4 md:gap-6 md:px-6">
        <Logo />

        <nav aria-label="منوی اصلی" className="hidden items-center gap-1 lg:flex">
          <div className="relative" onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
            <button
              type="button"
              aria-expanded={megaOpen}
              aria-haspopup="true"
              onClick={() => setMegaOpen((v) => !v)}
              onKeyDown={(e) => e.key === "Escape" && setMegaOpen(false)}
              className={`${NAV_LINK} flex items-center gap-1`}
            >
              دسته‌بندی خدمات
              <ChevronDown className={`size-4 transition-transform duration-300 ${megaOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div className={`absolute start-0 top-full w-[min(48rem,calc(100vw-2rem))] pt-4 transition duration-300 ease-premium ${megaOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
              <div className="rounded-3xl border border-line bg-surface p-7 shadow-lift">
                <div className="grid grid-cols-3 gap-x-8 gap-y-7">
                  {categories.slice(0, 12).map((parent) => (
                    <div key={parent.id}>
                      <Link href={`/categories/${parent.slug}`} className="group mb-3 flex items-center gap-3 text-sm font-bold text-ink hover:text-brand" onClick={() => setMegaOpen(false)}>
                        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand transition duration-300 group-hover:bg-brand group-hover:text-white">
                          <CategoryIcon name={parent.iconKey} className="size-4" />
                        </span>
                        {parent.name}
                      </Link>
                      <ul className="ms-12 space-y-1.5">
                        {parent.children.slice(0, 3).map((c) => (
                          <li key={c.slug}>
                            <Link href={`/categories/${c.slug}`} className="text-sm text-muted transition-colors hover:text-brand" onClick={() => setMegaOpen(false)}>
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex items-center justify-between border-t border-line pt-5 text-sm">
                  <span className="text-muted">همه خدمات به‌صورت دسته‌بندی شده</span>
                  <Link href="/categories" className="font-semibold text-brand hover:underline" onClick={() => setMegaOpen(false)}>
                    مشاهده همه دسته‌بندی‌ها
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <Link href="/categories" className={NAV_LINK} aria-current={pathname === "/categories" ? "page" : undefined}>
            همه خدمات
          </Link>
          <Link href="/#how-it-works" className={NAV_LINK}>
            نحوه کار
          </Link>
          <Link href="/blog" className={NAV_LINK} aria-current={pathname.startsWith("/blog") ? "page" : undefined}>
            وبلاگ
          </Link>
          <Link href="/become-a-pro" className={NAV_LINK} aria-current={pathname === "/become-a-pro" ? "page" : undefined}>
            متخصص شوید
          </Link>
        </nav>

        <div className="ms-auto hidden flex-1 items-center justify-end gap-3 md:flex">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-11 w-64 items-center gap-2.5 rounded-full border border-line bg-surface px-4 text-sm text-muted shadow-sm transition duration-300 hover:border-brand/40 hover:shadow-card 2xl:flex"
          >
            <Search className="size-4 text-brand" aria-hidden="true" />
            جستجوی خدمات…
            <kbd className="ms-auto rounded-md border border-line px-1.5 py-0.5 text-[11px]">⌘K</kbd>
          </button>
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="جستجو" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink transition duration-300 hover:border-brand/40 hover:text-brand 2xl:hidden">
            <Search className="size-5" aria-hidden="true" />
          </button>
          <div className="hidden xl:block">
            <LocationSelect compact />
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <Link href={dashboardHref} className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pe-4 ps-1.5 text-sm shadow-sm transition duration-300 hover:border-brand/40 hover:shadow-card">
                <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">{user.fullName.slice(0, 1)}</span>
                <span className="max-w-[7rem] truncate font-medium">{user.fullName}</span>
                <span className="hidden text-xs text-muted xl:inline">{ROLE_LABELS[user.role]}</span>
              </Link>
              <button type="button" onClick={logout} aria-label="خروج از حساب" className="grid size-11 place-items-center rounded-full text-muted transition duration-300 hover:bg-red-50 hover:text-danger">
                <LogOut className="size-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button href="/login" variant="ghost" size="md">
                ورود
              </Button>
              <Button href="/register" size="md">
                ثبت‌نام
              </Button>
            </div>
          )}
        </div>

        <div className="ms-auto flex items-center gap-2 md:hidden">
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="جستجو" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink">
            <Search className="size-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="باز کردن منو" aria-expanded={menuOpen} className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink">
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="جستجوی خدمات" size="lg">
        <div className="space-y-5">
          <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">شهر انتخابی:</span>
            <LocationSelect />
          </div>
        </div>
      </Modal>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="آرنا">
        <div className="flex flex-col gap-7 p-5">
          {user ? (
            <Link href={dashboardHref} className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4">
              <span className="grid size-11 place-items-center rounded-full bg-brand font-bold text-white">{user.fullName.slice(0, 1)}</span>
              <span>
                <span className="block font-bold text-ink">{user.fullName}</span>
                <span className="text-xs text-muted">{ROLE_LABELS[user.role]} · ورود به پنل</span>
              </span>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button href="/login" variant="outline" fullWidth>
                ورود
              </Button>
              <Button href="/register" fullWidth>
                ثبت‌نام
              </Button>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted">دسته‌بندی‌ها</p>
            <ul className="space-y-1">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-brand/5">
                    <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                      <CategoryIcon name={c.iconKey} className="size-4" />
                    </span>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <nav aria-label="لینک‌های سایت" className="flex flex-col gap-1 border-t border-line pt-5">
            <Link href="/become-a-pro" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-brand/5">
              متخصص شوید
            </Link>
            <Link href="/blog" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-brand/5">
              وبلاگ
            </Link>
            <Link href="/#faq" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-brand/5">
              سؤالات متداول
            </Link>
            {user && (
              <button type="button" onClick={logout} className="rounded-xl px-3 py-3 text-start text-sm font-medium text-danger hover:bg-red-50">
                خروج از حساب
              </button>
            )}
          </nav>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted">شهر شما</p>
            <LocationSelect />
          </div>
        </div>
      </Drawer>
    </header>
  );
}

/** Bottom navigation for small screens on public pages, with an active pill. */
export function MobileTabBar({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  if (isDashboardPath(pathname)) return null;
  const items = [
    { href: "/", label: "خانه", icon: House, active: pathname === "/" },
    { href: "/categories", label: "خدمات", icon: Wrench, active: pathname.startsWith("/categories") || pathname.startsWith("/services") },
    { href: user?.role === "customer" ? "/account/orders" : "/login", label: "سفارش‌ها", icon: CalendarDays, active: pathname.startsWith("/account/orders") || pathname.startsWith("/booking") },
    { href: user ? (user.role === "admin" ? "/admin" : user.role === "professional" ? "/pro" : "/account") : "/login", label: "حساب", icon: User, active: false },
  ];
  return (
    <nav aria-label="ناوبری پایین صفحه" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link href={item.href} aria-current={item.active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${item.active ? "text-brand" : "text-muted"}`}>
                <span className={`grid h-8 w-14 place-items-center rounded-full transition duration-300 ${item.active ? "bg-brand-soft" : ""}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
