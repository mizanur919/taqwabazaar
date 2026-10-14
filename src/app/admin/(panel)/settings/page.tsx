import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutSettings } from "@/components/admin/checkout-settings";
import { AccountForm } from "@/components/admin/settings/account-form";
import { AppearanceSettings } from "@/components/admin/settings/appearance";
import { BannersManager } from "@/components/admin/settings/banners-manager";
import { CourierForm } from "@/components/admin/settings/courier-form";
import { FraudForm } from "@/components/admin/settings/fraud-form";
import { MarketingForm } from "@/components/admin/settings/marketing-form";
import { PagesEditor } from "@/components/admin/settings/pages-editor";
import { StoreInfoForm } from "@/components/admin/settings/store-info-form";
import { TeamManager } from "@/components/admin/settings/team-manager";
import { requireAdmin } from "@/lib/auth";
import { readSteadfastSettings } from "@/lib/courier";
import { readFraudSettings } from "@/lib/fraud";
import { readMetaSettings } from "@/lib/meta";
import { prisma } from "@/lib/prisma";
import { readAllInfoPages, readStoreSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "store", label: "Store", ownerOnly: true },
  { id: "banners", label: "Banners", ownerOnly: true },
  { id: "pages", label: "Pages", ownerOnly: true },
  { id: "marketing", label: "Marketing", ownerOnly: true },
  { id: "courier", label: "Courier", ownerOnly: true },
  { id: "fraud", label: "Fraud Check", ownerOnly: true },
  { id: "team", label: "Team", ownerOnly: true },
  { id: "account", label: "Account", ownerOnly: false },
  { id: "appearance", label: "Appearance", ownerOnly: false },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-adm-muted">স্টোরের তথ্য, ব্যানার, পেজ, মার্কেটিং, কুরিয়ার, টিম আর আপনার অ্যাকাউন্ট</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-stone-900/5" />}>
        {searchParams.then((sp) => (
          <SettingsContent requested={String(sp.tab ?? "")} />
        ))}
      </Suspense>
    </div>
  );
}

async function SettingsContent({ requested }: { requested: string }) {
  const admin = await requireAdmin();
  await connection();
  const isOwner = admin.role === "ADMIN";
  const visible = TABS.filter((t) => isOwner || !t.ownerOnly);
  const tab = (visible.find((t) => t.id === requested) ?? visible[0]).id as Tab;

  return (
    <>
      <nav className="flex gap-1 overflow-x-auto border-b border-adm-line">
        {visible.map((t) => (
          <Link
            key={t.id}
            href={`/admin/settings?tab=${t.id}`}
            scroll={false}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold whitespace-nowrap ${tab === t.id ? "border-adm-ink text-adm-ink" : "border-transparent text-adm-muted hover:text-adm-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <TabBody tab={tab} meId={admin.id} />
    </>
  );
}

async function TabBody({ tab, meId }: { tab: Tab; meId: number }) {
  switch (tab) {
    case "store": {
      const s = await readStoreSettings();
      return (
        <div className="space-y-5">
          <StoreInfoForm
            initial={{
              phone: s.phone,
              whatsapp: s.whatsapp.startsWith("88") ? s.whatsapp.slice(2) : s.whatsapp,
              email: s.email,
              address: s.address,
              insideFee: String(s.insideFee),
              outsideFee: String(s.outsideFee),
            }}
          />
          <CheckoutSettings initial={{ buyNowMode: s.buyNowMode }} />
        </div>
      );
    }
    case "banners": {
      const banners = await prisma.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
      return <BannersManager banners={banners.map((b) => ({ id: b.id, position: b.position, image: b.image, title: b.title, link: b.link, isActive: b.isActive }))} />;
    }
    case "pages":
      return <PagesEditor pages={await readAllInfoPages()} />;
    case "marketing": {
      const m = await readMetaSettings();
      // only the token's last 4 characters ever reach the browser
      return <MarketingForm initial={{ enabled: m.enabled, pixelId: m.pixelId, testCode: m.testCode }} tokenEnd={m.token.slice(-4)} />;
    }
    case "courier": {
      const [c, h] = await Promise.all([readSteadfastSettings(), headers()]);
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? "taqwabazaar.com";
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      // only the keys last 4 characters ever reach the browser
      return (
        <CourierForm
          enabled={c.enabled}
          apiKeyEnd={c.apiKey.slice(-4)}
          secretKeyEnd={c.secretKey.slice(-4)}
          webhookUrl={`${proto}://${host}/api/courier/steadfast`}
          webhookToken={c.webhookToken}
          lastWebhookAt={c.lastWebhookAt}
        />
      );
    }
    case "fraud": {
      const [f, blocked] = await Promise.all([readFraudSettings(), prisma.blockedPhone.findMany({ orderBy: { createdAt: "desc" }, take: 500 })]);
      return (
        <FraudForm
          initial={{ enabled: f.enabled, safeAt: String(f.safeAt), riskyBelow: String(f.riskyBelow), minParcels: String(f.minParcels) }}
          tokenEnd={f.token.slice(-4)}
          blocked={blocked.map((b) => ({ phone: b.phone, reason: b.reason, blockedBy: b.blockedBy, createdAt: b.createdAt.toISOString() }))}
        />
      );
    }
    case "team": {
      const team = await prisma.adminUser.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
      return (
        <TeamManager
          meId={meId}
          team={team.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, isActive: m.isActive, lastLoginAt: m.lastLoginAt?.toISOString() ?? null }))}
        />
      );
    }
    case "account": {
      const me = await prisma.adminUser.findUniqueOrThrow({ where: { id: meId } });
      return <AccountForm initial={{ name: me.name, email: me.email, role: me.role }} />;
    }
    case "appearance":
      return <AppearanceSettings />;
  }
}
