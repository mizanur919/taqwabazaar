import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { TrackViewContent } from "@/components/meta-events";
import { ProductActions, ProductTabs, WishButton } from "@/components/product-actions";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { taka } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "পণ্য পাওয়া যায়নি" };
  return {
    title: product.metaTitle || product.name,
    description: (product.metaDesc || product.description)?.slice(0, 160),
    openGraph: { images: product.image ? [product.image] : [] },
  };
}

export default function ProductPage({ params }: PageProps<"/product/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      {params.then(({ slug }) => (
        <ProductContent slug={slug} />
      ))}
    </Suspense>
  );
}

async function ProductContent({ slug }: { slug: string }) {
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.categoryId, product.id);
  const save = product.salePrice !== null ? product.price - product.salePrice : 0;
  const percent = save > 0 ? Math.round((save / product.price) * 100) : 0;
  // Only the card fields go to client components (cart / wishlist storage).
  const card = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    salePrice: product.salePrice,
    image: product.image,
    categoryId: product.categoryId,
    hasVariants: product.hasVariants,
  };

  return (
    <>
      <TrackViewContent id={product.id} name={product.name} price={product.salePrice ?? product.price} category={product.category.name} />
      <Breadcrumb
        items={[
          { label: product.category.name, href: `/category/${product.category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 rounded-2xl border border-line bg-white p-4 md:grid-cols-2 md:p-6">
          <ProductGallery
            images={product.images}
            name={product.name}
            badge={save > 0 ? `Save: ${taka(save)}` : undefined}
          />

          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>
              <WishButton product={card} />
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">{taka(product.salePrice ?? product.price)}</span>
              {save > 0 && (
                <>
                  <span className="text-muted line-through">{taka(product.price)}</span>
                  <span className="text-sm font-semibold text-brand">-{percent}%</span>
                </>
              )}
            </div>

            <ul className="space-y-1.5 text-sm text-ink-soft">
              {product.brand && <li>✔ ব্র্যান্ড: {product.brand}</li>}
              {product.warranty && <li>✔ ওয়ারেন্টি: {product.warranty}</li>}
              <li>✔ সারা বাংলাদেশে ক্যাশ অন ডেলিভারি</li>
              <li>
                ✔ স্টক:{" "}
                {product.stock > 0 ? (
                  <span className="font-semibold text-green-600">In Stock</span>
                ) : (
                  <span className="font-semibold text-red-600">Out of Stock</span>
                )}
              </li>
            </ul>

            <ProductActions product={card} stock={product.stock} variants={product.variants} />

            <p className="text-sm text-muted">
              Category:{" "}
              <Link href={`/category/${product.category.slug}`} className="text-ink hover:text-brand">
                {product.category.name}
              </Link>
              {product.sku && <span className="ml-4">SKU: {product.sku}</span>}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <ProductTabs description={[product.descriptionBn, product.description].filter(Boolean).join("\n\n") || null} />
        </div>

        {related.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Related Product</h2>
              <Link
                href={`/category/${product.category.slug}`}
                className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-soft"
              >
                See more
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {related.slice(0, 5).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-slate-100" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-8 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="h-32 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
