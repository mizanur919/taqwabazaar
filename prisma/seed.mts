// Seeds demo categories, brands and products from prisma/seed-data.json.
// Run: npm run db:seed   (wipes existing catalog data first)
import fs from "node:fs";
import path from "node:path";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

type SeedProduct = {
  name: string;
  slug: string;
  brand: string | null;
  category: string;
  description: string;
  price: number;
  salePrice: number | null;
  stock: number;
  sku: string;
  images: string[];
  warranty: string | null;
};

type SeedData = {
  categories: { slug: string; name: string; nameBn: string; icon: string }[];
  products: SeedProduct[];
};

const prisma = new PrismaClient();
const data: SeedData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "seed-data.json"), "utf8"),
);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();

  const categoryIds = new Map<string, number>();
  for (const [i, c] of data.categories.entries()) {
    const row = await prisma.category.create({
      data: { name: c.name, nameBn: c.nameBn, slug: c.slug, icon: c.icon, sortOrder: i },
    });
    categoryIds.set(c.slug, row.id);
  }

  const brandIds = new Map<string, number>();
  for (const name of new Set(data.products.map((p) => p.brand).filter(Boolean) as string[])) {
    const row = await prisma.brand.create({ data: { name, slug: slugify(name) } });
    brandIds.set(name, row.id);
  }

  for (const [i, p] of data.products.entries()) {
    await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: categoryIds.get(p.category)!,
        brandId: p.brand ? brandIds.get(p.brand) : null,
        price: p.price,
        salePrice: p.salePrice,
        effectivePrice: p.salePrice ?? p.price,
        stock: p.stock,
        sku: p.sku,
        warranty: p.warranty,
        isFeatured: i % 3 === 0,
        images: { create: p.images.map((url, j) => ({ url, alt: p.name, sortOrder: j })) },
      },
    });
  }

  console.log(
    `Seeded ${data.categories.length} categories, ${brandIds.size} brands, ${data.products.length} products`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
