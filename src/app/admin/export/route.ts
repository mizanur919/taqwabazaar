import { connection } from "next/server";
import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RANGES } from "@/lib/admin/overview";

// CSV export of orders in the selected range (Overview → Export).
export async function GET(request: Request) {
  await connection();
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const raw = new URL(request.url).searchParams.get("range");
  const range = RANGES.find((r) => String(r) === raw) ?? 30;
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  // quote every cell; neutralise leading =,+,-,@ so spreadsheets don't run formulas
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Order", "Date", "Customer", "Phone", "Address", "Zone", "Items", "Subtotal", "Delivery", "Total", "Status"];
  const rows = orders.map((o) => [
    o.orderNo,
    o.createdAt.toISOString(),
    o.customerName,
    o.phone,
    o.address,
    o.zone,
    o.items.map((i) => `${i.name} x${i.quantity}`).join("; "),
    Number(o.subtotal),
    Number(o.shippingFee),
    Number(o.total),
    o.status,
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-last-${range}-days.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
