"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProductGallery({ images, name, badge }: { images: string[]; name: string; badge?: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
        {badge && (
          <span className="absolute right-3 top-3 z-10 rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
        {count > 0 && (
          <Image
            src={images[index]}
            alt={name}
            fill
            preload={index === 0}
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-contain p-6"
          />
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="আগের ছবি"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white shadow hover:text-brand"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="পরের ছবি"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white shadow hover:text-brand"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`ছবি ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-white ${
                i === index ? "border-brand" : "border-line hover:border-brand/50"
              }`}
            >
              <Image src={src} alt="" fill sizes="90px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
