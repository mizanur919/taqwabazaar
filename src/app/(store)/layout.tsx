import { Footer, WhatsAppButton } from "@/components/footer";
import { Header } from "@/components/header";
import { MetaPixel } from "@/components/meta-pixel";
import { StoreProvider } from "@/components/store-provider";
import { getPixelConfig } from "@/lib/meta";
import { getStoreSettings, zonesFor } from "@/lib/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, pixel] = await Promise.all([getStoreSettings(), getPixelConfig()]);
  return (
    <StoreProvider
      buyNowMode={settings.buyNowMode}
      zones={zonesFor(settings)}
      contact={{ phone: settings.phone, whatsapp: settings.whatsapp }}
    >
      <Header phone={settings.phone} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
      <WhatsAppButton number={settings.whatsapp} />
      <MetaPixel config={pixel} />
    </StoreProvider>
  );
}