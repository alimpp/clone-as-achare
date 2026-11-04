"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, LayoutDashboard, MessageCircle } from "lucide-react";
import { apiRequest, Badge, Button, Card, ErrorState, Spinner, Stars, useAction, useApi, useConfirm } from "@/components/ui";
import { OrderTimeline, PaymentBadge, StatusBadge } from "@/components/dashboard/Views";
import { formatDate, formatPrice, TIME_SLOTS, type OrderStatus, type PaymentStatus } from "@/lib/domain";

interface OfferItem {
  id: number;
  price: number;
  arrivalMinutes: number;
  description: string;
  isDemo: boolean;
  professional: {
    fullName: string;
    headline: string;
    rating: number;
    reviewsCount: number;
    completedJobs: number;
    experienceYears: number;
    verified: boolean;
    avatarTone: string;
  } | null;
}

interface TrackDetail {
  order: {
    code: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    estimatedPrice: number;
    urgentFee: number;
    serviceFee: number;
    discount: number;
    total: number;
    couponCode: string | null;
    scheduledAt: string;
    timeSlot: string;
    city: string;
    region: string;
    addressLine: string;
    cancelReason: string | null;
  };
  service: { title: string; slug: string };
  professional: { userId: string; fullName: string } | null;
  offers: OfferItem[];
  payments: { id: number; status: string; failureReason: string | null }[];
  conversationId: number | null;
}

/** Statuses in which the order is still waiting for the customer or the system. */
const LIVE_STATUSES: OrderStatus[] = ["pending", "waiting_offers", "offers_received"];
const CONFIRMED_STATUSES: OrderStatus[] = ["confirmed", "on_the_way", "in_progress", "completed"];

/**
 * Order tracking for one booking: offers, professional selection, sandbox payment and progress.
 * Rendered on /booking/order/[id] so the page survives refreshes.
 */
export function OrderTrack({ orderId }: { orderId: number }) {
  const detail = useApi<TrackDetail>(`/orders/${orderId}`);
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const [sandboxRef, setSandboxRef] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const status = detail.data?.order.status;

  useEffect(() => {
    if (!status || !LIVE_STATUSES.includes(status)) return;
    const timer = window.setInterval(() => detail.reload(), 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (detail.loading && !detail.data) {
    return (
      <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="در حال بارگذاری سفارش">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  const d = detail.data;
  if (!d) return null;
  const o = d.order;
  const sorted = [...d.offers].sort((a, b) => a.price - b.price);
  const paid = o.paymentStatus === "paid";
  const lastPayment = d.payments[0];
  const slotLabel = TIME_SLOTS.find((t) => t.id === o.timeSlot)?.label ?? "";

  async function selectOffer(offerId: number) {
    const ok = await confirm("این متخصص انتخاب شود؟ پس از انتخاب، پیشنهادهای دیگر بسته می‌شوند.");
    if (!ok) return;
    const res = await run("select", () => apiRequest("POST", `/orders/${orderId}/select-offer`, { offerId }), "متخصص انتخاب شد");
    if (res !== undefined) detail.reload();
  }

  async function startPayment() {
    const res = await run("init", () => apiRequest<{ providerRef: string }>("POST", `/orders/${orderId}/payment/init`));
    if (res) setSandboxRef(res.providerRef);
  }

  async function verifyPayment(outcome: "success" | "failed") {
    const res = await run("verify", () => apiRequest("POST", `/orders/${orderId}/payment/verify`, { outcome }), outcome === "success" ? "پرداخت آزمایشی موفق ثبت شد" : "پرداخت ناموفق ثبت شد");
    setSandboxRef(null);
    if (res !== undefined) detail.reload();
  }

  return (
    <div className="mx-auto max-w-6xl">
      {dialog}
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            کد سفارش <span dir="ltr" className="font-semibold text-ink">{o.code}</span>
          </p>
          <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{d.service.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={o.status} />
          <PaymentBadge status={o.paymentStatus} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {LIVE_STATUSES.includes(o.status) && o.status !== "offers_received" && (
            <Card className="flex items-center gap-5 p-6 md:p-8">
              <Spinner className="size-10" />
              <div>
                <p className="text-lg font-bold">درخواست شما ثبت شد</p>
                <p className="mt-1 text-sm leading-7 text-muted">
                  درخواست برای متخصصان تأییدشده منطقه {o.city} ارسال شد. پیشنهادها در همین صفحه نمایش داده می‌شود و به‌صورت خودکار به‌روز می‌شود.
                </p>
              </div>
            </Card>
          )}

          {o.status === "offers_received" && (
            <section aria-labelledby="offers-heading" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="offers-heading" className="text-xl font-bold">
                  پیشنهادهای متخصصان ({d.offers.length})
                </h2>
                <Button variant="outline" size="sm" onClick={() => setCompare(!compare)}>
                  {compare ? "نمایش کارت‌ها" : "جدول مقایسه"}
                </Button>
              </div>
              {compare ? (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead className="bg-canvas text-xs text-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-start">متخصص</th>
                        <th scope="col" className="px-4 py-3 text-start">قیمت</th>
                        <th scope="col" className="px-4 py-3 text-start">زمان حضور</th>
                        <th scope="col" className="px-4 py-3 text-start">امتیاز</th>
                        <th scope="col" className="px-4 py-3 text-start">سابقه</th>
                        <th scope="col" className="px-4 py-3"><span className="sr-only">عملیات</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {sorted.map((offer) => (
                        <tr key={offer.id}>
                          <td className="px-4 py-3 font-semibold">{offer.professional?.fullName}{offer.isDemo && <span className="ms-2 text-xs text-sky-700">(نمایشی)</span>}</td>
                          <td className="px-4 py-3">{formatPrice(offer.price)}</td>
                          <td className="px-4 py-3">{offer.arrivalMinutes} دقیقه</td>
                          <td className="px-4 py-3">{(offer.professional?.rating ?? 0).toFixed(1)}</td>
                          <td className="px-4 py-3">{offer.professional?.experienceYears} سال</td>
                          <td className="px-4 py-3"><Button size="sm" loading={busy} onClick={() => selectOffer(offer.id)}>انتخاب</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <ul className="grid gap-4">
                  {sorted.map((offer) => (
                    <li key={offer.id}>
                      <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-bold">
                            {offer.professional?.fullName}
                            {offer.professional?.verified && <Badge tone="brand">تأیید شده</Badge>}
                            {offer.isDemo && <Badge tone="info">پیشنهاد نمایشی</Badge>}
                          </p>
                          <p className="text-sm text-muted">{offer.professional?.headline}</p>
                          <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                            <Stars value={offer.professional?.rating ?? 0} size="size-3.5" />
                            <span>{offer.professional?.completedJobs} سفارش</span>
                            <span>{offer.professional?.experienceYears} سال سابقه</span>
                          </p>
                          <p className="mt-2 text-sm leading-6">{offer.description}</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 md:w-52 md:flex-col md:items-end">
                          <div className="text-start md:text-end">
                            <p className="text-lg font-extrabold">{formatPrice(offer.price)}</p>
                            <p className="text-xs text-muted">حضور تا {offer.arrivalMinutes} دقیقه دیگر</p>
                          </div>
                          <Button onClick={() => selectOffer(offer.id)} loading={busy}>انتخاب این متخصص</Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {o.status === "professional_selected" && !paid && (
            <Card className="space-y-6 p-6 md:p-8">
              <h2 className="text-xl font-bold">تأیید سفارش و پرداخت</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">متخصص</dt><dd className="font-semibold">{d.professional?.fullName}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">مبلغ خدمت</dt><dd>{formatPrice(o.estimatedPrice)}</dd></div>
                {o.urgentFee > 0 && <div className="flex justify-between"><dt className="text-muted">هزینه فوری</dt><dd>{formatPrice(o.urgentFee)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">کارمزد خدمات</dt><dd>{formatPrice(o.serviceFee)}</dd></div>
                {o.discount > 0 && <div className="flex justify-between text-success"><dt>تخفیف {o.couponCode}</dt><dd>−{formatPrice(o.discount)}</dd></div>}
                <div className="flex justify-between border-t border-line pt-3 text-lg font-extrabold"><dt>جمع کل</dt><dd>{formatPrice(o.total)}</dd></div>
              </dl>
              {lastPayment?.status === "failed" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">پرداخت قبلی ناموفق بود. می‌توانید دوباره تلاش کنید.</p>}
              {sandboxRef ? (
                <div className="animate-fade-up space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-5">
                  <p className="font-bold text-amber-900">درگاه پرداخت آزمایشی (Sandbox)</p>
                  <p className="text-sm leading-7 text-amber-900/80">
                    این یک شبیه‌ساز است و هیچ پرداخت واقعی انجام نمی‌شود. کد مرجع: <span dir="ltr" className="font-mono">{sandboxRef}</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button loading={busy} onClick={() => verifyPayment("success")}>شبیه‌سازی: پرداخت موفق</Button>
                    <Button variant="danger" loading={busy} onClick={() => verifyPayment("failed")}>شبیه‌سازی: پرداخت ناموفق</Button>
                  </div>
                </div>
              ) : (
                <Button size="lg" loading={busy} onClick={startPayment}>تأیید خلاصه و پرداخت آزمایشی {formatPrice(o.total)}</Button>
              )}
            </Card>
          )}

          {CONFIRMED_STATUSES.includes(o.status) && (
            <Card className="space-y-5 p-6 md:p-8">
              <h2 className="text-xl font-bold">
                {o.status === "completed" ? "خدمت انجام شد" : "سفارش شما تأیید شد"}
              </h2>
              <p className="leading-7 text-muted">
                پرداخت با موفقیت ثبت شد و متخصص <span className="font-semibold text-ink">{d.professional?.fullName}</span> برای قرار {formatDate(o.scheduledAt)} ({slotLabel}) در نظر گرفته شده است.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href={`/account/orders/${orderId}`} icon={<LayoutDashboard className="size-4" aria-hidden="true" />}>پیگیری در داشبورد</Button>
                {d.conversationId && <Button href={`/account/messages/${orderId}`} variant="outline" icon={<MessageCircle className="size-4" aria-hidden="true" />}>گفتگو با متخصص</Button>}
                <Button href={`/account/orders/${orderId}/invoice`} variant="ghost" icon={<FileText className="size-4" aria-hidden="true" />}>صورت‌حساب</Button>
              </div>
            </Card>
          )}

          {o.status === "cancelled" && (
            <Card className="space-y-3 p-6">
              <p className="font-semibold text-danger">این سفارش لغو شده است.</p>
              {o.cancelReason && <p className="text-sm text-muted">دلیل: {o.cancelReason}</p>}
              <Button href="/categories" variant="outline">مشاهده خدمات دیگر</Button>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-5 font-bold">مراحل سفارش</h2>
            <OrderTimeline status={o.status} />
          </Card>
          <Card className="space-y-3 p-6 text-sm">
            <h2 className="font-bold">جزئیات قرار</h2>
            <p className="text-muted">زمان: <span className="text-ink">{formatDate(o.scheduledAt)} · {slotLabel}</span></p>
            <p className="text-muted">نشانی: <span className="text-ink">{o.city}، {o.region}، {o.addressLine}</span></p>
            <p className="text-muted">مبلغ کل: <span className="font-semibold text-ink">{formatPrice(o.total)}</span></p>
            <Link href="/account/orders" className="inline-block pt-2 text-sm font-semibold text-brand hover:underline">همه سفارش‌های من</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
