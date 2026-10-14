"use server";

import { updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { categoryIcons } from "@/components/category-icon";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deleteImage, saveImage, UploadError, uploadBaseUrl } from "@/lib/uploads";

export type CategoryInput = {
  id?: number;
  name: string;
  nameBn: string;
  slug: string;
  icon: string;
  image: string;
  sortOrder: string;
  isActive: boolean;
};

export type BrandInput = { id?: number; name: string; slug: string; logo: string };

type Result = { ok: true } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

async function upload(formData: FormData, kind: "categories" | "brands") {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "কোনো ফাইল পাওয়া যায়নি" };
  try {
    return { url: await saveImage(file, kind, 600) };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    console.error("upload failed", e);
    return { error: "ছবি আপলোড করা যায়নি" };
  }
}

export async function uploadCategoryImage(formData: FormData) {
  return upload(formData, "categories");
}

export async function uploadBrandLogo(formData: FormData) {
  return upload(formData, "brands");
}

/** Accept only our own uploads, or the value already stored (so old images survive edits). */
const allowedImage = (url: string, kind: string, current: string | null) =>
  !url ? null : url === current || url.startsWith(`${uploadBaseUrl()}/${kind}/`) ? url : null;

export async function saveCategory(input: CategoryInput): Promise<Result> {
  await requireAdmin();
  const id = input.id ? Number(input.id) : undefined;
  const current = id ? await prisma.category.findUnique({ where: { id } }) : null;
  if (id && !current) return { ok: false, error: "ক্যাটাগরি পাওয়া যায়নি" };

  const name = text(input.name, 120);
  const slug = slugify(text(input.slug, 150)) || slugify(name);
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "নাম লিখুন";
  if (!slug) fieldErrors.slug = "ইংরেজিতে URL লিখুন";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const image = allowedImage(text(input.image, 500), "categories", current?.image ?? null);
  const data = {
    name,
    nameBn: text(input.nameBn, 120) || null,
    slug,
    icon: categoryIcons[input.icon] ? input.icon : null,
    image,
    sortOrder: Number.parseInt(input.sortOrder, 10) || 0,
    isActive: !!input.isActive,
  };

  try {
    if (id) await prisma.category.update({ where: { id }, data });
    else await prisma.category.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, fieldErrors: { slug: "এই URL আগে থেকেই ব্যবহার হচ্ছে" } };
    }
    throw e;
  }
  if (current?.image && current.image !== image) await deleteImage(current.image);
  updateTag("catalog");
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<Result> {
  await requireAdmin();
  const category = await prisma.category.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return { ok: false, error: "ক্যাটাগরি পাওয়া যায়নি" };
  if (category._count.products > 0) {
    return { ok: false, error: `এই ক্যাটাগরিতে ${category._count.products}টি প্রোডাক্ট আছে। আগে প্রোডাক্টগুলো অন্য ক্যাটাগরিতে সরান।` };
  }
  await prisma.category.delete({ where: { id: category.id } });
  await deleteImage(category.image);
  updateTag("catalog");
  return { ok: true };
}

export async function saveBrand(input: BrandInput): Promise<Result> {
  await requireAdmin();
  const id = input.id ? Number(input.id) : undefined;
  const current = id ? await prisma.brand.findUnique({ where: { id } }) : null;
  if (id && !current) return { ok: false, error: "ব্র্যান্ড পাওয়া যায়নি" };

  const name = text(input.name, 120);
  const slug = slugify(text(input.slug, 150)) || slugify(name);
  if (name.length < 1) return { ok: false, fieldErrors: { name: "নাম লিখুন" } };
  if (!slug) return { ok: false, fieldErrors: { slug: "ইংরেজিতে URL লিখুন" } };

  const logo = allowedImage(text(input.logo, 500), "brands", current?.logo ?? null);
  try {
    if (id) await prisma.brand.update({ where: { id }, data: { name, slug, logo } });
    else await prisma.brand.create({ data: { name, slug, logo } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, fieldErrors: { slug: "এই URL আগে থেকেই ব্যবহার হচ্ছে" } };
    }
    throw e;
  }
  if (current?.logo && current.logo !== logo) await deleteImage(current.logo);
  updateTag("catalog");
  return { ok: true };
}

export async function deleteBrand(id: number): Promise<Result> {
  await requireAdmin();
  const brand = await prisma.brand.findUnique({ where: { id: Number(id) } });
  if (!brand) return { ok: false, error: "ব্র্যান্ড পাওয়া যায়নি" };
  await prisma.brand.delete({ where: { id: brand.id } }); // products keep existing, brand set to none
  await deleteImage(brand.logo);
  updateTag("catalog");
  return { ok: true };
}
