import Link from "next/link";
import { ArrowLeft, BadgeCheck, Briefcase, Clock, Quote, Star } from "lucide-react";
import { Avatar, Button, Stars } from "@/components/ui";
import { FavoriteButton } from "@/components/dashboard/Views";
import { ServiceIllustration, illustrationKind } from "@/components/illustrations/ServiceIllustration";
import type { CategoryNode, ProSummary, ReviewView, ServiceCard as ServiceCardData } from "@/lib/catalog";
import { faNum, formatDuration, formatPrice, formatShortDate, PRO_VERIFICATION_LABELS } from "@/lib/domain";

const FALLBACK_TONES = ["emerald", "sky", "amber", "rose", "violet", "lime", "mint", "slate"];

/** Service card: illustration header, rating, starting price and a stretched title link. */
export function ServiceCard({ service, compact = false }: { service: ServiceCardData; compact?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-500 ease-premium hover:-translate-y-1 hover:border-brand/25 hover:shadow-lift">
      <div className={`relative overflow-hidden ${compact ? "h-36" : "h-44"}`}>
        <ServiceIllustration
          kind={illustrationKind(service.iconKey, service.slug)}
          tone={service.tone}
          title={service.title}
          className="size-full transition duration-700 ease-premium group-hover:scale-105"
        />
        {service.isPopular && <span className="absolute start-4 top-4 rounded-full bg-surface/95 px-3 py-1 text-xs font-semibold text-brand shadow-sm">پرطرفدار</span>}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-semibold text-brand">{service.parentName}</span>
          <span className="flex shrink-0 items-center gap-1 font-semibold text-ink">
            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            {service.reviewsCount ? faNum(service.rating.toFixed(1)) : "جدید"}
            <span className="font-normal text-muted">({faNum(service.reviewsCount)})</span>
          </span>
        </div>

        <h3 className="text-[17px] font-bold leading-7 text-ink">
          <Link href={`/services/${service.slug}`} className="transition-colors after:absolute after:inset-0 hover:text-brand">
            {service.title}
          </Link>
        </h3>

        {!compact && <p className="line-clamp-2 text-sm leading-7 text-muted">{service.shortDescription}</p>}

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">شروع قیمت</p>
            <p className="mt-0.5 text-lg font-extrabold tracking-tight tabular-nums text-ink">{formatPrice(service.basePrice)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Clock className="size-3.5" aria-hidden="true" />
              حدود {formatDuration(service.durationMinutes)}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition duration-300 group-hover:bg-brand group-hover:text-white">
            انتخاب
            <ArrowLeft className="size-4 transition duration-300 group-hover:-translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  );
}

/** Category tile with a scene illustration, description and service count. */
export function CategoryCard({ category, index = 0 }: { category: CategoryNode; index?: number }) {
  const tone = category.tone || FALLBACK_TONES[index % FALLBACK_TONES.length]!;
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-2.5 shadow-card transition duration-500 ease-premium hover:-translate-y-1 hover:border-brand/25 hover:shadow-lift"
    >
      <div className="relative h-36 overflow-hidden rounded-2xl">
        <ServiceIllustration kind={illustrationKind(category.iconKey)} tone={tone} title={category.name} className="size-full transition duration-700 ease-premium group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-ink">{category.name}</h3>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand transition duration-300 group-hover:bg-brand group-hover:text-white">
            <ArrowLeft className="size-4 transition duration-300 group-hover:-translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
        <p className="line-clamp-2 text-sm leading-7 text-muted">{category.description}</p>
        <p className="mt-auto pt-2 text-xs font-semibold text-brand-strong">{faNum(category.serviceCount)} خدمت</p>
      </div>
    </Link>
  );
}

/** Professional profile card: identity, verification, key metrics and skills. */
export function ProCard({ pro }: { pro: ProSummary }) {
  return (
    <article className="group relative flex h-full flex-col gap-5 rounded-3xl border border-line bg-surface p-6 shadow-card transition duration-500 ease-premium hover:-translate-y-1 hover:border-brand/25 hover:shadow-lift">
      <div className="flex items-start gap-4">
        <Avatar name={pro.fullName} tone={pro.avatarTone} src={pro.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-bold text-ink">{pro.fullName}</h3>
            {pro.verificationStatus === "verified" && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label={PRO_VERIFICATION_LABELS.verified} />}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{pro.headline}</p>
        </div>
        <FavoriteButton type="professional" id={pro.userId} label={pro.fullName} />
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-canvas py-3 text-center">
        <div>
          <dt className="text-xs text-muted">امتیاز</dt>
          <dd className="mt-1 font-bold tabular-nums text-ink">{pro.reviewsCount ? faNum(pro.rating.toFixed(1)) : "جدید"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">سفارش</dt>
          <dd className="mt-1 font-bold tabular-nums text-ink">{faNum(pro.completedJobs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">سابقه</dt>
          <dd className="mt-1 font-bold tabular-nums text-ink">{faNum(pro.experienceYears)} سال</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {pro.skills.slice(0, 2).map((s) => (
          <span key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong">
            {s}
          </span>
        ))}
        <span className="ms-auto flex items-center gap-1 text-xs text-muted">
          <Briefcase className="size-3.5" aria-hidden="true" />
          {pro.serviceAreas.slice(0, 2).join("، ")}
        </span>
      </div>
      <span className="sr-only">
        <Stars value={pro.rating} />
      </span>
    </article>
  );
}

/** Customer review as a quotation card. */
export function ReviewCard({ review, showService = true }: { review: ReviewView; showService?: boolean }) {
  return (
    <figure className="flex h-full flex-col gap-5 rounded-3xl border border-line bg-surface p-7 shadow-card">
      <Quote className="size-8 fill-lime text-lime" aria-hidden="true" />
      <blockquote className="flex-1 text-[15px] leading-8 text-ink/90">“{review.comment}”</blockquote>
      <figcaption className="flex items-center justify-between gap-3 border-t border-line pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={review.authorName} tone="sky" size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{review.authorName}</p>
            <p className="truncate text-xs text-muted">
              {showService ? `${review.serviceTitle} · ` : ""}
              {formatShortDate(review.createdAt)}
            </p>
          </div>
        </div>
        <Stars value={review.rating} size="size-3.5" />
      </figcaption>
      {review.reply && <p className="rounded-xl bg-canvas p-3 text-xs leading-6 text-muted">پاسخ متخصص: {review.reply}</p>}
    </figure>
  );
}

export function EmptyCatalog({ query }: { query?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface p-10 text-center">
      <p className="font-semibold text-ink">{query ? `خدمتی برای «${query}» پیدا نشد` : "خدمتی در این بخش فعال نیست"}</p>
      <p className="mt-2 text-sm text-muted">عبارت دیگری را امتحان کنید یا همه دسته‌بندی‌ها را ببینید.</p>
      <div className="mt-5 flex justify-center">
        <Button href="/categories" variant="outline" size="sm">
          همه دسته‌بندی‌ها
        </Button>
      </div>
    </div>
  );
}
