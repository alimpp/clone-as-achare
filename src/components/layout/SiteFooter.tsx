"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CategoryIcon } from "@/components/ui";
import { isDashboardPath, Logo } from "./SiteHeader";

export interface FooterCategory {
  slug: string;
  name: string;
  iconKey: string;
}

const LINK = "text-sm text-white/65 transition-colors hover:text-lime";
const HEADING = "text-xs font-bold tracking-wide text-white/90";

export function SiteFooter({ categories, year }: { categories: FooterCategory[]; year: string }) {
  const pathname = usePathname();
  if (isDashboardPath(pathname)) return null;

  return (
    <footer className="relative overflow-hidden bg-night text-white/65 pb-24 md:pb-0">
      <div className="grain-layer pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-40 start-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 md:px-6 md:pt-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo inverse />
            <p className="mt-6 max-w-md text-[15px] leading-8 text-white/65">
              آرنا بازار تخصصی خدمات منزل است؛ متخصصان تأییدشده، قیمت شفاف و رزرو آنلاین در شهرهای بزرگ ایران.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/become-a-pro" className="inline-flex h-10 items-center rounded-xl bg-lime px-4 text-sm font-semibold text-night transition hover:-translate-y-px hover:brightness-105">
                همکاری به عنوان متخصص
              </Link>
              <Link href="/register" className="inline-flex h-10 items-center rounded-xl border border-white/20 px-4 text-sm font-medium text-white transition hover:bg-white/10">
                ساخت حساب مشتری
              </Link>
            </div>
          </div>

          <nav aria-label="دسته‌بندی‌های خدمات" className="lg:col-span-3">
            <h2 className={HEADING}>خدمات</h2>
            <ul className="mt-5 space-y-3">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/categories/${c.slug}`} className={`${LINK} flex items-center gap-2.5`}>
                    <CategoryIcon name={c.iconKey} className="size-4 text-lime/80" />
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="آرنا" className="lg:col-span-2">
            <h2 className={HEADING}>آرنا</h2>
            <ul className="mt-5 space-y-3">
              <li>
                <Link href="/search" className={LINK}>جستجوی پیشرفته</Link>
              </li>
              <li>
                <Link href="/blog" className={LINK}>وبلاگ</Link>
              </li>
              <li>
                <Link href="/pages/about" className={LINK}>درباره آرنا</Link>
              </li>
              <li>
                <Link href="/pages/terms" className={LINK}>قوانین و مقررات</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="حساب کاربری" className="lg:col-span-2">
            <h2 className={HEADING}>حساب کاربری</h2>
            <ul className="mt-5 space-y-3">
              <li>
                <Link href="/login" className={LINK}>ورود</Link>
              </li>
              <li>
                <Link href="/register" className={LINK}>ثبت‌نام مشتری</Link>
              </li>
              <li>
                <Link href="/become-a-pro" className={LINK}>ثبت‌نام متخصص</Link>
              </li>
              <li>
                <Link href="/login?mode=forgot" className={LINK}>فراموشی رمز عبور</Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 py-7 text-xs leading-6 text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {year} آرنا · تمامی حقوق محفوظ است.</p>
          <p>این نسخه نمایشی است؛ پرداخت‌ها در محیط آزمایشی (Sandbox) انجام می‌شوند و هیچ مبلغ واقعی جابه‌جا نمی‌شود.</p>
        </div>
      </div>
    </footer>
  );
}
