"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Eye, EyeOff, Star } from "lucide-react";
import { toggleProductFlag } from "@/app/admin/(panel)/products/actions";

export function ProductFlagButtons({ id, isActive, isFeatured }: { id: number; isActive: boolean; isFeatured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toggle = (flag: "isActive" | "isFeatured") =>
    startTransition(async () => {
      await toggleProductFlag(id, flag);
      router.refresh();
    });

  return (
    <div className={`flex items-center gap-1 ${pending ? "opacity-50" : ""}`}>
      <button
        type="button"
        disabled={pending}
        onClick={() => toggle("isActive")}
        title={isActive ? "স্টোর থেকে লুকান" : "স্টোরে দেখান"}
        aria-label={isActive ? "স্টোর থেকে লুকান" : "স্টোরে দেখান"}
        className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink"
      >
        {isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => toggle("isFeatured")}
        title={isFeatured ? "Featured থেকে সরান" : "Featured করুন"}
        aria-label={isFeatured ? "Featured থেকে সরান" : "Featured করুন"}
        className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink"
      >
        <Star className={`size-4 ${isFeatured ? "fill-adm-accent text-adm-accent-strong" : ""}`} />
      </button>
    </div>
  );
}
