import type { Metadata } from "next";
import { Suspense } from "react";
import { emptyProduct, ProductForm } from "@/components/admin/product-form";
import { getBrandOptions, getCategoryOptions } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      <NewProductForm />
    </Suspense>
  );
}

async function NewProductForm() {
  await requireAdmin();
  const [categories, brands] = await Promise.all([getCategoryOptions(), getBrandOptions()]);
  return <ProductForm initial={emptyProduct} categories={categories} brands={brands} />;
}
