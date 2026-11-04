import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Card, EmptyState, SectionTitle } from "@/components/ui";
import { listPublishedPosts } from "@/lib/content";
import { formatDate } from "@/lib/domain";

export const metadata: Metadata = {
  title: "وبلاگ آرنا",
  description: "راهنمای انتخاب متخصص، نگهداری لوازم خانگی و نکات خدمات منزل.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await listPublishedPosts();
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "خانه", href: "/" }, { name: "وبلاگ", href: "/blog" }]} />
      <div className="mt-6">
        <SectionTitle eyebrow="وبلاگ" title="راهنمای خدمات منزل" description="نکات عملی برای انتخاب متخصص و نگهداری از منزل." />
      </div>
      {posts.length === 0 ? (
        <div className="mt-10"><EmptyState icon="file" title="هنوز مقاله‌ای منتشر نشده است" /></div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="group block">
              <Card interactive className="h-full p-6">
                <p className="text-xs text-muted">{formatDate(p.createdAt)}</p>
                <h2 className="mt-2 text-lg font-bold transition group-hover:text-brand">{p.title}</h2>
                <p className="mt-3 leading-7 text-muted">{p.excerpt}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
