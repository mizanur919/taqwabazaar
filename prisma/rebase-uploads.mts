// Rewrites stored image URLs from one base to another, e.g. after uploads moved from
// https://img.taqwabazaar.com (subdomain) to /uploads (served by the app from the same folder).
// Only the URL text changes; the files on disk are not touched.
// Usage: npm run uploads:rebase -- [from] [to]
//   defaults: from = https://img.taqwabazaar.com   to = UPLOAD_BASE_URL from .env (or /uploads)
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const strip = (s: string) => s.replace(/\/+$/, "");
const from = strip(process.argv[2] ?? "https://img.taqwabazaar.com");
const to = strip(process.argv[3] ?? process.env.UPLOAD_BASE_URL ?? "/uploads");
if (from === to) {
  console.error(`Nothing to do: from and to are both "${from}"`);
  process.exit(1);
}

const prisma = new PrismaClient();
const swap = (v: string) => (v.startsWith(`${from}/`) ? to + v.slice(from.length) : v);
let changed = 0;

async function column<T extends { id: number }>(label: string, rows: T[], key: keyof T, save: (id: number, value: string) => Promise<unknown>) {
  for (const r of rows) {
    const v = r[key] as unknown as string | null;
    if (!v || !v.startsWith(`${from}/`)) continue;
    await save(r.id, swap(v));
    changed++;
  }
  console.log(`${label}: checked ${rows.length}`);
}

await column("product images", await prisma.productImage.findMany({ select: { id: true, url: true } }), "url", (id, url) =>
  prisma.productImage.update({ where: { id }, data: { url } }),
);
await column("categories", await prisma.category.findMany({ select: { id: true, image: true } }), "image", (id, image) =>
  prisma.category.update({ where: { id }, data: { image } }),
);
await column("brands", await prisma.brand.findMany({ select: { id: true, logo: true } }), "logo", (id, logo) =>
  prisma.brand.update({ where: { id }, data: { logo } }),
);
await column("banners", await prisma.banner.findMany({ select: { id: true, image: true } }), "image", (id, image) =>
  prisma.banner.update({ where: { id }, data: { image } }),
);
await column("order items", await prisma.orderItem.findMany({ select: { id: true, image: true } }), "image", (id, image) =>
  prisma.orderItem.update({ where: { id }, data: { image } }),
);

// logo and favicon live inside the "layout" settings JSON
const layout = await prisma.setting.findUnique({ where: { key: "layout" } });
if (layout && layout.value.includes(`${from}/`)) {
  const value = layout.value.split(`"${from}/`).join(`"${to}/`);
  await prisma.setting.update({ where: { key: "layout" }, data: { value } });
  changed++;
  console.log("layout settings: logo/favicon updated");
}

console.log(`Done: ${changed} URL(s) changed from ${from} to ${to}`);
await prisma.$disconnect();
