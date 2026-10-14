import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackSearch } from "@/components/meta-events";
import { ProductCard } from "@/components/product-card";
import { GridSkeleton } from "@/components/skeletons";
import { searchProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "সার্চ রেজাল্ট" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      {searchParams.then(({ q }) => (
        <SearchResults query={typeof q === "string" ? q.slice(0, 80) : ""} />
      ))}
    </Suspense>
  );
}

async function SearchResults({ query }: { query: string }) {
  const results = await searchProducts(query);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <TrackSearch query={query} resultIds={results.map((p) => p.id)} />
      <h1 className="text-2xl font-bold">সার্চ রেজাল্ট</h1>
      <p className="mt-1 text-sm text-muted">&quot;{query}&quot; এর জন্য রেজাল্ট</p>

      {results.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-white p-10 text-center text-muted">
          কোনো পণ্য পাওয়া যায়নি। অন্য কিছু লিখে খুঁজে দেখুন।
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
