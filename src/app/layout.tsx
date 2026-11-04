import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/vazirmatn/index.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider";
import { MobileTabBar, SiteHeader, type HeaderCategory } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getCurrentUser } from "@/lib/auth";
import { getCategoryTree } from "@/lib/catalog";
import { ensureSeeded } from "@/lib/seed";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "آرنا | بازار تخصصی خدمات منزل",
    template: "%s | آرنا",
  },
  description: "رزرو آنلاین خدمات منزل با متخصصان تأییدشده؛ نظافت، لوله‌کشی، برق، تعمیر لوازم خانگی، نقاشی و اسباب‌کشی با قیمت شفاف.",
  applicationName: "آرنا",
  keywords: ["خدمات منزل", "نظافت منزل", "لوله کشی", "تعمیر کولر", "نقاشی ساختمان", "اسباب کشی", "متخصص تهران"],
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "آرنا",
    title: "آرنا | بازار تخصصی خدمات منزل",
    description: "متخصصان تأییدشده، قیمت شفاف و رزرو آنلاین خدمات منزل.",
    url: SITE_URL,
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#087F5B",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const [user, tree] = await Promise.all([getCurrentUser(), getCategoryTree()]);

  const headerCategories: HeaderCategory[] = tree.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    iconKey: p.iconKey,
    tone: p.tone,
    children: p.children.map((c) => ({ slug: c.slug, name: c.name })),
  }));
  const footerCategories = tree.map((p) => ({ slug: p.slug, name: p.name, iconKey: p.iconKey }));
  const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", timeZone: "Asia/Tehran" }).format(new Date());
  const headerUser = user ? { fullName: user.fullName, role: user.role, avatarUrl: user.avatarUrl } : null;

  return (
    <html lang="fa" dir="rtl" className="h-full scroll-smooth">
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased">
        <ToastProvider>
          <FavoritesProvider>
            <SiteHeader user={headerUser} categories={headerCategories} />
            <div className="flex-1">{children}</div>
            <SiteFooter categories={footerCategories} year={year} />
            <MobileTabBar user={headerUser} />
          </FavoritesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
