import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarClock, ChevronDown, CircleCheck, MapPin, ShieldCheck, Sparkles, Star } from "lucide-react";
import { LocationSelect, SearchBox } from "@/components/search/SearchBox";
import { CategoryCard, ProCard, ReviewCard, ServiceCard } from "@/components/catalog/Cards";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { Button, CategoryIcon, Reveal, SectionTitle } from "@/components/ui";
import type { HomeData } from "@/lib/catalog";
import { CITIES, faNum } from "@/lib/domain";

const STEPS = [
  { icon: "file", title: "خدمت موردنظر را انتخاب کنید", text: "از میان بیش از سی خدمت تخصصی، دسته و خدمت دقیق خود را پیدا کنید." },
  { icon: "message", title: "نیاز خود را شرح دهید", text: "فرم هوشمند مخصوص همان خدمت، جزئیات مشکل و تصاویر را دریافت می‌کند." },
  { icon: "badge", title: "پیشنهاد متخصصان را بگیرید", text: "متخصصان تأییدشده منطقه شما قیمت و زمان حضور خود را ارسال می‌کنند." },
  { icon: "star", title: "مقایسه و انتخاب کنید", text: "قیمت، امتیاز، سابقه و نظرات دیگر کاربران را کنار هم ببینید." },
  { icon: "clock", title: "زمان قرار را تعیین کنید", text: "تاریخ و بازه زمانی دلخواه یا خدمت فوری را انتخاب کنید." },
  { icon: "wallet", title: "پرداخت امن و شفاف", text: "خلاصه کامل سفارش، کارمزد و تخفیف را پیش از پرداخت می‌بینید." },
  { icon: "check", title: "خدمت را دریافت کنید", text: "پیگیری لحظه‌ای وضعیت سفارش و گفتگو با متخصص تا پایان کار." },
  { icon: "shield", title: "نظر خود را ثبت کنید", text: "با امتیاز و نظر شما، کیفیت خدمات برای همه شفاف‌تر می‌شود." },
];

const WHY = [
  { icon: "badge", title: "متخصصان تأییدشده", text: "مدارک هویتی و تخصصی همه متخصصان پیش از فعال‌شدن بررسی می‌شود." },
  { icon: "wallet", title: "قیمت شفاف و مقایسه‌پذیر", text: "پیش از انتخاب، همه پیشنهادها را کنار هم می‌بینید؛ هیچ هزینه پنهانی وجود ندارد." },
  { icon: "clock", title: "رزرو سریع و انعطاف‌پذیر", text: "همان روز یا در بازه دلخواه؛ با امکان تغییر زمان تا قبل از شروع کار." },
  { icon: "headset", title: "پشتیبانی همراه شما", text: "در صورت بروز مشکل، تیم پشتیبانی آرنا با ثبت اختلاف، موضوع را پیگیری می‌کند." },
];

const GUARANTEES = [
  { icon: "shield", title: "پرداخت امن", text: "مبلغ تا تأیید سفارش در سامانه نگهداری و در صورت لغو بازپرداخت می‌شود." },
  { icon: "scale", title: "حل اختلاف", text: "در صورت نارضایتی، سفارش را در بخش اختلاف ثبت کنید تا بررسی شود." },
  { icon: "sparkles", title: "کیفیت تضمین‌شده", text: "امتیاز و نظرات واقعی کاربران پس از هر سفارش در پروفایل متخصص ثبت می‌شود." },
];

const TRUST = [
  "احراز هویت با شماره موبایل برای همه کاربران",
  "بررسی مدارک متخصص توسط تیم مدیریت",
  "ثبت کامل تاریخچه سفارش و پیام‌ها",
  "امکان گزارش تخلف و مسدودسازی حساب",
];

/** Positions on a circle, in percent of the composition box (0° is the right-hand side). */
const ORBIT_ANGLES = [-90, -30, 30, 90, 150, 210];
function orbitPosition(deg: number, radius = 36) {
  const rad = (deg * Math.PI) / 180;
  return { left: `${50 + radius * Math.cos(rad)}%`, top: `${50 + radius * Math.sin(rad)}%` };
}

export function HomeView({ data }: { data: HomeData }) {
  const topCategories = data.parents.slice(0, 12);
  const orbitCategories = data.parents.slice(0, 6);
  const seoServices = data.popular.slice(0, 12);
  const avgRating = data.pros.length ? data.pros.reduce((sum, p) => sum + p.rating, 0) / data.pros.length : 4.8;
  const tickerNames = data.parents.map((p) => p.name);

  return (
    <main id="main" className="overflow-x-hidden">
      {/* ---------- Hero ---------- */}
      <section className="relative isolate">
        <div className="hero-grid absolute inset-0 -z-10" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(45%_55%_at_84%_16%,rgba(200,241,105,0.26),transparent_70%),radial-gradient(40%_50%_at_6%_0%,rgba(185,245,208,0.7),transparent_70%)]"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-20 pt-12 md:px-6 md:pb-28 md:pt-20 lg:grid-cols-12 lg:gap-12">
          <div className="stagger min-w-0 lg:col-span-7">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-brand/15 bg-surface/90 py-1.5 pe-4 ps-2.5 text-sm font-medium text-brand-strong shadow-sm">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              متخصصان تأییدشده، قیمت شفاف، رزرو آنلاین
            </p>

            <h1 className="display mt-7">
              خدمات منزل را <span className="highlight whitespace-nowrap">با اطمینان</span> بسپارید
            </h1>

            <p className="mt-7 max-w-xl text-[17px] leading-9 text-muted">
              از نظافت و لوله‌کشی تا تعمیر لوازم خانگی و نقاشی؛ نیاز خود را ثبت کنید، پیشنهاد متخصصان را مقایسه کنید و در زمان دلخواه خدمت بگیرید.
            </p>

            <div className="mt-10 max-w-3xl">
              <SearchBox variant="hero" />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LocationSelect />
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {["نظافت منزل", "تعمیر کولر", "نشتی آب", "نقاشی دیوار", "تعمیر یخچال"].map((s) => (
                  <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink/85 transition duration-300 hover:-translate-y-px hover:border-brand/40 hover:text-brand">
                    {s}
                  </Link>
                ))}
              </div>
            </div>

            <dl className="mt-14 grid max-w-xl grid-cols-[repeat(3,minmax(0,1fr))] divide-x divide-line border-y border-line py-7">
              {[
                { k: "متخصص تأییدشده", v: `${faNum(data.stats.pros)}+` },
                { k: "خدمت تخصصی", v: faNum(data.stats.services) },
                { k: "نظر ثبت‌شده", v: `${faNum(data.stats.reviews)}+` },
              ].map((s) => (
                <div key={s.k} className="px-3 first:ps-0 md:px-5">
                  <dt className="text-xs text-muted md:text-sm">{s.k}</dt>
                  <dd className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-ink md:text-3xl">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Composition: category orbit around a brand mark, with two live-looking status cards. */}
          <div className="relative mx-auto aspect-square w-full max-w-[30rem] lg:col-span-5">
            <div aria-hidden="true" className="absolute inset-[4%] animate-orbit-spin rounded-full border border-dashed border-brand/30" />
            <div aria-hidden="true" className="absolute inset-[16%] rounded-full border border-brand/15 bg-surface/50" />
            <div aria-hidden="true" className="absolute inset-[30%] rounded-full bg-gradient-to-br from-mint via-surface to-lime/40 shadow-card" />

            <div aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-[26%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-white shadow-glow">
              <span className="text-4xl font-black">آ</span>
            </div>

            {orbitCategories.map((c, i) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                aria-label={c.name}
                title={c.name}
                className="animate-float absolute grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-line bg-surface text-brand shadow-card transition duration-300 hover:scale-110 hover:border-brand/30 hover:shadow-lift md:size-[4.5rem]"
                style={{ ...orbitPosition(ORBIT_ANGLES[i]!), animationDelay: `${i * 0.9}s` }}
              >
                <CategoryIcon name={c.iconKey} className="size-7" />
              </Link>
            ))}

            <div className="animate-fade-up absolute -start-2 bottom-0 w-44 rounded-2xl border border-line bg-surface p-4 shadow-lift md:-start-8" style={{ animationDelay: "0.6s" }} aria-hidden="true">
              <div className="flex items-center justify-between text-xs">
                <span className="whitespace-nowrap font-bold text-ink">متخصص در مسیر</span>
                <span className="whitespace-nowrap text-muted" dir="ltr">AR-100214</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mint/60">
                <div className="h-full w-[72%] origin-right animate-grow-x rounded-full bg-brand" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <span className="size-2 rounded-full bg-lime ring-2 ring-lime/30" />
                مرحله تکمیل شده در مسیر محل شما
              </div>
            </div>

            <div className="animate-fade-up absolute -end-2 top-[6%] flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pe-4 shadow-lift md:-end-6" style={{ animationDelay: "0.9s" }} aria-hidden="true">
              <span className="grid size-11 place-items-center rounded-xl bg-amber-50">
                <Star className="size-5 fill-amber-400 text-amber-400" />
              </span>
              <span className="text-xs leading-5">
                <span className="block text-base font-extrabold tabular-nums text-ink">{faNum(avgRating.toFixed(1))}</span>
                <span className="text-muted">میانگین امتیاز متخصصان</span>
              </span>
            </div>

            <div className="animate-fade-up absolute end-6 bottom-2 flex items-center gap-2 rounded-full bg-night px-4 py-2.5 text-xs text-white shadow-lift md:end-10" style={{ animationDelay: "1.1s" }} aria-hidden="true">
              <CalendarClock className="size-4 text-lime" />
              قرار امروز · ۸ تا ۱۰ صبح
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Service ticker ---------- */}
      <div className="relative overflow-hidden border-y border-line bg-surface/70 py-5" aria-label="دسته‌بندی‌های آرنا">
        <div className="flex w-max animate-marquee items-center gap-12 whitespace-nowrap ps-12 text-lg font-bold text-ink/75">
          {[...tickerNames, ...tickerNames].map((name, i) => (
            <span key={`${name}-${i}`} aria-hidden={i >= tickerNames.length || undefined} className="flex items-center gap-12">
              {name}
              <span className="size-1.5 rounded-full bg-lime ring-2 ring-brand/20" />
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Categories ---------- */}
      <section id="categories" className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal>
          <SectionTitle
            eyebrow="دسته‌بندی خدمات"
            title="هر کاری که نیاز دارید، یک انتخاب فاصله"
            description="خدمات بر اساس نوع کار دسته‌بندی شده‌اند تا سریع‌تر به متخصص مناسب برسید."
            action={
              <Button href="/categories" variant="outline" icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
                همه خدمات
              </Button>
            }
          />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {topCategories.map((c, i) => (
            <Reveal key={c.id} delay={(i % 4) * 60}>
              <CategoryCard category={c} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Popular services ---------- */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionTitle eyebrow="پرطرفدارترین‌ها" title="خدماتی که این هفته بیشتر رزرو شدند" description="انتخاب کاربران آرنا؛ با قیمت شروع شفاف و امتیاز واقعی." />
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.popular.map((s, i) => (
              <Reveal key={s.id} delay={(i % 3) * 80}>
                <ServiceCard service={s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 md:px-6 md:py-28">
        <Reveal>
          <SectionTitle eyebrow="نحوه کار" title="از درخواست تا پایان کار، در هشت گام" description="مسیر ساده و شفاف آرنا؛ هر مرحله در داشبورد شما قابل پیگیری است." />
        </Reveal>
        <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Reveal delay={(i % 4) * 70}>
                <div className="group relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card transition duration-500 hover:-translate-y-1 hover:border-brand/25 hover:shadow-lift">
                  <span aria-hidden="true" className="pointer-events-none absolute -end-2 -top-8 select-none text-[8.5rem] font-black leading-none text-brand/[0.05] transition duration-500 group-hover:text-brand/[0.1]">
                    {faNum(i + 1)}
                  </span>
                  <span className="relative grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand transition duration-500 group-hover:bg-brand group-hover:text-white">
                    <CategoryIcon name={step.icon} className="size-5" />
                  </span>
                  <h3 className="relative mt-6 font-bold leading-7 text-ink">{step.title}</h3>
                  <p className="relative mt-2 text-sm leading-7 text-muted">{step.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Why / Trust / Guarantees (dark) ---------- */}
      <section className="relative overflow-hidden bg-night py-20 text-white md:py-28">
        <div className="grain-layer pointer-events-none absolute inset-0" aria-hidden="true" />
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(#C8F169 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div aria-hidden="true" className="absolute -start-40 top-0 size-[32rem] rounded-full bg-brand/25 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <p className="eyebrow !text-lime before:!bg-lime">چرا آرنا؟</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-extrabold leading-[1.45] md:text-[2.5rem]">تجربه‌ای که به آن اعتماد می‌کنید</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {WHY.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition duration-500 hover:border-lime/35 hover:bg-white/[0.07]">
                  <span className="grid size-11 place-items-center rounded-2xl bg-lime text-night">
                    <CategoryIcon name={item.icon} className="size-5" />
                  </span>
                  <h3 className="mt-6 font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/60">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-20 grid gap-12 lg:grid-cols-2">
            <Reveal>
              <h3 className="text-2xl font-bold">ایمنی و اعتماد</h3>
              <ul className="mt-7 space-y-4">
                {TRUST.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-white/80">
                    <CircleCheck className="mt-1 size-5 shrink-0 text-lime" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <h3 className="text-2xl font-bold">ضمانت‌های آرنا</h3>
              <div className="mt-7 grid gap-4">
                {GUARANTEES.map((g) => (
                  <div key={g.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lime">
                      <CategoryIcon name={g.icon} className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{g.title}</p>
                      <p className="mt-1 text-sm leading-7 text-white/60">{g.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Promotions ---------- */}
      {data.banners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {data.banners.map((b, i) => (
              <Reveal key={b.id} delay={i * 80}>
                <Link href={b.ctaHref} className="group relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-card transition duration-500 hover:-translate-y-1 hover:border-brand/25 hover:shadow-lift">
                  <span className={`pointer-events-none absolute -end-12 -top-12 size-44 rounded-full opacity-70 blur-2xl transition duration-700 group-hover:scale-125 ${b.tone === "amber" ? "bg-amber-200" : b.tone === "sky" ? "bg-sky-200" : "bg-mint"}`} aria-hidden="true" />
                  <div className="relative">
                    <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-strong">پیشنهاد ویژه</span>
                    <h3 className="mt-5 text-xl font-bold leading-8 text-ink">{b.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted">{b.subtitle}</p>
                  </div>
                  <span className="relative mt-8 flex items-center gap-2 text-sm font-bold text-brand">
                    {b.ctaLabel}
                    <ArrowLeft className="size-4 transition duration-300 group-hover:-translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Trusted professionals ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal>
          <SectionTitle eyebrow="متخصصان برتر" title="با متخصصانی کار کنید که نتیجه‌شان را نشان داده‌اند" description="بالاترین امتیاز و تعداد سفارش‌های انجام‌شده؛ همه تأییدشده." />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.pros.map((p, i) => (
            <Reveal key={p.userId} delay={i * 70}>
              <ProCard pro={p} />
            </Reveal>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted">
          <BadgeCheck className="size-4 text-brand" aria-hidden="true" />
          مدارک هر متخصص پیش از فعال‌سازی بررسی شده است.
        </p>
      </section>

      {/* ---------- Reviews ---------- */}
      <section className="border-y border-line bg-surface/60 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Reveal>
            <SectionTitle eyebrow="نظر مشتریان" title="تجربه واقعی کاربران آرنا" description="نظراتی که پس از انجام خدمت، توسط مشتریان ثبت شده است." />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.reviews.slice(0, 6).map((r, i) => (
              <Reveal key={r.id} delay={(i % 3) * 80}>
                <ReviewCard review={r} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Cities ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
        <Reveal>
          <SectionTitle eyebrow="پوشش جغرافیایی" title="شهرها و مناطقی که آرنا در آن فعال است" description="برای هر شهر، متخصصان منطقه‌ای با پوشش کامل محله‌ها انتخاب می‌شوند." />
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CITIES.map((city, i) => (
            <Reveal key={city.slug} delay={(i % 3) * 60}>
              <div className="h-full rounded-3xl border border-line bg-surface p-6 transition duration-500 hover:border-brand/25 hover:shadow-card">
                <div className="flex items-center gap-2.5 text-lg font-bold text-ink">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
                    <MapPin className="size-4" aria-hidden="true" />
                  </span>
                  {city.name}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {city.regions.map((r) => (
                    <span key={r} className="rounded-full bg-canvas px-3 py-1 text-xs text-muted">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Newsletter ---------- */}
      <Reveal>
        <div className="pb-20">
          <NewsletterForm />
        </div>
      </Reveal>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-4 pb-20 md:px-6 md:pb-28">
        <Reveal>
          <SectionTitle eyebrow="سؤالات متداول" title="پاسخ پرسش‌های رایج" />
        </Reveal>
        <div className="mt-12 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
          {data.faqs.map((f) => (
            <details key={f.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold text-ink transition-colors hover:bg-brand/[0.03] md:px-7 [&::-webkit-details-marker]:hidden">
                {f.question}
                <ChevronDown className="size-5 shrink-0 text-brand transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="animate-fade-up px-6 pb-6 leading-8 text-muted md:px-7">{f.answer}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- SEO links ---------- */}
      <section className="border-t border-line bg-surface/50 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-base font-bold text-ink">جستجوی پرتکرار خدمات منزل</h2>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {seoServices.map((s) => (
              <Link key={s.id} href={`/services/${s.slug}`} className="text-muted transition-colors hover:text-brand">
                {s.title} در تهران
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {topCategories.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`} className="font-medium text-ink transition-colors hover:text-brand">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
