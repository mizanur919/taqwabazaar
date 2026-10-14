"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

type Values = Record<string, string>;

export type FilterOption = { value: string; label: string };

const selectClass =
  "h-9 rounded-lg border border-adm-line bg-white px-2.5 text-sm outline-none focus:border-adm-accent-strong focus:ring-2 focus:ring-adm-accent/30";

/**
 * Order list filters. Every change updates the URL (so filters survive refresh and can be shared)
 * and goes back to page 1.
 */
export function OrderFilters({
  values,
  statusOptions,
}: {
  values: Values;
  statusOptions: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(values.q ?? "");
  const [from, setFrom] = useState(values.from ?? "");
  const [to, setTo] = useState(values.to ?? "");

  const apply = (patch: Values) => {
    const next = { ...values, ...patch };
    delete next.page;
    delete next.order;
    if (next.date !== "custom") {
      delete next.from;
      delete next.to;
    }
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    const s = params.toString();
    startTransition(() => router.push(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
  };

  const active = ["status", "q", "source", "zone", "date", "edited", "courier", "risk"].some((k) => values[k]);

  const select = (name: string, label: string, options: FilterOption[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-adm-muted">{label}</span>
      <select value={values[name] ?? ""} onChange={(e) => apply({ [name]: e.target.value })} className={selectClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="rounded-2xl border border-white bg-adm-surface/90 p-4 shadow-sm shadow-stone-900/5">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-60 flex-1 flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: q.trim() });
          }}
        >
          <span className="text-[11px] font-medium text-adm-muted">খুঁজুন</span>
          <span className="flex h-9 items-center gap-2 rounded-lg border border-adm-line bg-white px-2.5 focus-within:border-adm-accent-strong">
            <Search className="size-4 text-adm-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="অর্ডার নং, নাম, ফোন বা ঠিকানা লিখে Enter চাপুন"
              className="w-full bg-transparent text-sm outline-none"
            />
            {q && (
              <button
                type="button"
                aria-label="খোঁজা মুছুন"
                onClick={() => {
                  setQ("");
                  apply({ q: "" });
                }}
                className="text-adm-muted hover:text-adm-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </span>
        </form>

        {select("status", "স্ট্যাটাস", statusOptions)}
        {select("date", "তারিখ", [
          { value: "", label: "সব সময়" },
          { value: "today", label: "আজ" },
          { value: "yesterday", label: "গতকাল" },
          { value: "7d", label: "শেষ ৭ দিন" },
          { value: "30d", label: "শেষ ৩০ দিন" },
          { value: "month", label: "এই মাস" },
          { value: "custom", label: "নিজে বাছাই করুন..." },
        ])}
        {select("source", "অর্ডার এসেছে", [
          { value: "", label: "সব জায়গা থেকে" },
          { value: "web", label: "ওয়েবসাইট" },
          { value: "phone", label: "ফোন" },
        ])}
        {select("zone", "ডেলিভারি", [
          { value: "", label: "সব জোন" },
          { value: "inside", label: "ঢাকার ভিতরে" },
          { value: "outside", label: "ঢাকার বাহিরে" },
        ])}
        {select("risk", "ঝুঁকি", [
          { value: "", label: "সব" },
          { value: "risky", label: "🔴 ঝুঁকিপূর্ণ ও ব্লক" },
          { value: "caution", label: "🟡 সতর্ক থাকুন" },
          { value: "safe", label: "🟢 নিরাপদ" },
          { value: "new", label: "⚪ নতুন কাস্টমার" },
        ])}
        {select("courier", "কুরিয়ার", [
          { value: "", label: "সব" },
          { value: "sent", label: "পাঠানো হয়েছে" },
          { value: "unsent", label: "পাঠানো হয়নি" },
        ])}
        {select("edited", "এডিট", [
          { value: "", label: "সব অর্ডার" },
          { value: "1", label: "শুধু এডিট করা" },
        ])}
        {select("sort", "সাজান", [
          { value: "", label: "নতুন আগে" },
          { value: "old", label: "পুরোনো আগে" },
          { value: "high", label: "বেশি টাকা আগে" },
          { value: "low", label: "কম টাকা আগে" },
        ])}

        {pending && <Loader2 className="mb-2 size-4 animate-spin text-adm-muted" />}
        {active && (
          <button type="button" onClick={() => router.push(pathname, { scroll: false })} className="mb-2 text-sm font-semibold text-adm-accent-strong hover:underline">
            সব ফিল্টার মুছুন
          </button>
        )}
      </div>

      {values.date === "custom" && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3 border-t border-adm-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ from, to });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-adm-muted">শুরু</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-adm-muted">শেষ</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={selectClass} />
          </label>
          <button type="submit" className="h-9 rounded-lg bg-adm-ink px-4 text-sm font-semibold text-white hover:bg-stone-800">
            দেখান
          </button>
        </form>
      )}
    </div>
  );
}

/** "Show 20 / 50 / 100 per page" selector. */
export function PerPageSelect({ values, perPage }: { values: Values; perPage: number }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex items-center gap-2">
      প্রতি পেজে
      <select
        value={perPage}
        onChange={(e) => {
          // values never contains "page", so changing page size always restarts at page 1
          const next: Values = { ...values, per: e.target.value === "20" ? "" : e.target.value };
          const s = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
          router.push(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
        }}
        className="h-8 rounded-md border border-adm-line bg-white px-1.5 text-xs"
      >
        {[20, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
