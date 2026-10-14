"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800"
    >
      <Printer className="size-4" /> প্রিন্ট করুন
    </button>
  );
}
