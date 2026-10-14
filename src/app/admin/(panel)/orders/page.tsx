import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import type { OrderStatus } from "@prisma/client";
import { PencilLine, PhoneCall, Plus, Trash2, Truck } from "lucide-react";
import { CourierToolbar, OrderSelection, RowCheckbox, SelectAllCheckbox, type Selectable } from "@/components/admin/courier-bulk";
import { OrderDrawer, OrderRow } from "@/components/admin/order-drawer";
import { OrderFilters, PerPageSelect } from "@/components/admin/order-filters";
import { Pagination } from "@/components/admin/pagination";
import { Card, StatusPill, timeAgo } from "@/components/admin/ui";
import { countTrash, DATE_PRESETS, getOrderDetail, listOrders, ORDER_STATUSES, PAGE_SIZES, SORTS, type OrderFilters as Filters } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth";
import { isReady, readSteadfastSettings } from "@/lib/courier";
import { backfillRisk, getFraudReport, readFraudSettings } from "@/lib/fraud";
import { RiskBadge } from "@/components/admin/fraud-card";
import { courierStatusLabels, isCourierReturn } from "@/lib/courier-status";
import { taka } from "@/lib/format";
import { purgeOldTrash, statusLabels } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-adm-muted">ওয়েবসাইট আর ফোনের সব অর্ডার। কোনো অর্ডারে ক্লিক করলে বিস্তারিত খুলবে।</p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <TrashLink />
          </Suspense>
          <Link href="/admin/orders/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-adm-ink px-4 text-sm font-semibold text-white hover:bg-stone-800">
            <Plus className="size-4" /> ফোন অর্ডার
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
        {searchParams.then((sp) => (
          <OrdersContent sp={sp} />
        ))}
      </Suspense>
    </div>
  );
}

async function TrashLink() {
  const n = await countTrash();
  return (
    <Link
      href="/admin/orders/trash"
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 text-sm font-semibold hover:bg-stone-50"
    >
      <Trash2 className="size-4" /> Trash{n > 0 && <span className="rounded-full bg-stone-900/10 px-1.5 text-xs tabular-nums">{n}</span>}
    </Link>
  );
}

/** Reads and validates the URL filters. Unknown values are ignored. */
function parseFilters(sp: SP): { filters: Filters; values: Record<string, string> } {
  const status = ORDER_STATUSES.find((s) => s === one(sp.status).toUpperCase());
  const source = one(sp.source) === "web" ? "WEB" : one(sp.source) === "phone" ? "PHONE" : undefined;
  const zone = one(sp.zone) === "inside" || one(sp.zone) === "outside" ? (one(sp.zone) as "inside" | "outside") : undefined;
  const date = DATE_PRESETS.find((d) => d === one(sp.date));
  const sort = SORTS.find((s) => s === one(sp.sort));
  const perPage = PAGE_SIZES.find((n) => String(n) === one(sp.per)) ?? 20;
  const q = one(sp.q).slice(0, 80) || undefined;
  const edited = one(sp.edited) === "1";
  const riskParam = one(sp.risk);
  const risk = riskParam === "risky" || riskParam === "caution" || riskParam === "safe" || riskParam === "new" ? riskParam : undefined;
  const courier = one(sp.courier) === "sent" || one(sp.courier) === "unsent" ? (one(sp.courier) as "sent" | "unsent") : undefined;
  const from = date === "custom" ? one(sp.from) || undefined : undefined;
  const to = date === "custom" ? one(sp.to) || undefined : undefined;

  const values: Record<string, string> = {};
  if (status) values.status = status.toLowerCase();
  if (q) values.q = q;
  if (source) values.source = source.toLowerCase();
  if (zone) values.zone = zone;
  if (date) values.date = date;
  if (from) values.from = from;
  if (to) values.to = to;
  if (edited) values.edited = "1";
  if (courier) values.courier = courier;
  if (risk) values.risk = risk;
  if (sort && sort !== "new") values.sort = sort;
  if (perPage !== 20) values.per = String(perPage);

  return {
    filters: { status, q, source, zone, date, from, to, sort, edited, courier, risk, perPage, page: Number(one(sp.page)) || 1 },
    values,
  };
}

async function OrdersContent({ sp }: { sp: SP }) {
  await requireAdmin();
  after(purgeOldTrash); // orders in the Trash for 30+ days are deleted for good
  after(() => backfillRisk()); // older orders get a fraud risk level
  const { filters, values } = parseFilters(sp);
  const openNo = one(sp.order);
  const [data, open, courier, fraudSettings] = await Promise.all([
    listOrders(filters),
    openNo ? getOrderDetail(openNo) : null,
    readSteadfastSettings(),
    readFraudSettings(),
  ]);
  const fraud = open && !open.deletedAt ? await getFraudReport(open.phone, fraudSettings) : null;
  const courierReady = isReady(courier);
  const kindOf = (o: (typeof data.rows)[number]): Selectable | null => (o.sent ? "sent" : o.status === "CONFIRMED" ? "send" : null);
  const selectable = data.rows.flatMap((o) => {
    const kind = kindOf(o);
    return kind ? [{ id: o.id, kind }] : [];
  });

  const href = (patch: Record<string, string | number | undefined>) => {
    const merged: Record<string, string | number | undefined> = { ...values, page: data.page > 1 ? data.page : undefined, ...patch };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  const statusOptions = [
    { value: "", label: `সব স্ট্যাটাস (${data.all})` },
    ...ORDER_STATUSES.map((s: OrderStatus) => ({ value: s.toLowerCase(), label: `${statusLabels[s]} (${data.counts[s]})` })),
  ];
  const firstRow = data.total === 0 ? 0 : (data.page - 1) * data.perPage + 1;
  const lastRow = Math.min(data.page * data.perPage, data.total);

  return (
    <>
      {/* key: reset the typed search/dates when the URL filters change (e.g. "clear all") */}
      <OrderFilters key={JSON.stringify(values)} values={values} statusOptions={statusOptions} />

      <OrderSelection key={JSON.stringify(values) + data.page}>
        <Card className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-5 py-3 text-sm">
            <p>
              <b>{data.total}</b> টি অর্ডার
              <span className="text-adm-muted">
                {" "}
                · মোট {taka(data.totalValue)}
                {!filters.status && " (বাতিল বাদে)"}
              </span>
            </p>
          </div>
          <CourierToolbar courierReady={courierReady} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                  <th className="w-10 py-3 pl-5">
                    <SelectAllCheckbox rows={selectable} />
                  </th>
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-2 py-3 font-medium">Customer</th>
                  <th className="px-2 py-3 font-medium">Delivery</th>
                  <th className="px-2 py-3 text-right font-medium">Items</th>
                  <th className="px-2 py-3 text-right font-medium">Total</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((o) => (
                  <OrderRow key={o.id} href={href({ order: o.orderNo })}>
                    <td className="py-2.5 pl-5">
                      <RowCheckbox id={o.id} kind={kindOf(o)} disabledReason="শুধু Confirmed অর্ডার কুরিয়ারে পাঠানো যায়" />
                    </td>
                    <td className={`px-3 py-2.5 font-semibold ${o.orderNo === openNo ? "text-adm-accent-strong" : ""}`}>
                      <span className="flex items-center gap-1.5">
                        {o.orderNo}
                        {o.edited && (
                          <span title="এডিট করা হয়েছে" className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-800">
                            <PencilLine className="size-3" /> Edited
                          </span>
                        )}
                        {o.sent && (
                          <span
                            title={`Steadfast · ${o.trackingCode ?? ""}${o.courierStatus ? ` · ${courierStatusLabels[o.courierStatus] ?? o.courierStatus}` : ""}`}
                            className={`inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold ${isCourierReturn(o.courierStatus) ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
                          >
                            <Truck className="size-3" /> {isCourierReturn(o.courierStatus) ? "ফেরত" : "Steadfast"}
                          </span>
                        )}
                        {o.source === "PHONE" && (
                          <span title="ফোন অর্ডার">
                            <PhoneCall className="size-3.5 text-adm-muted" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-adm-accent-soft text-xs font-bold text-adm-accent-strong">
                          {o.customerName.slice(0, 1)}
                        </span>
                        <span>
                          <span className="flex items-center gap-1.5 font-medium">
                            {o.customerName}
                            {o.riskLevel && o.riskLevel !== "safe" && o.riskLevel !== "new" && <RiskBadge level={o.riskLevel} />}
                          </span>
                          <span className="block text-xs text-adm-muted">{o.phone}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-adm-ink-soft">{o.zone === "inside" ? "ঢাকার ভিতরে" : "ঢাকার বাহিরে"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{o.items}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{taka(o.total)}</td>
                    <td className="px-2 py-2.5">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs text-adm-muted" title={new Date(o.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}>
                      {timeAgo(o.minutesAgo)}
                    </td>
                  </OrderRow>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-adm-muted">
                      এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line px-5 py-3 text-xs text-adm-muted">
            <span>
              {firstRow}–{lastRow} দেখানো হচ্ছে, মোট {data.total}টির মধ্যে
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <PerPageSelect values={values} perPage={data.perPage} />
              <Pagination page={data.page} pages={data.pages} hrefFor={(p) => href({ page: p > 1 ? p : undefined })} />
            </div>
          </div>
        </Card>
      </OrderSelection>

      {open && !open.deletedAt && <OrderDrawer
          key={JSON.stringify(open)}
          order={open}
          closeHref={href({ order: undefined })}
          fraud={fraud}
          fraudLookup={fraudSettings.enabled && !!fraudSettings.token}
        />}
      {open?.deletedAt && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          অর্ডার {openNo} এখন Trash-এ আছে।{" "}
          <Link href="/admin/orders/trash" className="font-semibold underline">
            Trash দেখুন
          </Link>
        </p>
      )}
      {openNo && !open && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">অর্ডার {openNo} পাওয়া যায়নি।</p>}
    </>
  );
}
