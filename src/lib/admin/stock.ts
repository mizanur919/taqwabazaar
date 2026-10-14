// Stock overview: one row per sellable item (a product, or each variant of a product).
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export type StockRow = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  variantName: string | null;
  sku: string | null;
  image: string | null;
  category: string;
  categoryId: number;
  stock: number;
  lowStockAt: number;
  price: number;
  status: "in" | "low" | "out";
  isActive: boolean;
};

const statusOf = (stock: number, low: number): StockRow["status"] => (stock <= 0 ? "out" : stock <= low ? "low" : "in");

export async function getStockRows() {
  await connection();
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      variants: { where: { isActive: true }, orderBy: { id: "asc" } },
    },
  });

  const rows: StockRow[] = [];
  for (const p of products) {
    const base = {
      productId: p.id,
      name: p.name,
      image: p.images[0]?.url ?? null,
      category: p.category.name,
      categoryId: p.categoryId,
      lowStockAt: p.lowStockAt,
      isActive: p.isActive,
    };
    const price = Number(p.salePrice ?? p.price);
    if (p.variants.length === 0) {
      rows.push({ ...base, key: `${p.id}`, variantId: null, variantName: null, sku: p.sku, stock: p.stock, price, status: statusOf(p.stock, p.lowStockAt) });
    } else {
      for (const v of p.variants) {
        rows.push({
          ...base,
          key: `${p.id}:${v.id}`,
          variantId: v.id,
          variantName: v.name,
          sku: v.sku ?? p.sku,
          stock: v.stock,
          price: v.price === null ? price : Number(v.price),
          status: statusOf(v.stock, p.lowStockAt),
        });
      }
    }
  }

  const active = rows.filter((r) => r.isActive);
  return {
    rows,
    summary: {
      products: products.filter((p) => p.isActive).length,
      low: active.filter((r) => r.status === "low").length,
      out: active.filter((r) => r.status === "out").length,
      value: active.reduce((n, r) => n + Math.max(0, r.stock) * r.price, 0),
      units: active.reduce((n, r) => n + Math.max(0, r.stock), 0),
    },
  };
}
