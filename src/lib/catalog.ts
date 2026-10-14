// Cached catalog reads. Prisma Decimals are converted to plain numbers so results serialize.
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type ProductCard = {
  id: number;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  image: string | null;
  categoryId: number;
  hasVariants: boolean; // must be bought from the product page (variant picker)
};

export type CategoryItem = {
  id: number;
  name: string;
  nameBn: string | null;
  slug: string;
  icon: string | null;
  image: string | null;
  parentId: number | null;
  productCount: number;
};

export type ProductDetail = ProductCard & {
  description: string | null;
  descriptionBn: string | null;
  metaTitle: string | null;
  metaDesc: string | null;
  images: string[];
  stock: number;
  sku: string | null;
  warranty: string | null;
  brand: string | null;
  category: { name: string; slug: string };
  variants: { id: number; name: string; price: number | null; stock: number }[];
};

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  salePrice: true,
  categoryId: true,
  images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  _count: { select: { variants: { where: { isActive: true } } } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

const toCard = (p: CardRow): ProductCard => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  price: Number(p.price),
  salePrice: p.salePrice === null ? null : Number(p.salePrice),
  image: p.images[0]?.url ?? null,
  categoryId: p.categoryId,
  hasVariants: p._count.variants > 0,
});

export async function getCategories(): Promise<CategoryItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    nameBn: c.nameBn,
    slug: c.slug,
    icon: c.icon,
    image: c.image,
    parentId: c.parentId,
    productCount: c._count.products,
  }));
}

export async function getFeaturedProducts(): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const rows = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export async function getLatestProducts(take = 15): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export const CATEGORY_PAGE_SIZE = 24;

export type CategoryListingInput = {
  slug: string; // "all" or a category slug
  q?: string;
  categoryIds?: number[]; // only used on "all"
  min?: number;
  max?: number;
  sort?: CategorySort;
  page?: number;
};

export const CATEGORY_SORTS = ["default", "new", "price_asc", "price_desc"] as const;
export type CategorySort = (typeof CATEGORY_SORTS)[number];

const categoryOrder: Record<CategorySort, Prisma.ProductOrderByWithRelationInput[]> = {
  default: [{ id: "asc" }],
  new: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ effectivePrice: "asc" }, { id: "asc" }],
  price_desc: [{ effectivePrice: "desc" }, { id: "asc" }],
};

/** One page of a category (or all products) with the sidebar filters applied in the database. */
export async function getCategoryListing(input: CategoryListingInput) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const base: Prisma.ProductWhereInput = { isActive: true };
  if (input.slug !== "all") base.category = { slug: input.slug };
  if (input.q) base.name = { contains: input.q };
  if (input.min !== undefined || input.max !== undefined) {
    // effectivePrice = what the customer pays (sale price when there is one)
    base.effectivePrice = { ...(input.min !== undefined ? { gte: input.min } : {}), ...(input.max !== undefined ? { lte: input.max } : {}) };
  }
  const where: Prisma.ProductWhereInput =
    input.slug === "all" && input.categoryIds?.length ? { ...base, categoryId: { in: input.categoryIds } } : base;

  const [total, grouped] = await Promise.all([
    prisma.product.count({ where }),
    // per-category counts for the sidebar ignore the category checkboxes themselves
    prisma.product.groupBy({ by: ["categoryId"], where: base, _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, input.page ?? 1), pages);
  const rows = await prisma.product.findMany({
    where,
    orderBy: categoryOrder[input.sort ?? "default"],
    skip: (page - 1) * CATEGORY_PAGE_SIZE,
    take: CATEGORY_PAGE_SIZE,
    select: cardSelect,
  });

  return {
    products: rows.map(toCard),
    total,
    page,
    pages,
    categoryCounts: Object.fromEntries(grouped.map((g) => [g.categoryId, g._count._all])) as Record<number, number>,
  };
}

export async function searchProducts(query: string, take = 40): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: q } },
        { nameBn: { contains: q } },
        { brand: { name: { contains: q } } },
        { category: { name: { contains: q } } },
      ],
    },
    take,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const p = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: { id: "asc" } },
      brand: true,
      category: true,
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    salePrice: p.salePrice === null ? null : Number(p.salePrice),
    image: p.images[0]?.url ?? null,
    categoryId: p.categoryId,
    hasVariants: p.variants.length > 0,
    description: p.description,
    descriptionBn: p.descriptionBn,
    metaTitle: p.metaTitle,
    metaDesc: p.metaDesc,
    images: p.images.map((i) => i.url),
    stock: p.stock,
    sku: p.sku,
    warranty: p.warranty,
    brand: p.brand?.name ?? null,
    category: { name: p.category.name, slug: p.category.slug },
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price === null ? null : Number(v.price),
      stock: v.stock,
    })),
  };
}

export async function getRelatedProducts(categoryId: number, excludeId: number): Promise<ProductCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const rows = await prisma.product.findMany({
    where: { isActive: true, categoryId, id: { not: excludeId } },
    take: 10,
    select: cardSelect,
  });
  return rows.map(toCard);
}
