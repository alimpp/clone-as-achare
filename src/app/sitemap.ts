import type { MetadataRoute } from "next";
import { getActiveCategorySlugs, getAllServiceSlugs } from "@/lib/catalog";
import { listPublishedPosts } from "@/lib/content";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, services, posts] = await Promise.all([getActiveCategorySlugs(), getAllServiceSlugs(), listPublishedPosts()]);
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/become-a-pro`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    ...categories.map((slug) => ({ url: `${SITE_URL}/categories/${slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...services.map((slug) => ({ url: `${SITE_URL}/services/${slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
