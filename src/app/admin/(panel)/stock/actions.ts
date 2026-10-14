"use server";

import { updateTag } from "next/cache";
import type { StockReason } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moveStock, reasonLabels, StockError } from "@/lib/stock";

type Result = { ok: true; balance: number } | { ok: false; error: string };

const target = (productId: unknown, variantId: unknown) => ({
  productId: Number(productId),
  variantId: variantId ? Number(variantId) : null,
});

async function currentStock(productId: number, variantId: number | null) {
  if (variantId) return (await prisma.productVariant.findFirst({ where: { id: variantId, productId } }))?.stock;
  return (await prisma.product.findUnique({ where: { id: productId } }))?.stock;
}

/** "Receive stock": a delivery arrived, add it to the shelf. */
export async function receiveStock(input: {
  productId: number;
  variantId: number | null;
  qty: number;
  reference: string;
  note: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const { productId, variantId } = target(input.productId, input.variantId);
  const qty = Math.floor(Number(input.qty));
  if (!(qty > 0 && qty <= 100000)) return { ok: false, error: "সঠিক পরিমাণ লিখুন" };
  if ((await currentStock(productId, variantId)) === undefined) return { ok: false, error: "প্রোডাক্ট পাওয়া যায়নি" };

  await prisma.$transaction((tx) =>
    moveStock(tx, {
      productId,
      variantId,
      change: qty,
      reason: "RECEIVED",
      reference: String(input.reference ?? "").trim(),
      note: String(input.note ?? "").trim(),
      adminName: admin.name,
    }),
  );
  updateTag("catalog");
  return { ok: true, balance: (await currentStock(productId, variantId)) ?? 0 };
}

/** Manual correction: set the counted quantity, or remove damaged/lost units. */
export async function adjustStock(input: {
  productId: number;
  variantId: number | null;
  mode: "count" | "damaged";
  qty: number;
  note: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const { productId, variantId } = target(input.productId, input.variantId);
  const qty = Math.floor(Number(input.qty));
  if (!(qty >= 0 && qty <= 100000)) return { ok: false, error: "সঠিক পরিমাণ লিখুন" };
  const current = await currentStock(productId, variantId);
  if (current === undefined) return { ok: false, error: "প্রোডাক্ট পাওয়া যায়নি" };

  const reason: StockReason = input.mode === "damaged" ? "DAMAGED" : "ADJUSTMENT";
  const change = input.mode === "damaged" ? -qty : qty - current;
  if (change === 0) return { ok: true, balance: current };
  const note = String(input.note ?? "").trim();
  if (input.mode === "damaged" && !note) return { ok: false, error: "কারণ লিখুন (যেমন: ভাঙা এসেছে)" };

  try {
    await prisma.$transaction((tx) =>
      moveStock(tx, {
        productId,
        variantId,
        change,
        reason,
        note: note || (input.mode === "count" ? `গুনে পাওয়া গেছে ${qty}` : null),
        adminName: admin.name,
      }),
    );
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    throw e;
  }
  updateTag("catalog");
  return { ok: true, balance: (await currentStock(productId, variantId)) ?? 0 };
}

export async function setLowStockAt(productId: number, value: number): Promise<{ ok: boolean }> {
  await requireAdmin();
  const n = Math.floor(Number(value));
  if (!(n >= 0 && n <= 100000)) return { ok: false };
  await prisma.product.update({ where: { id: Number(productId) }, data: { lowStockAt: n } });
  return { ok: true };
}

export type StockHistoryEntry = {
  id: number;
  change: number;
  balance: number;
  reason: string;
  reference: string | null;
  note: string | null;
  adminName: string | null;
  variantName: string | null;
  createdAt: string;
};

export async function getStockHistory(productId: number, variantId: number | null): Promise<StockHistoryEntry[]> {
  await requireAdmin();
  const rows = await prisma.stockMovement.findMany({
    where: { productId: Number(productId), ...(variantId ? { variantId: Number(variantId) } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    change: r.change,
    balance: r.balance,
    reason: reasonLabels[r.reason],
    reference: r.reference,
    note: r.note,
    adminName: r.adminName,
    variantName: r.variantName,
    createdAt: r.createdAt.toISOString(),
  }));
}
