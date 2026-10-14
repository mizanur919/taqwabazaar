import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer, WhatsAppButton } from "@/components/footer";
import { Header } from "@/components/header";
import { MetaPixel } from "@/components/meta-pixel";
import { MobileNav } from "@/components/mobile-nav";
import { StoreProvider } from "@/components/store-provider";
import { getLayout, getStoreLayout } from "@/lib/layout";
import { getPixelConfig } from "@/lib/meta";
import { getStoreSettings, zonesFor } from "@/lib/settings";

/** Favicon uploaded in Admin → Settings → Header & Footer (the default icon otherwise). */
export async function generateMetadata(): Promise<Metadata> {
  const { favicon } = await getLayout();
  return favicon ? { icons: { icon: favicon } } : {};
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, pixel, { layout, header, footer }] = await Promise.all([getStoreSettings(), getPixelConfig(), getStoreLayout()]);
  return (
    <StoreProvider
      buyNowMode={settings.buyNowMode}
      zones={zonesFor(settings)}
      contact={{ phone: settings.phone, whatsapp: settings.whatsapp }}
    >
      <Header phone={settings.phone} nav={header} layout={layout} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} columns={footer} layout={layout} />
      {/* with the bottom bar, WhatsApp is one of its buttons on phones */}
      <WhatsAppButton number={settings.whatsapp} hideOnMobile={layout.mobileNav} />
      {layout.mobileNav && (
        <>
          {/* keeps the page bottom clear of the fixed bar; outside Suspense so nothing shifts */}
          <div className="h-16 md:hidden" aria-hidden="true" />
          {/* reads the current path, so it renders on request instead of in the static shell */}
          <Suspense fallback={null}>
            <MobileNav nav={header} />
          </Suspense>
        </>
      )}
      <MetaPixel config={pixel} />
    </StoreProvider>
  );
}
