import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, staticPages } from "@/db/schema";

/** Published blog posts, newest first. Drafts are never returned to public routes. */
export async function listPublishedPosts() {
  return db.select().from(blogPosts).where(eq(blogPosts.isPublished, true)).orderBy(desc(blogPosts.createdAt));
}

export async function getPublishedPost(slug: string) {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)))
    .limit(1);
  return row ?? null;
}

export async function getPublishedPage(slug: string) {
  const [row] = await db
    .select()
    .from(staticPages)
    .where(and(eq(staticPages.slug, slug), eq(staticPages.isPublished, true)))
    .limit(1);
  return row ?? null;
}

/** Splits free-form admin text into paragraphs (blank lines separate paragraphs). */
export function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
