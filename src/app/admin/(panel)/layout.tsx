import type { Metadata } from "next";
import { Suspense } from "react";
import { themeBootScript } from "@/lib/admin-theme";
import { AdminSidebar } from "@/components/admin/sidebar";
import { getSidebarCounts } from "@/lib/admin/overview";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | TaqwaBazaar Admin" },
  robots: { index: false, follow: false },
};

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-theme min-h-screen bg-adm-bg bg-[radial-gradient(ellipse_at_top_right,var(--adm-glow)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_left,var(--adm-glow-2)_0%,transparent_45%)]">
      {/* applies the saved accent / dark mode before the first paint (Settings → Appearance) */}
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      <div className="adm-veil flex min-h-screen w-full flex-col lg:flex-row">
        <Suspense fallback={<aside className="hidden w-60 shrink-0 border-r border-adm-line lg:block" />}>
          <SidebarWithData />
        </Suspense>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Suspense fallback={<PanelSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function SidebarWithData() {
  const admin = await requireAdmin();
  const counts = await getSidebarCounts();
  return <AdminSidebar user={{ name: admin.name, role: admin.role }} {...counts} />;
}

function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-stone-900/5" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-stone-900/5 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-stone-900/5" />
      </div>
    </div>
  );
}
