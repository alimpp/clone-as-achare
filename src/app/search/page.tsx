import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Button, SectionTitle } from "@/components/ui";
import { SearchBox } from "@/components/search/SearchBox";
import { ServiceCard } from "@/components/catalog/Cards";
import { searchServices, type ServiceSort } from "@/lib/catalog";
import { faNum, POPULAR_SEARCHES } from "@/lib/domain";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const metadata: Metadata = { title: "جستجوی خدمات", description: "جستجوی خدمات منزل با پشتیبانی از املای فارسی و مترادف‌ها." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (one(sp.q) ?? "").trim();
  const sort = (one(sp.sort) ?? (q ? "relevance" : "popular")) as ServiceSort;
  const min = one(sp.min);
  const max = one(sp.max);
  const result = q || min || max ? await searchServices(q, { sort, minPrice: min ? Number(min) : undefined, maxPrice: max ? Number(max) : undefined }) : null;

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <SectionTitle title={q ? `نتایج جستجو برای «${q}»` : "جستجوی خدمات"} description="عبارت خود را با فارسی یا مترادف آن بنویسید؛ مثلاً «کولر» یا «اسپلیت»." />
      <div className="mt-6 max-w-3xl"><SearchBox defaultValue={q} variant="hero" /></div>

      {!result && (
        <section className="mt-12">
          <h2 className="mb-4 font-bold">جستجوهای پرتکرار</h2>
          <div className="flex flex-wrap gap-2">{POPULAR_SEARCHES.map((p) => <Link key={p} href={`/search?q=${encodeURIComponent(p)}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm transition hover:border-brand/40 hover:text-brand">{p}</Link>)}</div>
        </section>
      )}

      {result && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
          <aside className="space-y-4 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-bold">فیلترها</h2>
            <form method="get" className="space-y-3">
              <input type="hidden" name="q" value={q} />
              <label className="block text-sm"><span className="mb-1 block text-muted">مرتب‌سازی</span><select name="sort" defaultValue={sort} className="h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm"><option value="relevance">مرتبط‌ترین</option><option value="rating">امتیاز</option><option value="price_asc">ارزان‌ترین</option><option value="price_desc">گران‌ترین</option><option value="popular">پرطرفدار</option></select></label>
              <label className="block text-sm"><span className="mb-1 block text-muted">حداقل قیمت (تومان)</span><input name="min" inputMode="numeric" defaultValue={min} className="h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm" /></label>
              <label className="block text-sm"><span className="mb-1 block text-muted">حداکثر قیمت (تومان)</span><input name="max" inputMode="numeric" defaultValue={max} className="h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm" /></label>
              <button type="submit" className="h-10 w-full rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-strong">اعمال</button>
            </form>
          </aside>
          <section aria-live="polite">
            {result.categories.length > 0 && <div className="mb-6 flex flex-wrap gap-2 text-sm"><span className="text-muted">دسته‌های مرتبط:</span>{result.categories.map((c) => <Link key={c.id} href={`/categories/${c.slug}`} className="font-medium text-brand hover:underline">{c.name}</Link>)}</div>}
            <p className="mb-5 text-sm text-muted">{faNum(result.total)} خدمت پیدا شد</p>
            {result.services.length === 0 ? (
              <EmptyState icon="wrench" title="نتیجه‌ای پیدا نشد" description="املای عبارت را بررسی کنید، عبارت کلی‌تری بنویسید یا از دسته‌بندی‌ها استفاده کنید." action={<Button href="/categories" variant="outline" size="sm">مشاهده همه دسته‌بندی‌ها</Button>} />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{result.services.map((s) => <ServiceCard key={s.id} service={s} />)}</div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
