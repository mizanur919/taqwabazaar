"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

type Values = { q?: string; cats?: string; min?: string; max?: string; sort?: string };

/**
 * Category sidebar. Filters live in the URL and are applied by the server,
 * so only one page of products is ever sent to the browser.
 */
export function CategorySidebar({
  values,
  categories,
}: {
  values: Values;
  categories: { id: number; name: string; count: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(values.q ?? "");
  const [min, setMin] = useState(values.min ?? "");
  const [max, setMax] = useState(values.max ?? "");
  const selected = (values.cats ?? "").split(",").filter(Boolean);

  const go = (patch: Values) => {
    const next = { ...values, ...patch };
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    const s = params.toString();
    startTransition(() => router.push(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
  };

  return (
    <aside className="h-fit space-y-6 rounded-xl border border-line bg-white p-4 md:sticky md:top-36">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
      >
        <p className="mb-2 text-sm font-semibold">Search Products</p>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find your product..."
            className="h-9 w-full min-w-0 rounded-md border border-line px-2.5 text-sm outline-none focus:border-brand"
          />
          <button type="submit" aria-label="খুঁজুন" className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-white">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </button>
        </div>
      </form>

      {categories.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Categories</p>
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(String(c.id))}
                    onChange={(e) =>
                      go({
                        cats: (e.target.checked ? [...selected, String(c.id)] : selected.filter((id) => id !== String(c.id))).join(","),
                      })
                    }
                    className="size-4 accent-brand"
                  />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted">({c.count})</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ min, max });
        }}
      >
        <p className="mb-2 text-sm font-semibold">Price Range</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">৳</span>
          <input
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            className="h-9 w-full min-w-0 rounded-md border border-line px-2 outline-none focus:border-brand"
          />
          <span className="text-muted">-</span>
          <input
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
            placeholder="Max"
            className="h-9 w-full min-w-0 rounded-md border border-line px-2 outline-none focus:border-brand"
          />
        </div>
        <button type="submit" className="mt-2 h-8 w-full rounded-md border border-ink text-xs font-semibold hover:bg-ink hover:text-white">
          দাম অনুযায়ী দেখান
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setQ("");
          setMin("");
          setMax("");
          startTransition(() => router.push(pathname, { scroll: false }));
        }}
        className="text-sm font-semibold text-brand hover:underline"
      >
        Reset All
      </button>
    </aside>
  );
}
