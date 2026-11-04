import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, Button } from "@/components/ui";
import { getPublishedPost, toParagraphs } from "@/lib/content";
import { formatDate } from "@/lib/domain";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "مقاله یافت نشد" };
  return {
    title: post.title,
    description: post.excerpt || post.title,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Breadcrumbs items={[{ name: "خانه", href: "/" }, { name: "وبلاگ", href: "/blog" }, { name: post.title, href: `/blog/${post.slug}` }]} />
      <article className="mt-6">
        <p className="text-sm text-muted">{formatDate(post.createdAt)}</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg leading-8 text-muted">{post.excerpt}</p>}
        <div className="mt-8 space-y-5 leading-8 text-ink/90">
          {toParagraphs(post.body).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-12 rounded-2xl bg-mint/30 p-6">
          <p className="font-bold">آماده دریافت خدمت هستید؟</p>
          <p className="mt-1 text-sm text-muted">متخصصان تأییدشده آرنا را مقایسه کنید.</p>
          <div className="mt-4"><Button href="/categories" size="sm">مشاهده خدمات</Button></div>
        </div>
      </article>
    </main>
  );
}
