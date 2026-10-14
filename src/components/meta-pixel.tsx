"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { initPixel, track } from "@/lib/meta-pixel";
import type { PixelConfig } from "@/lib/meta";

/** Facebook Pixel for the storefront (not the admin panel). Renders nothing. */
export function MetaPixel({ config }: { config: PixelConfig }) {
  useEffect(() => {
    initPixel(config.pixelId, config.capi);
  }, [config.pixelId, config.capi]);

  useEffect(() => {
    if (!config.pixelId) return;
    // WhatsApp and phone links anywhere on the site count as Contact
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") ?? "";
      if (href.startsWith("tel:") || /wa\.me|whatsapp\.com/.test(href)) track("Contact");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [config.pixelId]);

  // useSearchParams needs a Suspense boundary so the rest of the page can still be prerendered
  return (
    <Suspense fallback={null}>
      <PageViews />
    </Suspense>
  );
}

/** One PageView per page, including client-side navigations (the page itself never reloads). */
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const url = `${pathname}?${search}`;
    if (sent.current === url) return; // dev Strict Mode runs effects twice
    sent.current = url;
    track("PageView", {}, { server: false });
  }, [pathname, search]);
  return null;
}
