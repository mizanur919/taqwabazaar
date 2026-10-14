import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Package, Plus, Search } from "lucide-react";
import { ProductFlagButtons } from "@/components/admin/product-row-actions";
import { Card } from "@/components/admin/ui";
import { getCategoryOptions, listProducts, type ProductListFilters } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";
import { taka } from "@/lib/format";

export const metadata: Metadata = { title: "Products" };

const statusTabs = [
  { id: "", label: "সব" },
  { id: "active", label: "চালু" },
  { id: "hidden", label: "লুকানো" },
  { id: "featured", label: "Featured" },
  { id: "low", label: "স্টক কম" },
] as const;

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-adm-muted">সব প্রোডাক্ট, দাম আর স্টক এক জায়গায়</p>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-adm-ink px-4 text-sm font-semibold text-white hover:bg-stone-800">
          <Plus className="size-4" /> নতুন প্রোডাক্ট
        </Link>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
        {searchParams.then((sp) => (
          <ProductTable sp={sp} />
        ))}
      </Suspense>
    </div>
  );
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function ProductTable({ sp }: { sp: SP }) {
  await requireAdmin();
  const filters: ProductListFilters = {
    q: one(sp.q).trim().slice(0, 80) || undefined,
    category: Number(one(sp.category)) || undefined,
    status: (statusTabs.find((t) => t.id && t.id === one(sp.status))?.id || undefined) as ProductListFilters["status"],
    page: Number(one(sp.page)) || 1,
  };
  const [data, categories] = await Promise.all([listProducts(filters), getCategoryOptions()]);

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: filters.q, category: filters.category, status: filters.status, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <>
      {one(sp.deleted) && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">প্রোডাক্টটি ডিলিট হয়েছে।</p>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-stone-900/5 p-0.5 text-sm">
          {statusTabs.map((t) => (
            <Link
              key={t.id}
              href={href({ status: t.id || undefined })}
              className={`rounded-md px-3 py-1.5 ${(filters.status ?? "") === t.id ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form action="/admin/products" className="ml-auto flex flex-wrap gap-2">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="h-9 rounded-lg border border-adm-line bg-white px-2 text-sm"
            aria-label="ক্যাটাগরি"
          >
            <option value="">সব ক্যাটাগরি</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-adm-line bg-white px-2.5">
            <Search className="size-4 text-adm-muted" />
            <input name="q" defaultValue={filters.q} placeholder="নাম বা SKU" className="w-40 bg-transparent text-sm outline-none" />
          </label>
          <button type="submit" className="h-9 rounded-lg bg-adm-ink px-3 text-sm font-semibold text-white">
            খুঁজুন
          </button>
        </form>
      </div>

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-2 py-3 font-medium">Category</th>
                <th className="px-2 py-3 text-right font-medium">Price</th>
                <th className="px-2 py-3 text-right font-medium">Stock</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((p) => (
                <tr key={p.id} className="border-b border-adm-line/70 last:border-0 hover:bg-stone-900/[0.02]">
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-adm-line bg-white">
                        {p.image ? (
                          <Image src={p.image} alt="" fill sizes="44px" className="object-contain p-1" />
                        ) : (
                          <Package className="m-auto mt-3 size-5 text-adm-muted" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold hover:underline">{p.name}</span>
                        <span className="block text-xs text-adm-muted">
                          {p.sku ?? "SKU নেই"}
                          {p.variants > 0 && ` · ${p.variants} ভ্যারিয়েন্ট`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-adm-ink-soft">{p.category}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className="font-semibold">{taka(p.salePrice ?? p.price)}</span>
                    {p.salePrice !== null && <span className="block text-xs text-adm-muted line-through">{taka(p.price)}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className={p.stock <= 0 ? "font-semibold text-red-700" : p.stock <= p.lowStockAt ? "font-semibold text-orange-700" : ""}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    {p.isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                        <span className="size-1.5 rounded-full bg-green-600" /> চালু
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                        <span className="size-1.5 rounded-full bg-stone-500" /> লুকানো
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <ProductFlagButtons id={p.id} isActive={p.isActive} isFeatured={p.isFeatured} />
                      <Link href={`/admin/products/${p.id}`} className="rounded-md border border-adm-line bg-white px-2.5 py-1 text-xs font-semibold hover:bg-stone-50">
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-adm-muted">
                    কোনো প্রোডাক্ট পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-adm-line px-5 py-3 text-xs text-adm-muted">
          <span>মোট {data.total}টি প্রোডাক্ট</span>
          <div className="flex items-center gap-2">
            {data.page > 1 ? (
              <Link href={href({ page: data.page - 1 })} aria-label="আগের পেজ" className="rounded-md border border-adm-line bg-white p-1 hover:bg-stone-50">
                <ChevronLeft className="size-4" />
              </Link>
            ) : null}
            <span>
              পেজ {data.page} / {data.pages}
            </span>
            {data.page < data.pages ? (
              <Link href={href({ page: data.page + 1 })} aria-label="পরের পেজ" className="rounded-md border border-adm-line bg-white p-1 hover:bg-stone-50">
                <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
