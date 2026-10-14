// Every stock change goes through moveStock() so the movement log always matches the shelf.
import type { Prisma, StockReason } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class StockError extends Error {}

export const reasonLabels: Record<StockReason, string> = {
  RECEIVED: "নতুন মাল এসেছে",
  ADJUSTMENT: "হাতে ঠিক করা",
  DAMAGED: "নষ্ট / হারানো",
  ORDER: "বিক্রি (অর্ডার)",
  ORDER_CANCELLED: "অর্ডার বাতিল, ফেরত",
  EDIT: "প্রোডাক্ট এডিট",
  ORDER_EDIT: "অর্ডার এডিট",
  ORDER_DELETED: "অর্ডার Trash-এ, ফেরত",
};

type Move = {
  productId: number;
  variantId?: number | null;
  change: number;
  reason: StockReason;
  reference?: string | null;
  note?: string | null;
  adminName?: string | null;
};

/** Product stock for a product with variants = sum of its active variants. */
async function syncProductStock(tx: Tx, productId: number) {
  const { _sum } = await tx.productVariant.aggregate({ where: { productId, isActive: true }, _sum: { stock: true } });
  return tx.product.update({ where: { id: productId }, data: { stock: _sum.stock ?? 0 } });
}

/**
 * Applies a stock change inside a transaction and logs it.
 * Throws StockError if it would make stock negative.
 */
export async function moveStock(tx: Tx, m: Move) {
  if (!Number.isInteger(m.change) || m.change === 0) return;
  const variant = m.variantId
    ? await tx.productVariant.findFirst({ where: { id: m.variantId, productId: m.productId } })
    : null;

  let balance: number;
  if (variant) {
    if (variant.stock + m.change < 0) throw new StockError(`"${variant.name}" এর স্টক ${variant.stock}, এর বেশি কমানো যাবে না`);
    const updated = await tx.productVariant.update({ where: { id: variant.id }, data: { stock: { increment: m.change } } });
    balance = updated.stock;
    await syncProductStock(tx, m.productId);
  } else {
    // product without variants, or the ordered variant was deleted since: adjust the product itself
    const product = await tx.product.findUnique({ where: { id: m.productId }, select: { stock: true, name: true } });
    if (!product) return;
    if (product.stock + m.change < 0) throw new StockError(`"${product.name}" এর স্টক ${product.stock}, এর বেশি কমানো যাবে না`);
    const updated = await tx.product.update({ where: { id: m.productId }, data: { stock: { increment: m.change } } });
    balance = updated.stock;
  }

  await tx.stockMovement.create({
    data: {
      productId: m.productId,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      change: m.change,
      balance,
      reason: m.reason,
      reference: m.reference?.slice(0, 120) || null,
      note: m.note?.slice(0, 255) || null,
      adminName: m.adminName ?? null,
    },
  });
}
