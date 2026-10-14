"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BannerItem } from "@/lib/settings";

/** Homepage main banner slider (uploaded in Admin → Settings → Banners). Auto-advances every 5s. */
export function BannerSlider({ banners }: { banners: BannerItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count, paused]);

  return (
    <div
      className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-slate-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {banners.map((b, i) => {
        const img = (
          <Image
            src={b.image}
            alt={b.title ?? "TaqwaBazaar offer"}
            fill
            preload={i === 0}
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
          />
        );
        return (
          <div
            key={b.id}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={i !== index}
          >
            {b.link ? (
              <Link href={b.link} className="block size-full" tabIndex={i === index ? 0 : -1}>
                {img}
              </Link>
            ) : (
              img
            )}
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="আগের ব্যানার"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 shadow hover:bg-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="পরের ব্যানার"
            onClick={() => setIndex((i) => (i + 1) % count)}
            className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 shadow hover:bg-white"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`ব্যানার ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-brand" : "w-2 bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
