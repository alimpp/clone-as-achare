import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { getPublishedPage, toParagraphs } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return { title: "صفحه یافت نشد" };
  return { title: page.title, description: toParagraphs(page.body)[0]?.slice(0, 160) ?? page.title, alternates: { canonical: `/pages/${slug}` } };
}

/** Static content pages (about, terms, etc.) managed from the admin content section. */
export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "خانه", href: "/" }, { name: page.title, href: `/pages/${page.slug}` }]} />
      <h1 className="mt-6 text-3xl font-extrabold md:text-4xl">{page.title}</h1>
      <div className="mt-8 space-y-5 leading-8 text-ink/90">
        {toParagraphs(page.body).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </main>
  );
}
