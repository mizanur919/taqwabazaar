import type { Metadata } from "next";
import { Suspense } from "react";
import { StockManager } from "@/components/admin/stock-manager";
import { getCategoryOptions } from "@/lib/admin/products";
import { getStockRows } from "@/lib/admin/stock";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Stock" };

export default function StockPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      <StockContent />
    </Suspense>
  );
}

async function StockContent() {
  await requireAdmin();
  const [{ rows, summary }, categories] = await Promise.all([getStockRows(), getCategoryOptions()]);
  return <StockManager rows={rows} summary={summary} categories={categories} />;
}
