"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { Package, Plus, Search } from "lucide-react";
import { findProductsForOrder, type PickerProduct } from "@/app/admin/(panel)/orders/actions";
import { taka } from "@/lib/format";
import { Button } from "./form";

export type PickedVariant = PickerProduct["variants"][number];

/** Product search used by the phone-order and order-edit forms. */
export function ProductPicker({ onAdd }: { onAdd: (p: PickerProduct, v?: PickedVariant) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => startSearch(async () => setResults(await findProductsForOrder(q))), 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-adm-line bg-white px-3 focus-within:border-adm-accent-strong">
        <Search className="size-4 text-adm-muted" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) setResults([]);
          }}
          placeholder="প্রোডাক্টের নাম বা SKU লিখুন"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>
      {query.trim().length >= 2 && (
        <ul className="mt-2 divide-y divide-adm-line rounded-lg border border-adm-line bg-white">
          {searching && results.length === 0 && <li className="px-3 py-2 text-sm text-adm-muted">খোঁজা হচ্ছে...</li>}
          {!searching && results.length === 0 && <li className="px-3 py-2 text-sm text-adm-muted">কিছু পাওয়া যায়নি</li>}
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-adm-line bg-white">
                {p.image ? <Image src={p.image} alt="" fill sizes="40px" className="object-contain p-0.5" /> : <Package className="m-auto mt-2.5 size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-adm-muted">
                  {taka(p.price)} · স্টক {p.stock}
                </p>
              </div>
              {p.variants.length === 0 ? (
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={p.stock <= 0} onClick={() => onAdd(p)}>
                  <Plus className="size-3.5" /> যোগ
                </Button>
              ) : (
                <div className="flex flex-wrap justify-end gap-1">
                  {p.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.stock <= 0}
                      onClick={() => onAdd(p, v)}
                      className="rounded-md border border-adm-line px-2 py-1 text-xs hover:border-adm-accent-strong disabled:opacity-40"
                    >
                      + {v.name}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
