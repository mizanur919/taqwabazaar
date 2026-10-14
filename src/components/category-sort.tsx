"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const options = [
  { value: "", label: "ডিফল্ট" },
  { value: "new", label: "নতুন আগে" },
  { value: "price_asc", label: "দাম: কম থেকে বেশি" },
  { value: "price_desc", label: "দাম: বেশি থেকে কম" },
];

export function CategorySort({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <label className={`flex items-center gap-2 text-sm ${pending ? "opacity-60" : ""}`}>
      <span className="text-muted">সাজান</span>
      <select
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set("sort", e.target.value);
          else params.delete("sort");
          params.delete("page"); // new order starts from the first page
          const s = params.toString();
          startTransition(() => router.push(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
        }}
        className="h-9 rounded-md border border-line bg-white px-2 text-sm outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
