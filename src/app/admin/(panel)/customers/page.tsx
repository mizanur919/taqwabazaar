import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Search } from "lucide-react";
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select";
import { CustomerDrawer, CustomerRowLink, CustomerTag } from "@/components/admin/customer-drawer";
import { Pagination } from "@/components/admin/pagination";
import { Card, timeAgo } from "@/components/admin/ui";
import { CUSTOMER_SORTS, CUSTOMER_TABS, getCustomer, listCustomers, type CustomerTab } from "@/lib/admin/customers";
import { requireAdmin } from "@/lib/auth";
import { taka } from "@/lib/format";
import { normalizePhone } from "@/lib/orders";

export const metadata: Metadata = { title: "Customers" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

const tabLabels: Record<CustomerTab, string> = { all: "সব", new: "নতুন", repeat: "নিয়মিত", risky: "ঝুঁকিপূর্ণ" };

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-adm-muted">যারা অর্ডার করেছেন, ফোন নাম্বার অনুযায়ী। কাস্টমারে ক্লিক করলে তার সব অর্ডার দেখাবে।</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
        {searchParams.then((sp) => (
          <CustomersContent sp={sp} />
        ))}
      </Suspense>
    </div>
  );
}

async function CustomersContent({ sp }: { sp: SP }) {
  await requireAdmin();
  const tab = CUSTOMER_TABS.find((t) => t === one(sp.tab)) ?? "all";
  const sort = CUSTOMER_SORTS.find((s) => s === one(sp.sort)) ?? "recent";
  const q = one(sp.q).slice(0, 80) || undefined;
  const openPhone = normalizePhone(one(sp.phone));

  const [data, open] = await Promise.all([
    listCustomers({ tab, q, sort, page: Number(one(sp.page)) || 1 }),
    openPhone ? getCustomer(openPhone) : null,
  ]);

  const values: Record<string, string | undefined> = { tab: tab === "all" ? undefined : tab, q, sort: sort === "recent" ? undefined : sort };
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...values, page: data.page > 1 ? data.page : undefined, ...patch })) if (v) params.set(k, String(v));
    const s = params.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };
  const exportHref = `/admin/customers/export?${new URLSearchParams(Object.entries({ tab: values.tab, q }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-stone-900/5 p-0.5 text-sm">
          {CUSTOMER_TABS.map((t) => (
            <Link
              key={t}
              href={href({ tab: t === "all" ? undefined : t, page: undefined, phone: undefined })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === t ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}
            >
              {tabLabels[t]}
              <span className={`text-xs ${tab === t ? "text-white/70" : "text-adm-muted"}`}>{data.counts[t]}</span>
            </Link>
          ))}
        </div>

        <form action="/admin/customers" className="ml-auto flex flex-wrap gap-2">
          {values.tab && <input type="hidden" name="tab" value={values.tab} />}
          <label className="flex h-9 items-center gap-2 rounded-lg border border-adm-line bg-white px-2.5">
            <Search className="size-4 text-adm-muted" />
            <input name="q" defaultValue={q} placeholder="নাম বা ফোন" className="w-40 bg-transparent text-sm outline-none" />
          </label>
          <AutoSubmitSelect name="sort" defaultValue={sort} aria-label="সাজান" className="h-9 rounded-lg border border-adm-line bg-white px-2 text-sm">
            <option value="recent">সাম্প্রতিক অর্ডার আগে</option>
            <option value="spent">বেশি কেনাকাটা আগে</option>
            <option value="orders">বেশি অর্ডার আগে</option>
          </AutoSubmitSelect>
          <button type="submit" className="h-9 rounded-lg bg-adm-ink px-3 text-sm font-semibold text-white">
            খুঁজুন
          </button>
          <a href={exportHref} className="flex h-9 items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 text-sm font-medium hover:bg-stone-50">
            <Download className="size-4" /> CSV
          </a>
        </form>
      </div>

      {tab === "risky" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          ঝুঁকিপূর্ণ: ২ বা তার বেশি অর্ডার বাতিল করেছেন, অথবা তাদের অর্ধেক বা তার বেশি অর্ডার বাতিল হয়েছে। এদের নতুন অর্ডার কনফার্ম করার আগে কল করে নিন।
        </p>
      )}

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-2 py-3 text-right font-medium">Orders</th>
                <th className="px-2 py-3 text-right font-medium">Delivered</th>
                <th className="px-2 py-3 text-right font-medium">Cancelled</th>
                <th className="px-2 py-3 text-right font-medium">Spent</th>
                <th className="px-2 py-3 font-medium">Tag</th>
                <th className="px-5 py-3 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((c) => (
                <CustomerRowLink key={c.phone} href={href({ phone: c.phone })}>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-adm-accent-soft text-xs font-bold text-adm-accent-strong">{c.name.slice(0, 1)}</span>
                      <span className="min-w-0">
                        <span className={`block truncate font-semibold ${c.phone === openPhone ? "text-adm-accent-strong" : ""}`}>{c.name}</span>
                        <span className="block text-xs text-adm-muted">{c.phone}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{c.orders}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{c.delivered}</td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${c.cancelled ? "font-semibold text-red-700" : ""}`}>{c.cancelled}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{taka(c.spent)}</td>
                  <td className="px-2 py-2.5">
                    <CustomerTag tag={c.tag} />
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-adm-muted">{timeAgo(c.minutesAgo)}</td>
                </CustomerRowLink>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-adm-muted">
                    কোনো কাস্টমার পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line px-5 py-3 text-xs text-adm-muted">
          <span>মোট {data.total} জন কাস্টমার</span>
          <Pagination page={data.page} pages={data.pages} hrefFor={(p) => href({ page: p > 1 ? p : undefined, phone: undefined })} />
        </div>
      </Card>

      {open && <CustomerDrawer key={open.phone} customer={open} closeHref={href({ phone: undefined })} />}
      {openPhone && !open && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{openPhone} নাম্বারে কোনো অর্ডার পাওয়া যায়নি।</p>}
    </>
  );
}
