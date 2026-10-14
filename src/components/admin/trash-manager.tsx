"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { RotateCcw, Trash2 } from "lucide-react";
import { deleteOrdersForever, restoreOrders } from "@/app/admin/(panel)/orders/actions";
import { taka } from "@/lib/format";
import { Button, ConfirmModal } from "./form";
import { StatusPill } from "./ui";

export type TrashRow = {
  id: number;
  orderNo: string;
  customerName: string;
  phone: string;
  total: number;
  status: OrderStatus;
  items: string[];
  restocked: boolean;
  createdAt: string;
  deletedAt: string;
  deletedBy: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
const daysLeft = (iso: string, keepDays: number) => Math.max(0, keepDays - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export function TrashManager({ rows, canManage, keepDays }: { rows: TrashRow[]; canManage: boolean; keepDays: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [confirm, setConfirm] = useState<null | { ids: number[] | null; label: string }>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const res = await fn();
      setMessage({ ok: res.ok, text: (res.ok ? res.message : res.error) ?? "" });
      setSelected([]);
      setConfirm(null);
      router.refresh();
    });

  const restore = (ids: number[]) => run(() => restoreOrders(ids));

  return (
    <>
      {canManage && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-adm-muted">{selected.length > 0 ? `${selected.length}টি বাছাই করা` : "একসাথে কাজ করতে অর্ডার বাছাই করুন"}</span>
          <Button variant="secondary" className="h-9" disabled={pending || selected.length === 0} onClick={() => restore(selected)}>
            <RotateCcw className="size-4" /> Restore
          </Button>
          <Button
            variant="danger"
            className="h-9"
            disabled={pending || selected.length === 0}
            onClick={() => setConfirm({ ids: selected, label: `${selected.length}টি অর্ডার` })}
          >
            <Trash2 className="size-4" /> Permanent Delete
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirm({ ids: null, label: `Trash-এর সব ${rows.length}টি অর্ডার` })}
            className="ml-auto text-sm font-semibold text-red-700 hover:underline"
          >
            Trash খালি করুন
          </button>
        </div>
      )}

      {message && <p className={`rounded-xl px-4 py-3 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{message.text}</p>}

      <div className="overflow-x-auto rounded-2xl border border-white bg-adm-surface/90 shadow-sm shadow-stone-900/5">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
              {canManage && (
                <th className="w-10 py-3 pl-5">
                  <input type="checkbox" aria-label="সব বাছাই করুন" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))} />
                </th>
              )}
              <th className="px-3 py-3 font-medium">Order</th>
              <th className="px-2 py-3 font-medium">Customer</th>
              <th className="px-2 py-3 font-medium">পণ্য</th>
              <th className="px-2 py-3 text-right font-medium">Total</th>
              <th className="px-2 py-3 font-medium">Status</th>
              <th className="px-2 py-3 font-medium">ডিলিট করেছেন</th>
              {canManage && <th className="px-5 py-3 text-right font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-adm-line/70 align-top last:border-0">
                {canManage && (
                  <td className="py-3 pl-5">
                    <input type="checkbox" aria-label={`${r.orderNo} বাছাই করুন`} checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                )}
                <td className="px-3 py-3">
                  <p className="font-semibold">{r.orderNo}</p>
                  <p className="text-xs text-adm-muted">{fmt(r.createdAt)}</p>
                </td>
                <td className="px-2 py-3">
                  <p className="font-medium">{r.customerName}</p>
                  <p className="text-xs text-adm-muted">{r.phone}</p>
                </td>
                <td className="max-w-64 px-2 py-3 text-xs text-adm-ink-soft">
                  {r.items.join(", ")}
                  {r.restocked && <p className="mt-0.5 text-adm-muted">স্টকে ফেরত গেছে, Restore করলে আবার কাটা হবে</p>}
                </td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">{taka(r.total)}</td>
                <td className="px-2 py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-2 py-3 text-xs">
                  <p>{r.deletedBy ?? "—"}</p>
                  <p className="text-adm-muted">{fmt(r.deletedAt)}</p>
                  <p className="text-adm-muted">{daysLeft(r.deletedAt, keepDays)} দিন পর নিজে থেকে মুছে যাবে</p>
                </td>
                {canManage && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" className="h-8 px-2.5 text-xs" disabled={pending} onClick={() => restore([r.id])}>
                        <RotateCcw className="size-3.5" /> Restore
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-2.5 text-xs text-red-700 hover:bg-red-50"
                        disabled={pending}
                        onClick={() => setConfirm({ ids: [r.id], label: r.orderNo })}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 8 : 6} className="px-5 py-14 text-center text-adm-muted">
                  Trash খালি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`${confirm?.label ?? ""} চিরতরে মুছবেন?`}
        message={
          <>
            <b className="text-red-700">এটা আর ফেরত আনা যাবে না।</b> অর্ডারের পণ্য, কাস্টমারের তথ্য আর হিস্ট্রি সব মুছে যাবে। Stock পেজের হিস্ট্রিতে অর্ডার নম্বরসহ স্টকের রেকর্ড থেকে যাবে।
          </>
        }
        confirmLabel="চিরতরে মুছুন"
        pending={pending}
        onConfirm={() => confirm && run(() => deleteOrdersForever(confirm.ids))}
      />
    </>
  );
}
