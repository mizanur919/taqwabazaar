"use server";

import { updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import type { ProductFormValues } from "@/lib/admin/products";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deleteImage, saveImage, UploadError, uploadBaseUrl } from "@/lib/uploads";

export type SaveResult = { ok: true; id: number } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const MAX_IMAGES = 10;
const MAX_VARIANTS = 30;

/** Old orders keep showing their product photo, so only delete files no order refers to. */
async function deleteImageIfUnused(url: string) {
  const usedByOrders = await prisma.orderItem.count({ where: { image: url } });
  if (!usedByOrders) await deleteImage(url);
}

const money = (v: string) => {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const int = (v: string) => {
  const n = Number(String(v).trim());
  return Number.isInteger(n) ? n : NaN;
};
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function uploadProductImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "কোনো ফাইল পাওয়া যায়নি" };
  try {
    return { url: await saveImage(file, "products") };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    console.error("upload failed", e);
    return { error: "ছবি আপলোড করা যায়নি, আবার চেষ্টা করুন" };
  }
}

export async function saveProduct(input: ProductFormValues): Promise<SaveResult> {
  const admin = await requireAdmin();
  const id = input.id ? Number(input.id) : undefined;
  const fieldErrors: Record<string, string> = {};

  const name = text(input.name, 200);
  if (name.length < 2) fieldErrors.name = "প্রোডাক্টের নাম লিখুন";

  const typedSlug = slugify(text(input.slug, 220));
  let slug = typedSlug || slugify(name) || `product-${Date.now().toString(36)}`;

  const categoryId = Number(input.categoryId);
  if (!categoryId || !(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
    fieldErrors.categoryId = "ক্যাটাগরি নির্বাচন করুন";
  }
  const brandId = input.brandId === "" ? null : Number(input.brandId);
  if (brandId && !(await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } }))) {
    fieldErrors.brandId = "ব্র্যান্ড পাওয়া যায়নি";
  }

  const price = money(input.price);
  if (!(price > 0)) fieldErrors.price = "সঠিক দাম লিখুন";
  const salePrice = text(input.salePrice, 20) === "" ? null : money(input.salePrice);
  if (salePrice !== null && !(salePrice > 0 && salePrice < price)) {
    fieldErrors.salePrice = "অফার দাম রেগুলার দামের চেয়ে কম হতে হবে";
  }

  // variants
  const variants = (Array.isArray(input.variants) ? input.variants : []).slice(0, MAX_VARIANTS).map((v) => ({
    id: v.id ? Number(v.id) : undefined,
    name: text(v.name, 120),
    sku: text(v.sku, 80) || null,
    price: text(v.price, 20) === "" ? null : money(v.price),
    stock: int(v.stock || "0"),
    isActive: !!v.isActive,
  }));
  variants.forEach((v, i) => {
    if (!v.name) fieldErrors[`variant-${i}`] = "ভ্যারিয়েন্টের নাম লিখুন";
    else if (Number.isNaN(v.stock) || v.stock < 0) fieldErrors[`variant-${i}`] = "স্টক ০ বা তার বেশি হতে হবে";
    else if (v.price !== null && !(v.price > 0)) fieldErrors[`variant-${i}`] = "সঠিক দাম লিখুন";
  });

  // with variants, product stock is the sum of active variant stock
  const activeVariants = variants.filter((v) => v.isActive);
  let stock = int(input.stock || "0");
  if (activeVariants.length) stock = activeVariants.reduce((n, v) => n + (Number.isNaN(v.stock) ? 0 : v.stock), 0);
  else if (Number.isNaN(stock) || stock < 0) fieldErrors.stock = "স্টক ০ বা তার বেশি হতে হবে";

  // images: only files we uploaded, or images this product already had (e.g. demo photos)
  const existing = id
    ? await prisma.productImage.findMany({ where: { productId: id }, select: { url: true } })
    : [];
  const existingUrls = new Set(existing.map((i) => i.url));
  const base = uploadBaseUrl();
  const images = [...new Set(Array.isArray(input.images) ? input.images.map(String) : [])]
    .filter((url) => existingUrls.has(url) || url.startsWith(`${base}/products/`))
    .slice(0, MAX_IMAGES);
  if (images.length === 0) fieldErrors.images = "অন্তত একটি ছবি দিন";

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, error: "কিছু তথ্য ঠিক করতে হবে" };

  // slug must be unique; auto-generated slugs get a numeric suffix
  const taken = async (s: string) =>
    !!(await prisma.product.findFirst({ where: { slug: s, ...(id ? { id: { not: id } } : {}) }, select: { id: true } }));
  if (await taken(slug)) {
    if (typedSlug) return { ok: false, fieldErrors: { slug: "এই URL আগে থেকেই ব্যবহার হচ্ছে" } };
    let n = 2;
    while (await taken(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }

  const data = {
    name,
    nameBn: text(input.nameBn, 200) || null,
    slug,
    categoryId,
    brandId,
    price,
    salePrice,
    effectivePrice: salePrice ?? price,
    stock,
    sku: text(input.sku, 80) || null,
    warranty: text(input.warranty, 120) || null,
    description: text(input.description, 20000) || null,
    descriptionBn: text(input.descriptionBn, 20000) || null,
    metaTitle: text(input.metaTitle, 200) || null,
    metaDesc: text(input.metaDesc, 300) || null,
    isActive: !!input.isActive,
    isFeatured: !!input.isFeatured,
    lowStockAt: Math.max(0, Math.min(int(input.lowStockAt || "5") || 0, 100000)),
  };

  // remember stock before the save so the change can be written to the stock log
  const before = id
    ? await prisma.product.findUnique({ where: { id }, select: { stock: true, variants: { select: { id: true, stock: true } } } })
    : null;
  const beforeVariant = new Map(before?.variants.map((v) => [v.id, v.stock]) ?? []);

  let savedId: number;
  try {
    savedId = await prisma.$transaction(async (tx) => {
      const product = id
        ? await tx.product.update({ where: { id }, data })
        : await tx.product.create({ data });

      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.productImage.createMany({
        data: images.map((url, i) => ({ productId: product.id, url, alt: name, sortOrder: i })),
      });

      const keepIds = variants.filter((v) => v.id).map((v) => v.id!);
      await tx.productVariant.deleteMany({ where: { productId: product.id, id: { notIn: keepIds } } });
      const log = (change: number, balance: number, variant?: { id: number; name: string }) =>
        change !== 0 &&
        tx.stockMovement.create({
          data: {
            productId: product.id,
            variantId: variant?.id ?? null,
            variantName: variant?.name ?? null,
            change,
            balance,
            reason: "EDIT",
            adminName: admin.name,
          },
        });

      for (const v of variants) {
        const row = { name: v.name, sku: v.sku, price: v.price, stock: v.stock, isActive: v.isActive };
        if (v.id) {
          const res = await tx.productVariant.updateMany({ where: { id: v.id, productId: product.id }, data: row });
          if (res.count) await log(v.stock - (beforeVariant.get(v.id) ?? v.stock), v.stock, { id: v.id, name: v.name });
        } else {
          const created = await tx.productVariant.create({ data: { ...row, productId: product.id } });
          await log(v.stock, v.stock, { id: created.id, name: v.name });
        }
      }
      if (variants.length === 0) await log(stock - (before?.stock ?? 0), stock);
      return product.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "SKU আগে থেকেই অন্য প্রোডাক্টে ব্যবহার হচ্ছে" };
    }
    throw e;
  }

  // remove files that are no longer used by this product
  for (const url of existingUrls) if (!images.includes(url)) await deleteImageIfUnused(url);

  updateTag("catalog");
  return { ok: true, id: savedId };
}

export async function deleteProduct(id: number): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: Number(id) }, include: { images: true } });
  if (!product) return { ok: false, error: "প্রোডাক্ট পাওয়া যায়নি" };
  await prisma.product.delete({ where: { id: product.id } }); // order history keeps its own snapshot
  for (const img of product.images) await deleteImageIfUnused(img.url);
  updateTag("catalog");
  return { ok: true };
}

export async function toggleProductFlag(id: number, flag: "isActive" | "isFeatured"): Promise<void> {
  await requireAdmin();
  if (flag !== "isActive" && flag !== "isFeatured") return;
  const product = await prisma.product.findUnique({ where: { id: Number(id) }, select: { [flag]: true } });
  if (!product) return;
  await prisma.product.update({ where: { id: Number(id) }, data: { [flag]: !product[flag] } });
  updateTag("catalog");
}
