import Image from "next/image";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { FeatureStrip, HomeHero } from "@/components/home-hero";
import { ProductCard } from "@/components/product-card";
import { Slider } from "@/components/slider";
import { getCategories, getFeaturedProducts, getLatestProducts } from "@/lib/catalog";
import { getBanners } from "@/lib/settings";

export default async function HomePage() {
  const [categories, featured, latest, banners] = await Promise.all([
    getCategories(),
    getFeaturedProducts(),
    getLatestProducts(15),
    getBanners(),
  ]);

  return (
    <div className="space-y-10 pb-4">
      <HomeHero banners={banners} />

      <Slider title="Category">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/category/${c.slug}`}
            className="flex w-32 shrink-0 snap-start flex-col items-center gap-3 rounded-xl bg-slate-50 px-3 py-6 text-center transition hover:bg-brand-soft hover:text-brand sm:w-36"
          >
            {c.image ? (
              <span className="relative size-12">
                <Image src={c.image} alt="" fill sizes="48px" className="object-contain" />
              </span>
            ) : (
              <CategoryIcon name={c.icon} className="size-12" />
            )}
            <span className="text-sm font-medium">{c.name}</span>
          </Link>
        ))}
      </Slider>

      {featured.length > 0 && (
        <Slider title="Featured Product" subtitle="Great products with great deal" accent>
          {featured.map((p) => (
            <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[19%]">
              <ProductCard product={p} />
            </div>
          ))}
        </Slider>
      )}

      <FeatureStrip />

      <section className="mx-auto max-w-7xl px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Latest Products</h2>
          <Link href="/category/all" className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-soft">
            See more
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {latest.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
