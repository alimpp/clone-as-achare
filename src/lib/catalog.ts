import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { banners, categories, faqs, professionalProfiles, reviews, services, users } from "@/db/schema";
import { SYNONYMS, normalizeFa, type FaqItem, type ProVerificationStatus, type FormQuestion } from "./domain";
import { ensureSeeded } from "./seed";

export type CategoryRow = typeof categories.$inferSelect;
export type ServiceRow = typeof services.$inferSelect;

export interface ServiceCard {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  basePrice: number;
  durationMinutes: number;
  rating: number;
  reviewsCount: number;
  tone: string;
  isPopular: boolean;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  parentName: string;
  parentSlug: string;
  iconKey: string;
  keywords: string[];
}

export interface ProSummary {
  userId: string;
  fullName: string;
  headline: string;
  rating: number;
  reviewsCount: number;
  completedJobs: number;
  experienceYears: number;
  verificationStatus: ProVerificationStatus;
  avatarTone: string;
  avatarUrl: string | null;
  serviceAreas: string[];
  categoryIds: number[];
  skills: string[];
  pricing: { minPrice: number; hourlyRate: number; visitFee: number };
  isAvailable: boolean;
}

export interface ReviewView {
  id: number;
  rating: number;
  comment: string;
  authorName: string;
  reply: string | null;
  createdAt: Date;
  serviceTitle: string;
  proName: string | null;
  categoryName: string;
}

export interface CategoryNode extends CategoryRow {
  children: CategoryRow[];
  serviceCount: number;
}

// ---------- Loaders ----------

async function loadAllCategories(): Promise<CategoryRow[]> {
  return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder, categories.id);
}

async function loadServiceCards(where?: ReturnType<typeof eq>): Promise<{ cards: ServiceCard[]; cats: Map<number, CategoryRow> }> {
  await ensureSeeded();
  const cats = await loadAllCategories();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const rows = await db
    .select({ service: services })
    .from(services)
    .where(where ? and(eq(services.isActive, true), where) : eq(services.isActive, true));

  const cards = rows
    .map(({ service }) => toCard(service, catMap))
    .filter((c): c is ServiceCard => c !== null);
  return { cards, cats: catMap };
}

function toCard(service: ServiceRow, catMap: Map<number, CategoryRow>): ServiceCard | null {
  const leaf = catMap.get(service.categoryId);
  if (!leaf) return null;
  const parent = leaf.parentId != null ? catMap.get(leaf.parentId) : undefined;
  const top = parent ?? leaf;
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    shortDescription: service.shortDescription,
    basePrice: service.basePrice,
    durationMinutes: service.durationMinutes,
    rating: service.rating,
    reviewsCount: service.reviewsCount,
    tone: service.tone,
    isPopular: service.isPopular,
    categoryId: leaf.id,
    categoryName: leaf.name,
    categorySlug: leaf.slug,
    parentName: top.name,
    parentSlug: top.slug,
    iconKey: top.iconKey,
    keywords: service.keywords,
  };
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  await ensureSeeded();
  const cats = await loadAllCategories();
  const { cards } = await loadServiceCards();
  const countByLeaf = new Map<number, number>();
  for (const c of cards) countByLeaf.set(c.categoryId, (countByLeaf.get(c.categoryId) ?? 0) + 1);

  return cats
    .filter((c) => c.parentId == null)
    .map((parent) => {
      const children = cats.filter((c) => c.parentId === parent.id);
      const serviceCount = children.reduce((sum, child) => sum + (countByLeaf.get(child.id) ?? 0), 0);
      return { ...parent, children, serviceCount };
    });
}

export async function getCategoryBySlug(slug: string): Promise<{
  category: CategoryRow;
  parent: CategoryRow | null;
  children: CategoryRow[];
  breadcrumbs: { name: string; href: string }[];
} | null> {
  await ensureSeeded();
  const cats = await loadAllCategories();
  const category = cats.find((c) => c.slug === slug);
  if (!category) return null;
  const parent = category.parentId != null ? (cats.find((c) => c.id === category.parentId) ?? null) : null;
  const children = cats.filter((c) => c.parentId === category.id);
  const breadcrumbs = [
    { name: "خدمات", href: "/categories" },
    ...(parent ? [{ name: parent.name, href: `/categories/${parent.slug}` }] : []),
    { name: category.name, href: `/categories/${category.slug}` },
  ];
  return { category, parent, children, breadcrumbs };
}

export type ServiceSort = "relevance" | "rating" | "popular" | "price_asc" | "price_desc";

export interface ServiceFilters {
  q?: string;
  sort?: ServiceSort;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Lists services in a category and all of its child categories.
 * Filters are applied in memory: the catalog is small and this keeps the logic transparent.
 */
export async function getServicesInCategory(category: CategoryRow, children: CategoryRow[], filters: ServiceFilters = {}): Promise<ServiceCard[]> {
  const leafIds = children.length ? children.map((c) => c.id) : [category.id];
  const { cards } = await loadServiceCards(inArray(services.categoryId, leafIds));
  const scoped = cards.filter((c) => leafIds.includes(c.categoryId) || c.parentSlug === category.slug);
  return applyFilters(scoped, filters, filters.q ?? "");
}

function applyFilters(cards: ServiceCard[], filters: ServiceFilters, q: string): ServiceCard[] {
  let list = cards.filter((c) => {
    if (filters.minPrice != null && c.basePrice < filters.minPrice) return false;
    if (filters.maxPrice != null && c.basePrice > filters.maxPrice) return false;
    return true;
  });

  const scored = q ? list.map((c) => ({ c, score: scoreCard(c, q) })).filter((x) => x.score > 0) : list.map((c) => ({ c, score: 0 }));

  const sort = filters.sort ?? (q ? "relevance" : "popular");
  scored.sort((a, b) => {
    switch (sort) {
      case "rating":
        return b.c.rating - a.c.rating || b.c.reviewsCount - a.c.reviewsCount;
      case "price_asc":
        return a.c.basePrice - b.c.basePrice;
      case "price_desc":
        return b.c.basePrice - a.c.basePrice;
      case "relevance":
        return b.score - a.score || b.c.rating - a.c.rating;
      default:
        return Number(b.c.isPopular) - Number(a.c.isPopular) || b.c.reviewsCount - a.c.reviewsCount;
    }
  });
  list = scored.map((x) => x.c);
  return list;
}

/** Expands a normalised term with its synonym group members. */
function expandTerm(term: string): string[] {
  const out = new Set<string>([term]);
  for (const group of SYNONYMS) {
    const norm = group.map((g) => normalizeFa(g));
    const matches = norm.some((g) => (term.length >= 2 && g.includes(term)) || (g.length >= 2 && term.includes(g)));
    if (matches) norm.forEach((g) => out.add(g));
  }
  return [...out];
}

/** Weighted relevance score for a service card against a free-text query. */
export function scoreCard(card: ServiceCard, query: string): number {
  const terms = normalizeFa(query).split(" ").filter(Boolean);
  if (!terms.length) return 0;
  const title = normalizeFa(card.title);
  const desc = normalizeFa(`${card.shortDescription}`);
  const kws = card.keywords.map((k) => normalizeFa(k));
  const cat = normalizeFa(`${card.categoryName} ${card.parentName}`);
  const fullQuery = normalizeFa(query);

  let score = 0;
  if (title === fullQuery) score += 100;
  if (title.includes(fullQuery)) score += 60;

  for (const term of terms) {
    const expansions = expandTerm(term);
    const direct = title.includes(term) ? 30 : 0;
    const kw = kws.some((k) => k.includes(term)) ? 20 : 0;
    const category = cat.includes(term) ? 15 : 0;
    const description = desc.includes(term) ? 8 : 0;
    const synonym = expansions.some((e) => e !== term && (title.includes(e) || kws.some((k) => k.includes(e)) || cat.includes(e))) ? 12 : 0;
    const termScore = direct + kw + category + description + synonym;
    if (termScore === 0) return 0; // every term must match something
    score += termScore;
  }
  return score;
}

export async function searchServices(q: string, filters: ServiceFilters = {}): Promise<{
  services: ServiceCard[];
  categories: CategoryRow[];
  total: number;
}> {
  const { cards, cats } = await loadServiceCards();
  const results = applyFilters(cards, filters, normalizeFa(q));
  const catMatches = q
    ? [...cats.values()].filter((c) => {
        const name = normalizeFa(c.name);
        return normalizeFa(q)
          .split(" ")
          .some((t) => t.length >= 2 && (name.includes(t) || expandTerm(t).some((e) => name.includes(e))));
      })
    : [];
  return { services: results, categories: catMatches.slice(0, 6), total: results.length };
}

export async function suggestSearch(q: string): Promise<{
  services: { title: string; slug: string; categoryName: string; basePrice: number }[];
  categories: { name: string; slug: string }[];
}> {
  const term = normalizeFa(q);
  if (term.length < 2) return { services: [], categories: [] };
  const { services: list, categories: catList } = await searchServices(q);
  return {
    services: list.slice(0, 6).map((s) => ({ title: s.title, slug: s.slug, categoryName: s.categoryName, basePrice: s.basePrice })),
    categories: catList.slice(0, 3).map((c) => ({ name: c.name, slug: c.slug })),
  };
}

export async function getServiceDetail(slug: string): Promise<{
  service: ServiceRow;
  category: CategoryRow;
  parent: CategoryRow | null;
  card: ServiceCard;
  breadcrumbs: { name: string; href: string }[];
  related: ServiceCard[];
  pros: ProSummary[];
  reviews: ReviewView[];
  questions: FormQuestion[];
  faqs: FaqItem[];
} | null> {
  await ensureSeeded();
  const [row] = await db.select().from(services).where(and(eq(services.slug, slug), eq(services.isActive, true))).limit(1);
  if (!row) return null;
  const cats = await loadAllCategories();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const category = catMap.get(row.categoryId);
  if (!category) return null;
  const parent = category.parentId != null ? (catMap.get(category.parentId) ?? null) : null;
  const card = toCard(row, catMap)!;

  const { cards } = await loadServiceCards();
  const related = cards
    .filter((c) => c.slug !== row.slug)
    .map((c) => ({ c, s: (c.categoryId === row.categoryId ? 3 : c.parentSlug === card.parentSlug ? 2 : 0) + (c.isPopular ? 1 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.rating - a.c.rating)
    .slice(0, 4)
    .map((x) => x.c);

  const pros = await getProsForCategory(category.id, 4);
  const reviewRows = await getReviewsForService(row.id, 6);

  const breadcrumbs = [
    { name: "خدمات", href: "/categories" },
    ...(parent ? [{ name: parent.name, href: `/categories/${parent.slug}` }] : []),
    { name: category.name, href: `/categories/${category.slug}` },
    { name: row.title, href: `/services/${row.slug}` },
  ];

  return {
    service: row,
    category,
    parent,
    card,
    breadcrumbs,
    related,
    pros,
    reviews: reviewRows,
    questions: row.questions,
    faqs: row.faqs,
  };
}

export async function getServiceBySlugOrNull(slug: string): Promise<ServiceRow | null> {
  await ensureSeeded();
  const [row] = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  return row ?? null;
}

/** Verified professionals whose profile includes the given leaf category. */
export async function getProsForCategory(categoryId: number, limit = 10, city?: string): Promise<ProSummary[]> {
  const rows = await db
    .select({ profile: professionalProfiles, user: users })
    .from(professionalProfiles)
    .innerJoin(users, eq(professionalProfiles.userId, users.id))
    .where(and(eq(professionalProfiles.verificationStatus, "verified"), eq(users.status, "active")))
    .orderBy(desc(professionalProfiles.rating), desc(professionalProfiles.reviewsCount));

  return rows
    .filter(({ profile }) => profile.categoryIds.includes(categoryId))
    .filter(({ profile }) => (city ? profile.serviceAreas.includes(city) : true))
    .slice(0, limit)
    .map(({ profile, user }) => toProSummary(profile, user));
}

/** Verified, active professionals offering any of the given categories (leaf category ids). */
export async function getProsForCategories(categoryIds: number[], limit = 10, city?: string): Promise<ProSummary[]> {
  const wanted = new Set(categoryIds);
  const rows = await db
    .select({ profile: professionalProfiles, user: users })
    .from(professionalProfiles)
    .innerJoin(users, eq(professionalProfiles.userId, users.id))
    .where(and(eq(professionalProfiles.verificationStatus, "verified"), eq(users.status, "active")))
    .orderBy(desc(professionalProfiles.rating), desc(professionalProfiles.reviewsCount));
  return rows
    .filter(({ profile }) => profile.categoryIds.some((id) => wanted.has(id)))
    .filter(({ profile }) => (city ? profile.serviceAreas.includes(city) : true))
    .slice(0, limit)
    .map(({ profile, user }) => toProSummary(profile, user));
}

export function toProSummary(
  profile: typeof professionalProfiles.$inferSelect,
  user: typeof users.$inferSelect,
): ProSummary {
  return {
    userId: user.id,
    fullName: user.fullName,
    headline: profile.headline,
    rating: profile.rating,
    reviewsCount: profile.reviewsCount,
    completedJobs: profile.completedJobs,
    experienceYears: profile.experienceYears,
    verificationStatus: profile.verificationStatus,
    avatarTone: profile.avatarTone,
    avatarUrl: user.avatarUrl,
    serviceAreas: profile.serviceAreas,
    categoryIds: profile.categoryIds,
    skills: profile.skills,
    pricing: profile.pricing,
    isAvailable: profile.isAvailable,
  };
}

export async function getReviewsForService(serviceId: number, limit = 10): Promise<ReviewView[]> {
  const rows = await db
    .select({ review: reviews, pro: users, service: services, category: categories })
    .from(reviews)
    .innerJoin(services, eq(reviews.serviceId, services.id))
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .leftJoin(users, eq(reviews.professionalId, users.id))
    .where(and(eq(reviews.serviceId, serviceId), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
  return rows.map(toReviewView);
}

export function toReviewView(row: {
  review: typeof reviews.$inferSelect;
  pro: typeof users.$inferSelect | null;
  service: typeof services.$inferSelect;
  category: typeof categories.$inferSelect;
}): ReviewView {
  return {
    id: row.review.id,
    rating: row.review.rating,
    comment: row.review.comment,
    authorName: row.review.authorName,
    reply: row.review.reply,
    createdAt: row.review.createdAt,
    serviceTitle: row.service.title,
    proName: row.pro?.fullName ?? null,
    categoryName: row.category.name,
  };
}

export interface HomeData {
  parents: CategoryNode[];
  popular: ServiceCard[];
  pros: ProSummary[];
  reviews: ReviewView[];
  banners: (typeof banners.$inferSelect)[];
  faqs: (typeof faqs.$inferSelect)[];
  stats: { services: number; categories: number; pros: number; reviews: number };
}

export async function getHomeData(): Promise<HomeData> {
  await ensureSeeded();
  const [tree, { cards }] = await Promise.all([getCategoryTree(), loadServiceCards()]);
  const popular = [...cards].sort((a, b) => Number(b.isPopular) - Number(a.isPopular) || b.reviewsCount - a.reviewsCount).slice(0, 6);

  const proRows = await db
    .select({ profile: professionalProfiles, user: users })
    .from(professionalProfiles)
    .innerJoin(users, eq(professionalProfiles.userId, users.id))
    .where(eq(professionalProfiles.verificationStatus, "verified"))
    .orderBy(desc(professionalProfiles.rating), desc(professionalProfiles.completedJobs))
    .limit(4);

  const reviewRows = await db
    .select({ review: reviews, pro: users, service: services, category: categories })
    .from(reviews)
    .innerJoin(services, eq(reviews.serviceId, services.id))
    .innerJoin(categories, eq(services.categoryId, categories.id))
    .leftJoin(users, eq(reviews.professionalId, users.id))
    .where(eq(reviews.status, "published"))
    .orderBy(desc(reviews.createdAt))
    .limit(6);

  const bannerRows = await db.select().from(banners).where(eq(banners.isActive, true)).orderBy(banners.sortOrder);
  const faqRows = await db.select().from(faqs).where(and(eq(faqs.isActive, true), eq(faqs.scope, "home"))).orderBy(faqs.sortOrder);

  const [proCount] = await db.select({ id: users.id }).from(users).where(eq(users.role, "professional"));
  void proCount;
  const proTotal = (await db.select({ id: professionalProfiles.userId }).from(professionalProfiles).where(eq(professionalProfiles.verificationStatus, "verified"))).length;
  const reviewTotal = (await db.select({ id: reviews.id }).from(reviews)).length;

  return {
    parents: tree,
    popular,
    pros: proRows.map(({ profile, user }) => toProSummary(profile, user)),
    reviews: reviewRows.map(toReviewView),
    banners: bannerRows,
    faqs: faqRows,
    stats: {
      services: cards.length,
      categories: tree.reduce((sum, p) => sum + p.children.length, 0),
      pros: proTotal,
      reviews: reviewTotal,
    },
  };
}

export async function getAllServiceSlugs(): Promise<string[]> {
  await ensureSeeded();
  const rows = await db.select({ slug: services.slug }).from(services).where(eq(services.isActive, true));
  return rows.map((r) => r.slug);
}

export async function getActiveCategorySlugs(): Promise<string[]> {
  await ensureSeeded();
  return (await loadAllCategories()).map((c) => c.slug);
}
