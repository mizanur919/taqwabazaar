"use client";

import { useEffect, useRef } from "react";
import { contentsOf, track } from "@/lib/meta-pixel";

/** ViewContent once per product page view. */
export function TrackViewContent({ id, name, price, category }: { id: number; name: string; price: number; category: string }) {
  const sent = useRef<number | null>(null);
  useEffect(() => {
    if (sent.current === id) return; // dev Strict Mode runs effects twice
    sent.current = id;
    track("ViewContent", { ...contentsOf([{ id, qty: 1, price }]), content_name: name, content_category: category });
  }, [id, name, price, category]);
  return null;
}

/** Search once per query. */
export function TrackSearch({ query, resultIds }: { query: string; resultIds: number[] }) {
  const ids = resultIds.slice(0, 10).join(",");
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!query || sent.current === query) return;
    sent.current = query;
    track("Search", {
      search_string: query,
      content_type: "product",
      content_ids: ids ? ids.split(",") : [],
    });
  }, [query, ids]);
  return null;
}
