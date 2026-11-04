import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCustomerOrderDetail } from "@/lib/orders";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { formatDateTime, formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, TIME_SLOTS, faNum } from "@/lib/domain";

export const metadata: Metadata = { title: "صورت‌حساب سفارش", robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect(`/login?next=/account/orders/${id}/invoice`);
  if (user.role !== "customer") redirect(user.role === "admin" ? "/admin" : "/pro");

  let detail: Awaited<ReturnType<typeof getCustomerOrderDetail>>;
  try {
    detail = await getCustomerOrderDetail(user.id, orderId);
  } catch {
    notFound();
  }
  const o = detail.order;
  const slot = TIME_SLOTS.find((t) => t.id === o.timeSlot)?.label ?? "";
  const issued = o.paymentStatus === "paid" || o.paymentStatus === "refunded";

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/account/orders/${orderId}`} className="text-sm font-semibold text-brand hover:underline">
          ← بازگشت به سفارش
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-2xl font-extrabold text-brand">آرنا</p>
            <p className="mt-1 text-sm text-muted">بازار تخصصی خدمات منزل</p>
          </div>
          <div className="text-start text-sm">
            <p className="text-lg font-bold">صورت‌حساب خدمت</p>
            <p className="mt-1 text-muted">شماره سفارش: <span dir="ltr" className="font-semibold text-ink">{o.code}</span></p>
            <p className="text-muted">تاریخ ثبت: {formatDateTime(o.createdAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted">خدمت</p>
            <p className="mt-1 font-semibold">{detail.service.title}</p>
          </div>
          <div>
            <p className="text-muted">متخصص</p>
            <p className="mt-1 font-semibold">{detail.professional?.fullName ?? "در انتظار انتخاب"}</p>
          </div>
          <div>
            <p className="text-muted">زمان قرار</p>
            <p className="mt-1 font-semibold">{formatDateTime(o.scheduledAt)} ({slot})</p>
          </div>
          <div>
            <p className="text-muted">نشانی</p>
            <p className="mt-1 font-semibold">{o.city}، {o.region}، {o.addressLine}</p>
          </div>
          <div>
            <p className="text-muted">وضعیت سفارش</p>
            <p className="mt-1 font-semibold">{ORDER_STATUS_LABELS[o.status]}</p>
          </div>
          <div>
            <p className="text-muted">وضعیت پرداخت</p>
            <p className="mt-1 font-semibold">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</p>
          </div>
        </section>

        <table className="w-full text-sm">
          <caption className="sr-only">ریز هزینه‌های سفارش</caption>
          <thead className="border-y border-line bg-canvas text-xs text-muted print:bg-transparent">
            <tr>
              <th scope="col" className="px-3 py-3 text-start font-medium">شرح</th>
              <th scope="col" className="px-3 py-3 text-end font-medium">مبلغ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr><td className="px-3 py-3">مبلغ خدمت (پیشنهاد متخصص)</td><td className="px-3 py-3 text-end">{formatPrice(o.estimatedPrice)}</td></tr>
            <tr><td className="px-3 py-3">هزینه فوری</td><td className="px-3 py-3 text-end">{o.urgentFee ? formatPrice(o.urgentFee) : "—"}</td></tr>
            <tr><td className="px-3 py-3">کارمزد خدمات</td><td className="px-3 py-3 text-end">{formatPrice(o.serviceFee)}</td></tr>
            <tr><td className="px-3 py-3">تخفیف{o.couponCode ? ` (${o.couponCode})` : ""}</td><td className="px-3 py-3 text-end text-success">{o.discount ? `−${formatPrice(o.discount)}` : "—"}</td></tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line text-base font-extrabold">
              <th scope="row" className="px-3 py-4 text-start">جمع کل</th>
              <td className="px-3 py-4 text-end">{formatPrice(o.total)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="mt-8 space-y-2 text-sm">
          <h2 className="font-bold">پرداخت‌ها</h2>
          {detail.payments.length === 0 ? (
            <p className="text-muted">پرداختی برای این سفارش ثبت نشده است.</p>
          ) : (
            <ul className="space-y-1">
              {detail.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 text-muted">
                  <span dir="ltr">{p.providerRef}</span>
                  <span>{formatDateTime(p.createdAt)} · {PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS] ?? p.status} · {formatPrice(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-10 space-y-2 border-t border-line pt-6 text-xs leading-6 text-muted">
          <p>
            {issued
              ? "این صورت‌حساب برای سفارش پرداخت‌شده صادر شده است."
              : "این صورت‌حساب پیش‌نویس است و تا تأیید پرداخت معتبر نیست."}
          </p>
          <p>پرداخت‌ها در محیط آزمایشی (Sandbox) انجام می‌شوند و هیچ مبلغ واقعی جابه‌جا نمی‌شود. شماره‌های مرجع: {faNum(detail.payments.length)} پرداخت.</p>
        </footer>
      </article>
    </main>
  );
}
