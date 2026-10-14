import { connection } from "next/server";
import { CUSTOMER_TABS, exportCustomers } from "@/lib/admin/customers";
import { getAdmin } from "@/lib/auth";

// CSV of customers (Customers → CSV). Opens in Excel with Bangla intact (UTF-8 BOM).
export async function GET(request: Request) {
  await connection();
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const tab = CUSTOMER_TABS.find((t) => t === sp.get("tab")) ?? "all";
  const q = (sp.get("q") ?? "").trim().slice(0, 80) || undefined;
  const rows = await exportCustomers({ tab, q });

  // quote every cell; neutralise leading =,+,-,@ so spreadsheets don't run formulas
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Name", "Phone", "Address", "Orders", "Delivered", "Cancelled", "Spent", "First order", "Last order", "Tag"];
  const lines = rows.map((c) => [
    c.name,
    c.phone,
    c.address,
    c.orders,
    c.delivered,
    c.cancelled,
    c.spent,
    c.firstOrder.toISOString().slice(0, 10),
    c.lastOrder.toISOString().slice(0, 10),
    c.tag ?? "",
  ]);
  const csv = "﻿" + [header, ...lines].map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${tab}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
