import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/product-form";
import { getBrandOptions, getCategoryOptions, getProductForEdit } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
        <EditProductForm id={Number(id)} notice={sp.created ? "created" : sp.saved ? "saved" : null} />
      ))}
    </Suspense>
  );
}

async function EditProductForm({ id, notice }: { id: number; notice: "created" | "saved" | null }) {
  await requireAdmin();
  if (!Number.isInteger(id)) notFound();
  const [product, categories, brands] = await Promise.all([getProductForEdit(id), getCategoryOptions(), getBrandOptions()]);
  if (!product) notFound();
  return (
    <>
      {notice && (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice === "created" ? "প্রোডাক্টটি তৈরি হয়েছে।" : "পরিবর্তন সেভ হয়েছে।"} স্টোরেও আপডেট হয়ে গেছে।
        </p>
      )}
      {/* key resets the form state after a save reloads fresh data */}
      <ProductForm key={JSON.stringify(product)} initial={product} categories={categories} brands={brands} />
    </>
  );
}
