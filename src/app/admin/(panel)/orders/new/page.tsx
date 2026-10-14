import type { Metadata } from "next";
import { Suspense } from "react";
import { ManualOrderForm } from "@/components/admin/manual-order-form";
import { requireAdmin } from "@/lib/auth";
import { readStoreSettings, zonesFor } from "@/lib/settings";

export const metadata: Metadata = { title: "Phone order" };

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      <Guarded />
    </Suspense>
  );
}

async function Guarded() {
  await requireAdmin();
  return <ManualOrderForm zones={zonesFor(await readStoreSettings())} />;
}
