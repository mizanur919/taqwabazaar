// Fills the last 90 days with demo orders so the admin dashboard has something to show.
// Every demo order has note = "DEMO".
//   npm run db:demo-orders            -> replace demo orders (stock is not touched)
//   npm run db:demo-orders -- --clear -> only delete demo orders
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();
const DEMO = "DEMO";

// small seeded PRNG so every run produces the same data
let seed = 20261013;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];

const names = ["রাহিম উদ্দিন", "করিম হোসেন", "সাদিয়া আক্তার", "তানভীর আহমেদ", "নুসরাত জাহান", "মাহফুজ রহমান", "আরিফ হাসান", "ফারহানা ইসলাম", "শাকিল খান", "জান্নাতুল ফেরদৌস"];
const areas = ["মিরপুর, ঢাকা", "উত্তরা, ঢাকা", "আগ্রাবাদ, চট্টগ্রাম", "জিন্দাবাজার, সিলেট", "সাহেব বাজার, রাজশাহী", "সোনাডাঙ্গা, খুলনা", "ধানমন্ডি, ঢাকা", "কুমিল্লা সদর"];

await prisma.order.deleteMany({ where: { note: DEMO } });
if (process.argv.includes("--clear")) {
  console.log("Demo orders removed");
  await prisma.$disconnect();
  process.exit(0);
}

const products = await prisma.product.findMany({
  where: { isActive: true },
  include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
});
// cheaper products sell more often
const weighted = products.flatMap((p) => Array(Number(p.salePrice ?? p.price) < 20000 ? 4 : 1).fill(p));

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
let created = 0;

for (let i = 0; i < 85; i++) {
  const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 90); // a bit busier in recent weeks
  const createdAt = new Date(now - daysAgo * DAY - Math.floor(rand() * DAY));
  const lines = new Map<number, { p: (typeof products)[number]; qty: number }>();
  const lineCount = rand() < 0.75 ? 1 : 2;
  for (let l = 0; l < lineCount; l++) {
    const p = pick(weighted);
    const prev = lines.get(p.id);
    lines.set(p.id, { p, qty: (prev?.qty ?? 0) + (rand() < 0.85 ? 1 : 2) });
  }
  const items = [...lines.values()].map(({ p, qty }) => ({
    productId: p.id,
    name: p.name,
    image: p.images[0]?.url ?? null,
    unitPrice: Number(p.salePrice ?? p.price),
    quantity: qty,
  }));
  const subtotal = items.reduce((n, it) => n + it.unitPrice * it.quantity, 0);
  const inside = rand() < 0.45;
  const shippingFee = inside ? 70 : 120;

  // older orders are further along the pipeline
  const r = rand();
  const status =
    daysAgo > 7
      ? r < 0.85 ? "DELIVERED" : "CANCELLED"
      : daysAgo > 3
        ? r < 0.5 ? "SHIPPED" : r < 0.9 ? "DELIVERED" : "CANCELLED"
        : r < 0.45 ? "PENDING" : r < 0.8 ? "CONFIRMED" : "SHIPPED";

  const order = await prisma.order.create({
    data: {
      orderNo: `TMP-DEMO-${i}-${Math.floor(rand() * 1e9)}`,
      customerName: pick(names),
      phone: `017${String(10000000 + Math.floor(rand() * 89999999))}`,
      address: `বাসা ${1 + Math.floor(rand() * 90)}, ${pick(areas)}`,
      zone: inside ? "inside" : "outside",
      note: DEMO,
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      status,
      createdAt,
      items: { create: items },
    },
  });
  await prisma.order.update({ where: { id: order.id }, data: { orderNo: `TB${100000 + order.id}` } });
  created++;
}

console.log(`Created ${created} demo orders`);
await prisma.$disconnect();
