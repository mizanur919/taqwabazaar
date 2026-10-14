"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import type { OrderStatus } from "@prisma/client";
import { Check, Copy, FileText, MapPin, Package, PencilLine, Phone, Printer, RefreshCw, StickyNote, Trash2, Truck, Undo2, X } from "lucide-react";
import {
  confirmCourierReturn,
  moveOrderToTrash,
  refreshCourierStatuses,
  saveAdminNote,
  updateOrderStatus,
} from "@/app/admin/(panel)/orders/actions";
import { courierStatusLabels, isCourierReturn } from "@/lib/courier-status";
import type { OrderDetail } from "@/lib/admin/orders";
import type { FraudReport } from "@/lib/fraud";
import { FraudCard } from "./fraud-card";
import { taka } from "@/lib/format";
import { deliveryZones } from "@/lib/site";
import { Button, ConfirmModal, TextArea } from "./form";
import { StatusPill } from "./ui";

/** Clickable table row that opens the order drawer. */
export function OrderRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href, { scroll: false })}
      className="cursor-pointer border-b border-adm-line/70 last:border-0 hover:bg-stone-900/[0.03]"
    >
      {children}
    </tr>
  );
}

const flow: { status: OrderStatus; label: string; action: string }[] = [
  { status: "PENDING", label: "New", action: "" },
  { status: "CONFIRMED", label: "Confirmed", action: "কনফার্ম করুন" },
  { status: "SHIPPED", label: "Shipped", action: "Mark as shipped" },
  { status: "DELIVERED", label: "Delivered", action: "Mark as delivered" },
];

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });

export function OrderDrawer({
  order,
  closeHref,
  fraud,
  fraudLookup,
}: {
  order: OrderDetail;
  closeHref: string;
  fraud: FraudReport | null;
  fraudLookup: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(order.adminNote);
  const [noteSaved, setNoteSaved] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [courierNote, setCourierNote] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !confirmCancel && !confirmTrash && !confirmReturn && router.push(closeHref, { scroll: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router, confirmCancel, confirmTrash, confirmReturn]);

  const step = flow.findIndex((f) => f.status === order.status);
  const next = step >= 0 && step < flow.length - 1 ? flow[step + 1] : null;
  const zone = deliveryZones.find((z) => z.id === order.zone)?.label ?? order.zone;

  const setStatus = (status: OrderStatus) =>
    startTransition(async () => {
      setError(null);
      const res = await updateOrderStatus(order.id, status);
      if (!res.ok) setError(res.error);
      setConfirmCancel(false);
      router.refresh();
    });

  const trash = () =>
    startTransition(async () => {
      setError(null);
      const res = await moveOrderToTrash(order.id);
      setConfirmTrash(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(closeHref, { scroll: false });
      router.refresh();
    });

  const refreshCourier = () =>
    startTransition(async () => {
      setError(null);
      const res = await refreshCourierStatuses([order.id]);
      setCourierNote(res.message);
      router.refresh();
    });

  const parcelReturned = () =>
    startTransition(async () => {
      setError(null);
      const res = await confirmCourierReturn(order.id);
      setConfirmReturn(false);
      if (!res.ok) setError(res.error);
      router.refresh();
    });

  // Portal to <body>: the panel layout uses backdrop-blur, which would trap a fixed element inside it.
  if (!mounted) return null;
  return createPortal(
    <div className="admin-theme fixed inset-0 z-40">
      <Link href={closeHref} scroll={false} aria-label="বন্ধ করুন" className="absolute inset-0 bg-stone-900/20 backdrop-blur-[1px]" />
      <aside
        className="admin-theme absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-adm-line bg-adm-surface shadow-2xl"
        role="dialog"
        aria-label={`Order ${order.orderNo}`}
      >
        <div className="flex items-start justify-between border-b border-adm-line px-5 py-4">
          <div>
            <p className="text-xs text-adm-muted">{fmtTime(order.createdAt)} · {order.source === "PHONE" ? "ফোন অর্ডার" : "ওয়েবসাইট"}</p>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              Order {order.orderNo}
              {order.editedAt && (
                <span title={`শেষ এডিট: ${fmtTime(order.editedAt)}`} className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
                  <PencilLine className="size-3" /> Edited
                </span>
              )}
            </h2>
            <div className="mt-1.5 flex gap-1.5">
              {order.editable ? (
                <Link
                  href={`/admin/orders/${order.orderNo}/edit`}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-adm-line bg-white px-2 text-xs font-semibold hover:bg-stone-50"
                >
                  <PencilLine className="size-3.5" /> এডিট
                </Link>
              ) : (
                <span
                  title="Shipped, Delivered বা Cancelled অর্ডার এডিট করা যায় না"
                  className="inline-flex h-7 cursor-not-allowed items-center gap-1 rounded-md border border-adm-line px-2 text-xs font-semibold text-adm-muted opacity-60"
                >
                  <PencilLine className="size-3.5" /> এডিট
                </span>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmTrash(true)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-adm-line bg-white px-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-3.5" /> ডিলিট
              </button>
            </div>
          </div>
          <Link href={closeHref} scroll={false} aria-label="বন্ধ করুন" className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5">
            <X className="size-5" />
          </Link>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {order.isDemo && <p className="rounded-lg bg-adm-accent-soft px-3 py-2 text-xs">এটি একটি ডেমো অর্ডার (স্টকে প্রভাব ফেলে না)।</p>}

          {/* progress */}
          {order.status === "CANCELLED" ? (
            <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
              <StatusPill status="CANCELLED" />
              <span className="text-xs text-red-800">অর্ডারটি বাতিল করা হয়েছে</span>
            </div>
          ) : (
            <ol className="flex items-center">
              {flow.map((f, i) => (
                <li key={f.status} className="flex flex-1 flex-col items-center gap-1.5 text-center last:flex-none">
                  <div className="flex w-full items-center">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold ${
                        i < step ? "border-adm-ink bg-adm-ink text-white" : i === step ? "border-adm-ink bg-adm-accent text-adm-ink" : "border-stone-300 bg-white text-adm-muted"
                      }`}
                    >
                      {i < step ? <Check className="size-3" /> : i + 1}
                    </span>
                    {i < flow.length - 1 && <span className={`h-0.5 flex-1 ${i < step ? "bg-adm-ink" : "bg-stone-200"}`} />}
                  </div>
                  <span className={`w-full text-left text-[11px] ${i <= step ? "font-semibold" : "text-adm-muted"}`}>{f.label}</span>
                </li>
              ))}
            </ol>
          )}

          {/* customer */}
          <section className="rounded-xl border border-adm-line bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-adm-accent-soft text-sm font-bold text-adm-accent-strong">
                {order.customerName.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{order.customerName}</p>
                <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-sm text-adm-accent-strong hover:underline">
                  <Phone className="size-3.5" /> {order.phone}
                </a>
              </div>
            </div>
            <p className="mt-3 flex gap-2 text-sm text-adm-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0 text-adm-muted" /> {order.address}
            </p>
            <p className="mt-1.5 flex gap-2 text-sm text-adm-ink-soft">
              <Truck className="mt-0.5 size-4 shrink-0 text-adm-muted" /> {zone} · ক্যাশ অন ডেলিভারি
            </p>
            <p className="mt-3 border-t border-adm-line pt-2 text-xs text-adm-muted">
              এই নাম্বার থেকে আগে {order.customerHistory.previous}টি অর্ডার
              {order.customerHistory.cancelled > 0 && <span className="font-semibold text-red-700">, এর মধ্যে {order.customerHistory.cancelled}টি বাতিল</span>}
            </p>
          </section>

          {fraud && !order.isDemo && <FraudCard report={fraud} lookupEnabled={fraudLookup} />}

          {order.courier && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
                  <Truck className="size-4" /> Steadfast-এ পাঠানো হয়েছে
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={refreshCourier}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 hover:underline"
                >
                  <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} /> স্ট্যাটাস আপডেট
                </button>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <dt className="text-adm-muted">Tracking কোড</dt>
                  <dd className="flex items-center gap-1 font-mono font-semibold">
                    {order.courier.trackingCode ?? "—"}
                    {order.courier.trackingCode && (
                      <button
                        type="button"
                        aria-label="Tracking কোড কপি করুন"
                        onClick={() => navigator.clipboard?.writeText(order.courier!.trackingCode!).catch(() => {})}
                        className="text-adm-muted hover:text-adm-ink"
                      >
                        <Copy className="size-3" />
                      </button>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-adm-muted">Consignment ID</dt>
                  <dd className="font-mono">{order.courier.consignmentId}</dd>
                </div>
                <div>
                  <dt className="text-adm-muted">কুরিয়ার স্ট্যাটাস</dt>
                  <dd className={`font-semibold ${isCourierReturn(order.courier.status) ? "text-red-700" : ""}`}>
                    {order.courier.status ? (courierStatusLabels[order.courier.status] ?? order.courier.status) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-adm-muted">COD</dt>
                  <dd className="font-semibold tabular-nums">{order.courier.cod === null ? "—" : taka(order.courier.cod)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-adm-muted">
                {order.courier.sentAt && `পাঠিয়েছেন ${order.courier.sentBy ?? ""}, ${fmtTime(order.courier.sentAt)}`}
                {order.courier.checkedAt && ` · শেষ চেক ${fmtTime(order.courier.checkedAt)}`}
              </p>
              {courierNote && <p className="mt-1 text-xs text-emerald-900">{courierNote}</p>}
              {isCourierReturn(order.courier.status) && order.status !== "CANCELLED" && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-900">
                  Steadfast পার্সেলটি বাতিল করেছে। পার্সেল হাতে পেলে নিচের বাটন চাপুন, অর্ডার বাতিল হবে আর পণ্য স্টকে ফেরত যাবে।
                  <Button variant="danger" className="mt-2 h-8 w-full text-xs" disabled={pending} onClick={() => setConfirmReturn(true)}>
                    <Undo2 className="size-3.5" /> পার্সেল ফেরত পেয়েছি
                  </Button>
                </div>
              )}
            </section>
          )}

          {order.note && (
            <p className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <span>
                <span className="block text-xs font-semibold text-amber-800">কাস্টমারের নোট</span>
                {order.note}
              </span>
            </p>
          )}

          {/* items */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">পণ্য ({order.items.length})</h3>
            <ul className="divide-y divide-adm-line rounded-xl border border-adm-line bg-white">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-3">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-adm-line bg-white">
                    {i.image ? <Image src={i.image} alt="" fill sizes="44px" className="object-contain p-1" /> : <Package className="m-auto mt-3 size-4 text-adm-muted" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    {i.productId ? (
                      <Link href={`/admin/products/${i.productId}`} className="line-clamp-1 font-medium hover:underline">
                        {i.name}
                      </Link>
                    ) : (
                      <p className="line-clamp-1 font-medium">{i.name}</p>
                    )}
                    <p className="text-xs text-adm-muted">
                      {i.variantName && `${i.variantName} · `}
                      {taka(i.unitPrice)} × {i.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{taka(i.unitPrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-adm-muted">
                <dt>সাবটোটাল</dt>
                <dd className="tabular-nums">{taka(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-adm-muted">
                <dt>ডেলিভারি চার্জ</dt>
                <dd className="tabular-nums">{taka(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold">
                <dt>কালেক্ট করতে হবে</dt>
                <dd className="tabular-nums">{taka(order.total)}</dd>
              </div>
            </dl>
          </section>

          {/* admin note */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">অ্যাডমিন নোট</h3>
            <TextArea
              rows={3}
              value={note}
              maxLength={1000}
              placeholder="শুধু অ্যাডমিনরা দেখবে, যেমন: কাস্টমার বিকেলে কল করতে বলেছে"
              onChange={(e) => {
                setNote(e.target.value);
                setNoteSaved(false);
              }}
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              {noteSaved && <span className="text-xs text-green-700">সেভ হয়েছে</span>}
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs"
                disabled={pending || note === order.adminNote}
                onClick={() =>
                  startTransition(async () => {
                    const res = await saveAdminNote(order.id, note);
                    if (res.ok) setNoteSaved(true);
                    else setError(res.error);
                    router.refresh();
                  })
                }
              >
                নোট সেভ করুন
              </Button>
            </div>
          </section>

          {/* history */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">হিস্ট্রি</h3>
            <ol className="space-y-3 border-l-2 border-adm-line pl-4">
              {order.history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-adm-surface bg-adm-accent-strong" />
                  <p className="flex items-center gap-1">
                    {h.details.length > 0 && <PencilLine className="size-3.5 shrink-0 text-sky-700" />}
                    {h.message}
                  </p>
                  {h.details.length > 0 && (
                    <ul className="my-1 space-y-0.5 rounded-lg bg-stone-900/[0.04] px-3 py-2 text-xs text-adm-ink-soft">
                      {h.details.map((d, n) => (
                        <li key={n}>• {d}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-adm-muted">
                    {fmtTime(h.createdAt)}
                    {h.adminName && ` · ${h.adminName}`}
                  </p>
                </li>
              ))}
              {order.history.length === 0 && <li className="text-sm text-adm-muted">কোনো হিস্ট্রি নেই</li>}
            </ol>
          </section>
        </div>

        {/* actions */}
        <div className="space-y-2 border-t border-adm-line px-5 py-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <div className="flex gap-2">
            {order.status === "CANCELLED" ? (
              <Button className="flex-1" disabled={pending} onClick={() => setStatus("PENDING")}>
                আবার চালু করুন (New)
              </Button>
            ) : next ? (
              <Button className="flex-1" disabled={pending} onClick={() => setStatus(next.status)}>
                <Check className="size-4" /> {pending ? "হচ্ছে..." : next.action}
              </Button>
            ) : (
              <p className="flex-1 rounded-lg bg-green-50 px-3 py-2.5 text-center text-sm font-medium text-green-800">ডেলিভারি সম্পন্ন</p>
            )}
            <a
              href={`/admin/print/${order.orderNo}?type=slip`}
              target="_blank"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 text-sm font-semibold hover:bg-stone-50"
            >
              <Printer className="size-4" /> Slip
            </a>
            <a
              href={`/admin/print/${order.orderNo}?type=invoice`}
              target="_blank"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 text-sm font-semibold hover:bg-stone-50"
            >
              <FileText className="size-4" /> Invoice
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-adm-muted">স্ট্যাটাস সরাসরি বদলান:</span>
            {flow
              .filter((f) => f.status !== order.status && f.status !== next?.status)
              .map((f) => (
                <button key={f.status} type="button" disabled={pending} onClick={() => setStatus(f.status)} className="font-semibold text-adm-ink-soft hover:underline">
                  {f.label}
                </button>
              ))}
            {order.status !== "CANCELLED" && (
              <button type="button" disabled={pending} onClick={() => setConfirmCancel(true)} className="font-semibold text-red-700 hover:underline">
                বাতিল করুন
              </button>
            )}
          </div>
        </div>
      </aside>

      <ConfirmModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={`${order.orderNo} বাতিল করবেন?`}
        message={order.isDemo ? "এটি ডেমো অর্ডার, তাই স্টকে কোনো পরিবর্তন হবে না।" : "অর্ডারের পণ্যগুলো স্টকে ফেরত যাবে। পরে চাইলে অর্ডারটি আবার চালু করা যাবে।"}
        confirmLabel="অর্ডার বাতিল করুন"
        pending={pending}
        onConfirm={() => setStatus("CANCELLED")}
      />
      <ConfirmModal
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        title={`${order.orderNo} ডিলিট করবেন?`}
        message={
          ((order.status === "PENDING" || order.status === "CONFIRMED") && !order.isDemo
            ? "অর্ডারটি Trash-এ যাবে আর পণ্যগুলো স্টকে ফেরত যাবে। Administrator চাইলে ৩০ দিনের মধ্যে ফেরত আনতে পারবেন।"
            : "অর্ডারটি Trash-এ যাবে। স্টকে কোনো পরিবর্তন হবে না। Administrator চাইলে ৩০ দিনের মধ্যে ফেরত আনতে পারবেন।") +
          (order.courier ? " পার্সেলটি Steadfast-এ বুক করা আছে, সেখানে আলাদা করে বাতিল করতে হবে।" : "")
        }
        confirmLabel="Trash-এ পাঠান"
        pending={pending}
        onConfirm={trash}
      />
      <ConfirmModal
        open={confirmReturn}
        onClose={() => setConfirmReturn(false)}
        title="পার্সেল ফেরত পেয়েছেন?"
        message="অর্ডারটি Cancelled হবে আর পণ্যগুলো স্টকে ফেরত যাবে। শুধু পার্সেল হাতে পাওয়ার পর এটা করুন।"
        confirmLabel="হ্যাঁ, স্টকে ফেরত নিন"
        pending={pending}
        onConfirm={parcelReturned}
      />
    </div>,
    document.body,
  );
}
