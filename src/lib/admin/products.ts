// Admin catalog reads (always fresh).
import { connection } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PAGE_SIZE = 20;

export type ProductListFilters = {
  q?: string;
  category?: number;
  status?: "active" | "hidden" | "low" | "featured";
  page?: number;
};

export async function listProducts(filters: ProductListFilters) {
  await connection();
  const where: Prisma.ProductWhereInput = {};
  if (filters.q) {
    where.OR = [{ name: { contains: filters.q } }, { nameBn: { contains: filters.q } }, { sku: { contains: filters.q } }];
  }
  if (filters.category) where.categoryId = filters.category;
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "hidden") where.isActive = false;
  if (filters.status === "featured") where.isFeatured = true;
  if (filters.status === "low") where.stock = { lte: prisma.product.fields.lowStockAt };

  const page = Math.max(1, filters.page ?? 1);
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        _count: { select: { variants: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category: p.category.name,
      price: Number(p.price),
      salePrice: p.salePrice === null ? null : Number(p.salePrice),
      stock: p.stock,
      lowStockAt: p.lowStockAt,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      image: p.images[0]?.url ?? null,
      variants: p._count.variants,
    })),
  };
}

export async function getCategoryOptions() {
  await connection();
  return prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
}

export async function getBrandOptions() {
  await connection();
  return prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export type ProductFormValues = {
  id?: number;
  name: string;
  nameBn: string;
  slug: string;
  categoryId: number | "";
  brandId: number | "";
  price: string;
  salePrice: string;
  stock: string;
  lowStockAt: string;
  sku: string;
  warranty: string;
  description: string;
  descriptionBn: string;
  metaTitle: string;
  metaDesc: string;
  isActive: boolean;
  isFeatured: boolean;
  images: string[];
  variants: { id?: number; name: string; sku: string; price: string; stock: string; isActive: boolean }[];
};

export async function getProductForEdit(id: number): Promise<ProductFormValues | null> {
  await connection();
  const p = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { id: "asc" } } },
  });
  if (!p) return null;
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    id: p.id,
    name: p.name,
    nameBn: s(p.nameBn),
    slug: p.slug,
    categoryId: p.categoryId,
    brandId: p.brandId ?? "",
    price: s(Number(p.price)),
    salePrice: p.salePrice === null ? "" : s(Number(p.salePrice)),
    stock: s(p.stock),
    lowStockAt: s(p.lowStockAt),
    sku: s(p.sku),
    warranty: s(p.warranty),
    description: s(p.description),
    descriptionBn: s(p.descriptionBn),
    metaTitle: s(p.metaTitle),
    metaDesc: s(p.metaDesc),
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    images: p.images.map((i) => i.url),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: s(v.sku),
      price: v.price === null ? "" : s(Number(v.price)),
      stock: s(v.stock),
      isActive: v.isActive,
    })),
  };
}
