import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { CategoryCard, ServiceCard } from "@/components/catalog/Cards";
import { getCategoryBySlug, getCategoryTree, getServicesInCategory, type ServiceSort } from "@/lib/catalog";
import { CITIES, faNum } from "@/lib/domain";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug = [] } = await params;
  const last = slug[slug.length - 1];
  if (!last) return { title: "همه خدمات", description: "فهرست کامل خدمات منزل آرنا" };
  const cat = await getCategoryBySlug(last);
  if (!cat) return { title: "دسته‌بندی یافت نشد" };
  return { title: cat.category.seoTitle || cat.category.name, description: cat.category.seoDescription || cat.category.description, alternates: { canonical: `/categories/${last}` } };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug?: string[] }>; searchParams: Promise<SP> }) {
  const { slug = [] } = await params;
  const sp = await searchParams;
  const tree = await getCategoryTree();

  if (slug.length === 0) {
    return (
      <main id="main" className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <Breadcrumbs items={[{ name: "خدمات", href: "/categories" }]} />
        <div className="mt-6"><SectionTitle eyebrow="همه خدمات" title="دسته‌بندی خدمات منزل" description="یک دسته را انتخاب کنید و خدمات تخصصی آن را مقایسه کنید." /></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tree.map((c, i) => <CategoryCard key={c.id} category={c} index={i} />)}</div>
      </main>
    );
  }

  const cat = await getCategoryBySlug(slug[slug.length - 1]!);
  if (!cat) notFound();
  const sort = (one(sp.sort) ?? "popular") as ServiceSort;
  const q = one(sp.q) ?? "";
  const min = one(sp.min);
  const max = one(sp.max);
  const services = await getServicesInCategory(cat.category, cat.children, {
    q,
    sort,
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
  });
  const siblings = cat.parent ? tree.find((p) => p.id === cat.parent!.id)?.children.filter((c) => c.id !== cat.category.id) ?? [] : tree.filter((p) => p.id !== cat.category.id).slice(0, 6);
  const faqs = services.slice(0, 1).length ? (await import("@/lib/catalog")).getServiceDetail(services[0]!.slug).then((d) => d?.faqs ?? []) : Promise.resolve([]);
  const faqList = await faqs;

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <Breadcrumbs items={cat.breadcrumbs} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-ink md:text-4xl">{cat.category.name}</h1>
          <p className="mt-3 max-w-3xl leading-8 text-muted">{cat.category.description}</p>

          {cat.children.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {cat.children.map((c) => <Link key={c.id} href={`/categories/${c.slug}`} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-brand/40 hover:text-brand">{c.name}</Link>)}
            </div>
          )}

          <form method="get" className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-[1fr_12rem_8rem_8rem_auto]" role="search">
            <label className="sr-only" htmlFor="cat-q">جستجو در این دسته</label>
            <input id="cat-q" name="q" defaultValue={q} placeholder="جستجو در خدمات این دسته" className="h-11 rounded-xl border border-line bg-canvas px-3.5 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15" />
            <label className="sr-only" htmlFor="cat-sort">مرتب‌سازی</label>
            <select id="cat-sort" name="sort" defaultValue={sort} className="h-11 rounded-xl border border-line bg-canvas px-3 text-sm">
              <option value="popular">پرطرفدارترین</option><option value="rating">بالاترین امتیاز</option><option value="price_asc">ارزان‌ترین</option><option value="price_desc">گران‌ترین</option>
            </select>
            <input name="min" inputMode="numeric" defaultValue={min} placeholder="حداقل قیمت" aria-label="حداقل قیمت" className="h-11 rounded-xl border border-line bg-canvas px-3 text-sm" />
            <input name="max" inputMode="numeric" defaultValue={max} placeholder="حداکثر قیمت" aria-label="حداکثر قیمت" className="h-11 rounded-xl border border-line bg-canvas px-3 text-sm" />
            <button type="submit" className="h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong">اعمال فیلتر</button>
          </form>

          <p className="mt-6 text-sm text-muted" aria-live="polite">{faNum(services.length)} خدمت</p>
          {services.length === 0 ? (
            <div className="mt-4"><EmptyState icon="wrench" title="خدمتی با این فیلتر پیدا نشد" description="فیلترها را تغییر دهید یا جستجوی دیگری را امتحان کنید." action={<Button href={`/categories/${cat.category.slug}`} variant="outline" size="sm">پاک کردن فیلترها</Button>} /></div>
          ) : (
            <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{services.map((s) => <ServiceCard key={s.id} service={s} />)}</div>
          )}

          {faqList.length > 0 && (
            <section className="mt-14" aria-labelledby="cat-faq">
              <h2 id="cat-faq" className="mb-4 text-xl font-bold">سؤالات متداول</h2>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {faqList.map((f) => <details key={f.q} className="group"><summary className="cursor-pointer list-none px-6 py-4 font-semibold [&::-webkit-details-marker]:hidden">{f.q}</summary><p className="px-6 pb-5 leading-7 text-muted">{f.a}</p></details>)}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-bold">دسته‌های مرتبط</h2>
            <ul className="space-y-2 text-sm">{siblings.map((c) => <li key={c.id}><Link href={`/categories/${c.slug}`} className="text-muted transition hover:text-brand">{c.name}</Link></li>)}</ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 font-bold">پوشش شهرها</h2>
            <p className="text-sm leading-7 text-muted">{CITIES.map((c) => c.name).join("، ")}</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
