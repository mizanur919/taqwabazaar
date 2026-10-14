import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      <CategoriesContent />
    </Suspense>
  );
}

async function CategoriesContent() {
  await requireAdmin();
  await connection();
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  return (
    <CatalogManager
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        nameBn: c.nameBn,
        slug: c.slug,
        icon: c.icon,
        image: c.image,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        products: c._count.products,
      }))}
      brands={brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logo: b.logo, products: b._count.products }))}
    />
  );
}
