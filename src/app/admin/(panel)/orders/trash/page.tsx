import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { TrashManager } from "@/components/admin/trash-manager";
import { listTrash } from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth";
import { purgeOldTrash, TRASH_DAYS } from "@/lib/orders";

export const metadata: Metadata = { title: "Trash" };

export default function TrashPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" aria-label="অর্ডার তালিকায় ফিরে যান" className="rounded-lg border border-adm-line bg-white p-2 hover:bg-stone-50">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Trash</h1>
          <p className="text-sm text-adm-muted">ডিলিট করা অর্ডার। {TRASH_DAYS} দিন পর নিজে থেকে চিরতরে মুছে যায়। এগুলো কোনো রিপোর্ট বা হিসাবে আসে না।</p>
        </div>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-stone-900/5" />}>
        <TrashContent />
      </Suspense>
    </div>
  );
}

async function TrashContent() {
  const admin = await requireAdmin();
  after(purgeOldTrash);
  const rows = await listTrash();
  const canManage = admin.role === "ADMIN";
  return (
    <>
      {!canManage && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">শুধু Administrator অর্ডার ফেরত আনতে বা চিরতরে মুছতে পারবেন।</p>
      )}
      <TrashManager rows={rows} canManage={canManage} keepDays={TRASH_DAYS} />
    </>
  );
}
