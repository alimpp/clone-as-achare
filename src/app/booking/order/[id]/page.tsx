import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OrderTrack } from "@/components/booking/OrderTrack";

export const metadata: Metadata = { title: "پیگیری سفارش", robots: { index: false, follow: false } };

/** Order confirmation and tracking after a booking is submitted. Refresh-safe. */
export default async function BookingOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect(`/login?next=/booking/order/${id}`);
  if (user.role !== "customer") redirect(user.role === "admin" ? "/admin" : "/pro");
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <OrderTrack orderId={Number(id)} />
    </main>
  );
}
