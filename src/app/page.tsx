import type { Metadata } from "next";
import { HomeView } from "@/components/home/Home";
import { getHomeData } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "خدمات منزل با متخصصان تأییدشده",
  description: "رزرو آنلاین خدمات منزل؛ نظافت، لوله‌کشی، برق، تعمیر لوازم خانگی، نقاشی و اسباب‌کشی با پیشنهاد قیمت شفاف.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const data = await getHomeData();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "آرنا",
    description: "بازار تخصصی خدمات منزل",
    areaServed: ["تهران", "کرج", "مشهد", "اصفهان", "شیراز", "تبریز"],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeView data={data} />
    </>
  );
}
