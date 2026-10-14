import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/print-button";
import { getOrderDetail } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth";
import { taka } from "@/lib/format";
import { getStoreSettings } from "@/lib/settings";
import { deliveryZones, site } from "@/lib/site";

export const metadata: Metadata = { title: "Print", robots: { index: false } };

// Printable invoice (A4) or packing slip (for the parcel). Opened in a new tab from the order drawer.
export default function PrintPage({ params, searchParams }: PageProps<"/admin/print/[orderNo]">) {
  return (
    <Suspense fallback={null}>
      {Promise.all([params, searchParams]).then(([{ orderNo }, sp]) => (
        <PrintContent orderNo={orderNo} slip={sp.type === "slip"} />
      ))}
    </Suspense>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

async function PrintContent({ orderNo, slip }: { orderNo: string; slip: boolean }) {
  await requireAdmin();
  const order = await getOrderDetail(decodeURIComponent(orderNo));
  if (!order || order.deletedAt) notFound();
  const zone = deliveryZones.find((z) => z.id === order.zone)?.label ?? order.zone;
  const contact = await getStoreSettings();

  return (
    <div className="min-h-screen bg-stone-100 py-8 text-stone-900 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4 print:hidden">
        <PrintButton />
      </div>

      {slip ? (
        <div className="mx-auto w-[100mm] border-2 border-dashed border-stone-400 bg-white p-5 text-sm print:border-solid">
          <div className="flex items-start justify-between border-b border-stone-300 pb-3">
            <div>
              <p className="text-lg font-bold">{site.name}</p>
              <p className="text-xs">{contact.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500">Order</p>
              <p className="text-xl font-bold">{order.orderNo}</p>
            </div>
          </div>
          <div className="space-y-1 py-3">
            <p className="text-xs uppercase tracking-wide text-stone-500">প্রাপক</p>
            <p className="text-base font-bold">{order.customerName}</p>
            <p className="text-base font-semibold">{order.phone}</p>
            <p>{order.address}</p>
            <p className="text-xs text-stone-500">{zone}</p>
          </div>
          {order.courier && (
            <div className="mb-2 flex items-center justify-between rounded border border-stone-900 px-2 py-1.5">
              <span className="text-xs font-semibold">Steadfast</span>
              <span className="text-right">
                <span className="block font-mono text-base font-bold tracking-wider">{order.courier.trackingCode ?? "—"}</span>
                <span className="block text-[10px] text-stone-500">CID {order.courier.consignmentId}</span>
              </span>
            </div>
          )}
          <ul className="border-t border-stone-300 py-2 text-xs">
            {order.items.map((i) => (
              <li key={i.id}>
                {i.quantity} × {i.name}
                {i.variantName && ` (${i.variantName})`}
              </li>
            ))}
          </ul>
          <div className="mt-2 rounded border-2 border-stone-900 p-2 text-center">
            <p className="text-xs font-semibold">ক্যাশ অন ডেলিভারি · কালেক্ট করতে হবে</p>
            <p className="text-2xl font-bold">{taka(order.courier?.cod ?? order.total)}</p>
          </div>
          {order.note && <p className="mt-2 text-xs">নোট: {order.note}</p>}
        </div>
      ) : (
        <div className="mx-auto max-w-[210mm] bg-white p-10 shadow print:p-0 print:shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold">{site.name}</p>
              <p className="text-sm text-stone-600">{contact.address}</p>
              <p className="text-sm text-stone-600">
                {contact.phone} · {contact.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-tight">INVOICE</p>
              <p className="mt-1 text-sm">
                <span className="text-stone-500">Order:</span> <b>{order.orderNo}</b>
              </p>
              <p className="text-sm">
                <span className="text-stone-500">Date:</span> {fmtDate(order.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bill to</p>
              <p className="mt-1 font-semibold">{order.customerName}</p>
              <p>{order.phone}</p>
              <p>{order.address}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Payment</p>
              <p className="mt-1">Cash on Delivery</p>
              <p className="text-stone-600">{zone}</p>
              {order.courier && <p className="text-stone-600">Steadfast · {order.courier.trackingCode}</p>}
            </div>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-stone-900 text-left">
                <th className="py-2">#</th>
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i, n) => (
                <tr key={i.id} className="border-b border-stone-200">
                  <td className="py-2">{n + 1}</td>
                  <td className="py-2">
                    {i.name}
                    {i.variantName && <span className="text-stone-500"> ({i.variantName})</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{taka(i.unitPrice)}</td>
                  <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{taka(i.unitPrice * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Subtotal</dt>
              <dd className="tabular-nums">{taka(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Delivery</dt>
              <dd className="tabular-nums">{taka(order.shippingFee)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-stone-900 pt-1 text-base font-bold">
              <dt>Total due</dt>
              <dd className="tabular-nums">{taka(order.total)}</dd>
            </div>
          </dl>

          <p className="mt-16 text-center text-xs text-stone-500">
            {site.name} থেকে কেনাকাটার জন্য ধন্যবাদ। যেকোনো প্রয়োজনে কল করুন {contact.phone}
          </p>
        </div>
      )}
    </div>
  );
}
