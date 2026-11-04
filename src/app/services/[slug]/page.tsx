import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";
import { Breadcrumbs, Button, Card, CoverArt, Rating, SectionTitle, Stars } from "@/components/ui";
import { FavoriteButton } from "@/components/dashboard/Views";
import { ProCard, ReviewCard, ServiceCard } from "@/components/catalog/Cards";
import { getServiceDetail } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { formatDuration, formatPrice, faNum } from "@/lib/domain";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getServiceDetail(slug);
  if (!d) return { title: "خدمت یافت نشد" };
  const title = d.service.seoTitle || d.service.title;
  const description = d.service.seoDescription || d.service.shortDescription;
  return {
    title,
    description,
    alternates: { canonical: `/services/${slug}` },
    openGraph: { title, description, type: "website", url: `/services/${slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [d, user] = await Promise.all([getServiceDetail(slug), getCurrentUser()]);
  if (!d) notFound();
  const s = d.service;
  const jsonLd = { "@context": "https://schema.org", "@type": "Service", name: s.title, description: s.shortDescription, areaServed: "ایران", offers: { "@type": "Offer", priceCurrency: "IRR", price: s.basePrice } };

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={d.breadcrumbs} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-12">
          <div className="overflow-hidden rounded-3xl border border-line">
            <CoverArt tone={s.tone} icon={d.category.iconKey} title={s.title} className="h-64 md:h-80" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand">{d.parent?.name} · {d.category.name}</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{s.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
              <Rating value={s.rating} count={s.reviewsCount} />
              <span className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{formatDuration(s.durationMinutes)}</span>
            </div>
            <p className="mt-6 text-lg leading-9 text-ink/90">{s.description}</p>
          </div>

          <section aria-labelledby="benefits"><h2 id="benefits" className="mb-5 text-xl font-bold">مزایای این خدمت</h2><ul className="grid gap-3 sm:grid-cols-2">{s.benefits.map((b) => <li key={b} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />{b}</li>)}</ul></section>

          <section aria-labelledby="steps"><h2 id="steps" className="mb-5 text-xl font-bold">مراحل سفارش</h2><ol className="grid gap-4 md:grid-cols-5">{s.steps.map((step, i) => <li key={step} className="rounded-2xl border border-line bg-surface p-5"><span className="text-2xl font-extrabold text-brand/40">{faNum(i + 1)}</span><p className="mt-2 text-sm font-semibold">{step}</p></li>)}</ol></section>

          <section aria-labelledby="pricing" className="grid gap-6 md:grid-cols-2">
            <Card className="p-6"><h2 id="pricing" className="mb-3 font-bold">قیمت و عوامل مؤثر</h2><p className="text-sm text-muted">شروع قیمت:</p><p className="text-2xl font-extrabold">{formatPrice(s.basePrice)}</p><ul className="mt-4 list-disc space-y-1.5 ps-5 text-sm text-muted">{s.priceFactors.map((f) => <li key={f}>{f}</li>)}</ul></Card>
            <Card className="p-6"><h2 className="mb-3 font-bold">پیش‌نیازها</h2><ul className="space-y-2 text-sm text-muted">{s.requirements.map((r) => <li key={r} className="flex gap-2"><span aria-hidden="true">•</span>{r}</li>)}</ul></Card>
          </section>

          <section aria-labelledby="form-preview"><h2 id="form-preview" className="mb-2 text-xl font-bold">اطلاعات موردنیاز برای ثبت سفارش</h2><p className="mb-5 text-sm text-muted">فرم این خدمت مخصوص همین کار طراحی شده است؛ پاسخ‌های شما به متخصص کمک می‌کند دقیق‌تر پیشنهاد دهد.</p><ul className="grid gap-3 sm:grid-cols-2">{s.questions.map((q) => <li key={q.key} className="rounded-xl border border-dashed border-line bg-surface/70 p-4 text-sm">{q.label}{q.required && <span className="ms-1 text-danger">*</span>}</li>)}</ul></section>

          <section aria-labelledby="pros">
            <SectionTitle title="متخصصان این خدمت" description="متخصصان تأییدشده‌ای که در این حوزه فعال‌اند." />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">{d.pros.length ? d.pros.map((p) => <ProCard key={p.userId} pro={p} />) : <p className="text-sm text-muted">در حال حاضر متخصص فعالی برای این خدمت ثبت نشده است.</p>}</div>
          </section>

          <section aria-labelledby="reviews"><h2 id="reviews" className="mb-6 text-xl font-bold">نظر مشتریان</h2><div className="grid gap-5 md:grid-cols-2">{d.reviews.length ? d.reviews.map((r) => <ReviewCard key={r.id} review={r} showService={false} />) : <p className="text-sm text-muted">هنوز نظری ثبت نشده است.</p>}</div></section>

          <section aria-labelledby="faq"><h2 id="faq" className="mb-4 text-xl font-bold">سؤالات متداول</h2><div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{d.faqs.map((f) => <details key={f.q} className="group"><summary className="cursor-pointer list-none px-6 py-4 font-semibold [&::-webkit-details-marker]:hidden">{f.q}</summary><p className="px-6 pb-5 leading-7 text-muted">{f.a}</p></details>)}</div></section>

          {d.related.length > 0 && <section aria-labelledby="related"><h2 id="related" className="mb-6 text-xl font-bold">خدمات مرتبط</h2><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{d.related.map((r) => <ServiceCard key={r.id} service={r} compact />)}</div></section>}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-5 p-6 shadow-lift">
            <div>
              <p className="text-sm text-muted">شروع قیمت</p>
              <p className="text-3xl font-extrabold">{formatPrice(s.basePrice)}</p>
              <p className="mt-1 text-xs text-muted">قیمت نهایی پس از انتخاب متخصص و پیش از پرداخت نمایش داده می‌شود.</p>
            </div>
            <ul className="space-y-2 text-sm text-muted"><li>• متخصص تأییدشده و بیمه‌شده</li><li>• مقایسه چند پیشنهاد قبل از انتخاب</li><li>• پرداخت امن و بازپرداخت در صورت لغو</li></ul>
            <div className="flex items-center gap-3">
              <Button href={user ? `/booking/${s.slug}` : `/login?next=/booking/${s.slug}`} fullWidth size="lg" icon={<ArrowLeft className="size-5" aria-hidden="true" />}>شروع سفارش</Button>
              {user && <FavoriteButton type="service" id={String(s.id)} label={s.title} />}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted"><Stars value={s.rating} size="size-3.5" /> از {faNum(s.reviewsCount)} نظر</div>
          </Card>
        </aside>
      </div>
      <span className="sr-only"><ServiceCard service={d.card} /></span>
    </main>
  );
}
