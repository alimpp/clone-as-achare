import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServiceDetail } from "@/lib/catalog";
import { listAddresses } from "@/lib/account";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const metadata: Metadata = { title: "ثبت سفارش", robots: { index: false } };

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect(`/login?next=/booking/${slug}`);
  if (user.role !== "customer") redirect(user.role === "admin" ? "/admin" : "/pro");
  const detail = await getServiceDetail(slug);
  if (!detail) notFound();
  const addresses = await listAddresses(user.id);
  const s = detail.service;
  return (
    <BookingWizard
      service={{ slug: s.slug, title: s.title, categoryName: detail.category.name, basePrice: s.basePrice, durationMinutes: s.durationMinutes, questions: s.questions }}
      addresses={addresses.map((a) => ({ id: a.id, title: a.title, city: a.city, region: a.region, addressLine: a.addressLine, details: a.details, isDefault: a.isDefault }))}
      phoneVerified={user.phoneVerified}
    />
  );
}
