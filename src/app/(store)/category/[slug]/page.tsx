import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { ProductCard } from "@/components/product-card";
import { CategorySidebar } from "@/components/product-filter-grid";
import { GridSkeleton } from "@/components/skeletons";
import { CategorySort } from "@/components/category-sort";
import { CATEGORY_SORTS, getCategories, getCategoryListing } from "@/lib/catalog";

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "all") return { title: "All Products" };
  const category = (await getCategories()).find((c) => c.slug === slug);
  return { title: category?.name ?? "Category" };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      {Promise.all([params, searchParams]).then(([{ slug }, sp]) => (
        <CategoryContent slug={slug} sp={sp} />
      ))}
    </Suspense>
  );
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();
const num = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : undefined);

async function CategoryContent({ slug, sp }: { slug: string; sp: SP }) {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (slug !== "all" && !category) notFound();

  const q = one(sp.q).slice(0, 80);
  const cats = one(sp.cats)
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  const min = num(one(sp.min));
  const max = num(one(sp.max));
  const sort = CATEGORY_SORTS.find((s) => s !== "default" && s === one(sp.sort));
  const listing = await getCategoryListing({
    slug,
    q: q || undefined,
    categoryIds: slug === "all" ? cats : undefined,
    min,
    max,
    sort,
    page: Number(one(sp.page)) || 1,
  });

  const title = category?.name ?? "All Products";
  const values = {
    q: q || undefined,
    cats: slug === "all" && cats.length ? cats.join(",") : undefined,
    min: min !== undefined ? String(min) : undefined,
    max: max !== undefined ? String(max) : undefined,
    sort,
  };
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...values, page: page > 1 ? String(page) : undefined }).filter(([, v]) => v) as [string, string][]);
    const s = params.toString();
    return `/category/${slug}${s ? `?${s}` : ""}`;
  };

  const sidebarCategories =
    slug === "all"
      ? categories.filter((c) => listing.categoryCounts[c.id]).map((c) => ({ id: c.id, name: c.name, count: listing.categoryCounts[c.id] }))
      : [];
  const from = listing.total === 0 ? 0 : (listing.page - 1) * 24 + 1;
  const to = Math.min(listing.page * 24, listing.total);

  return (
    <>
      <Breadcrumb items={[{ label: title }]} />
      <div className="mx-auto grid max-w-7xl gap-5 px-4 md:grid-cols-[230px_1fr]">
        {/* key: reset the typed values when the URL changes */}
        <CategorySidebar key={JSON.stringify(values)} values={values} categories={sidebarCategories} />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              <span className="text-xs text-muted">
                {listing.total > 0 ? `${from}–${to}, মোট ${listing.total} টি পণ্য` : "০ টি পণ্য"}
              </span>
            </div>
            <CategorySort value={sort ?? ""} />
          </div>
          {listing.products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-muted">কোনো পণ্য পাওয়া যায়নি</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {listing.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {listing.pages > 1 && (
            <nav aria-label="পেজ" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
              {listing.page > 1 && (
                <Link href={pageHref(listing.page - 1)} aria-label="আগের পেজ" className="grid size-9 place-items-center rounded-md border border-line bg-white hover:border-brand">
                  <ChevronLeft className="size-4" />
                </Link>
              )}
              {Array.from({ length: listing.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === listing.pages || Math.abs(p - listing.page) <= 1)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center gap-1.5">
                    {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
                    <Link
                      href={pageHref(p)}
                      aria-current={p === listing.page ? "page" : undefined}
                      className={`grid size-9 place-items-center rounded-md border text-sm font-semibold ${
                        p === listing.page ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
                      }`}
                    >
                      {p}
                    </Link>
                  </span>
                ))}
              {listing.page < listing.pages && (
                <Link href={pageHref(listing.page + 1)} aria-label="পরের পেজ" className="grid size-9 place-items-center rounded-md border border-line bg-white hover:border-brand">
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
