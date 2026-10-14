"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { searchSuggestions } from "@/app/actions";
import type { ProductCard } from "@/lib/catalog";
import { taka } from "@/lib/format";

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductCard[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const found = await searchSuggestions(q);
        setResults(found);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit} role="search">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 focus-within:border-brand focus-within:bg-white">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Type to start searching..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            aria-label="পণ্য খুঁজুন"
          />
        </label>
      </form>

      {showDropdown && (
        <div className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-lg border border-line bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">কোনো পণ্য পাওয়া যায়নি</p>
          ) : (
            <>
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0 hover:bg-slate-50"
                >
                  <div className="relative size-11 shrink-0 overflow-hidden rounded border border-line bg-white">
                    {p.image && <Image src={p.image} alt="" fill sizes="44px" className="object-contain p-0.5" />}
                  </div>
                  <span className="line-clamp-1 flex-1 text-sm">{p.name}</span>
                  <span className="text-right text-xs">
                    {p.salePrice !== null && (
                      <span className="block text-muted line-through">{taka(p.price)}</span>
                    )}
                    <span className="font-semibold text-brand">{taka(p.salePrice ?? p.price)}</span>
                  </span>
                </Link>
              ))}
              <button
                type="button"
                onClick={submit}
                className="block w-full bg-brand py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
              >
                সব ফলাফল দেখুন
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
