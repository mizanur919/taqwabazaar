import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderEditForm } from "@/components/admin/order-edit-form";
import { getOrderDetail } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth";
import { readStoreSettings, zonesFor } from "@/lib/settings";

export const metadata: Metadata = { title: "Edit order" };

export default function EditOrderPage({ params }: PageProps<"/admin/orders/[orderNo]/edit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-stone-900/5" />}>
      {params.then(({ orderNo }) => (
        <EditContent orderNo={decodeURIComponent(orderNo)} />
      ))}
    </Suspense>
  );
}

async function EditContent({ orderNo }: { orderNo: string }) {
  await requireAdmin();
  const [order, settings] = await Promise.all([getOrderDetail(orderNo), readStoreSettings()]);
  if (!order || order.deletedAt) notFound();
  if (!order.editable) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-adm-line bg-white p-8 text-center">
        <h1 className="text-lg font-bold">{order.orderNo} এডিট করা যাবে না</h1>
        <p className="mt-2 text-sm text-adm-muted">শুধু New বা Confirmed অর্ডার এডিট করা যায়। Shipped বা Delivered অর্ডারের পার্সেল আগেই বেরিয়ে গেছে, আর Cancelled অর্ডার আগে আবার চালু করতে হবে।</p>
        <Link href={`/admin/orders?order=${order.orderNo}`} className="mt-5 inline-flex h-10 items-center rounded-lg bg-adm-ink px-4 text-sm font-semibold text-white">
          অর্ডারে ফিরে যান
        </Link>
      </div>
    );
  }
  return <OrderEditForm order={order} zones={zonesFor(settings)} />;
}
