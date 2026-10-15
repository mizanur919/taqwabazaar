import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/print-button";
import { getStockRows } from "@/lib/admin/stock";
import { requireAdmin } from "@/lib/auth";
import { getBrand } from "@/lib/layout";

export const metadata: Metadata = { title: "Count sheet", robots: { index: false } };

// Printable stock count sheet: staff count the shelf and write the real number in the empty column.
export default function CountSheetPage() {
  return (
    <Suspense fallback={null}>
      <CountSheet />
    </Suspense>
  );
}

async function CountSheet() {
  await requireAdmin();
  const [{ rows }, brand] = await Promise.all([getStockRows(), getBrand()]);
  const active = rows.filter((r) => r.isActive);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

  return (
    <div className="min-h-screen bg-stone-100 py-8 text-stone-900 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[210mm] bg-white p-10 shadow print:p-0 print:shadow-none">
        <div className="flex items-end justify-between border-b-2 border-stone-900 pb-3">
          <div>
            <p className="text-xl font-bold">{brand.name} · Stock count sheet</p>
            <p className="text-sm text-stone-600">{active.length}টি আইটেম</p>
          </div>
          <p className="text-sm">তারিখ: {today}</p>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-400 text-left">
              <th className="py-1.5">#</th>
              <th className="py-1.5">Product</th>
              <th className="py-1.5">SKU</th>
              <th className="py-1.5 text-right">সিস্টেমে</th>
              <th className="w-28 py-1.5 text-right">গুনে পাওয়া</th>
            </tr>
          </thead>
          <tbody>
            {active.map((r, i) => (
              <tr key={r.key} className="border-b border-stone-200 break-inside-avoid">
                <td className="py-1.5">{i + 1}</td>
                <td className="py-1.5">
                  {r.name}
                  {r.variantName && <span className="text-stone-500"> — {r.variantName}</span>}
                </td>
                <td className="py-1.5 text-xs text-stone-500">{r.sku}</td>
                <td className="py-1.5 text-right tabular-nums">{r.stock}</td>
                <td className="py-1.5">
                  <span className="ml-auto block h-5 w-20 border-b border-stone-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-10 text-sm">গুনেছেন: ____________________ &nbsp;&nbsp; স্বাক্ষর: ____________________</p>
      </div>
    </div>
  );
}
