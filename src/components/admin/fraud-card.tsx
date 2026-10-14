"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { blockPhone, runFraudCheck, unblockPhone } from "@/app/admin/(panel)/orders/actions";
import type { FraudReport } from "@/lib/fraud";
import { riskMeta, type RiskLevel } from "@/lib/risk";
import { Button, Modal, TextInput } from "./form";

export function RiskBadge({ level, className = "" }: { level: RiskLevel; className?: string }) {
  const m = riskMeta[level];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.className} ${className}`}>
      {m.dot} {m.label}
    </span>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });

/** Fraud check panel inside the order drawer. */
export function FraudCard({ report, lookupEnabled }: { report: FraudReport; lookupEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { basis, shop, courier, blocked } = report;
  const ratio = basis.ratio;
  const bar = report.level === "safe" ? "bg-green-600" : report.level === "caution" ? "bg-amber-500" : report.level === "new" ? "bg-stone-400" : "bg-red-600";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "হয়নি");
      router.refresh();
    });

  return (
    <section className="rounded-xl border border-adm-line bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-semibold">
          {report.level === "safe" ? <ShieldCheck className="size-4 text-green-700" /> : <ShieldAlert className="size-4 text-red-700" />}
          Fraud Check
        </h3>
        <RiskBadge level={report.level} className="text-xs" />
      </div>

      {blocked && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900">
          <b>ব্লক করা নাম্বার:</b> {blocked.reason}
          <span className="block text-red-700/80">
            {blocked.by ?? ""} · {fmtDate(blocked.at)}
          </span>
        </p>
      )}

      {/* success bar */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-adm-muted">{basis.source === "courier" ? "সব কুরিয়ারে" : "এই দোকানে"} সফল ডেলিভারি</span>
          <span className="font-semibold tabular-nums">
            {ratio === null ? "কোনো হিসাব নেই" : `${ratio}% (${basis.success}/${basis.total})`}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-red-100">
          <div className={`h-full ${bar}`} style={{ width: `${ratio ?? 0}%` }} />
        </div>
        {basis.cancelled > 0 && <p className="mt-1 text-xs text-red-700">{basis.cancelled}টি পার্সেল বাতিল বা ফেরত</p>}
      </div>

      {courier && courier.couriers.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-adm-muted">
              <th className="py-1 font-medium">কুরিয়ার</th>
              <th className="py-1 text-right font-medium">মোট</th>
              <th className="py-1 text-right font-medium">সফল</th>
              <th className="py-1 text-right font-medium">বাতিল</th>
            </tr>
          </thead>
          <tbody>
            {courier.couriers.map((c) => (
              <tr key={c.name} className="border-t border-adm-line/70">
                <td className="py-1">{c.name}</td>
                <td className="py-1 text-right tabular-nums">{c.total}</td>
                <td className="py-1 text-right tabular-nums text-green-700">{c.success}</td>
                <td className={`py-1 text-right tabular-nums ${c.cancelled > 0 ? "font-semibold text-red-700" : ""}`}>{c.cancelled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {courier && courier.reports.length > 0 && (
        <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-900">
          <p className="font-semibold">অন্য ব্যবসায়ীদের রিপোর্ট ({courier.reports.length})</p>
          <ul className="mt-1 space-y-1">
            {courier.reports.slice(0, 5).map((r, n) => (
              <li key={n}>
                • {r.details || "বিস্তারিত নেই"}
                <span className="text-red-700/70">
                  {" "}
                  ({[r.courier, r.date].filter(Boolean).join(", ")})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 border-t border-adm-line pt-2 text-xs text-adm-muted">
        এই দোকানে: {shop.orders}টি অর্ডার · {shop.delivered}টি ডেলিভারি · {shop.cancelled}টি বাতিল
        {shop.returned > 0 && ` · ${shop.returned}টি কুরিয়ার থেকে ফেরত`}
      </p>
      <p className="mt-0.5 text-[11px] text-adm-muted">
        {courier ? `কুরিয়ার হিসাব আপডেট: ${fmtDate(courier.checkedAt)}` : lookupEnabled ? "কুরিয়ারের হিসাব এখনো আনা হয়নি" : "BD Courier চালু নেই, শুধু এই দোকানের হিসাব দেখাচ্ছে"}
      </p>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {lookupEnabled && (
          <Button variant="secondary" className="h-8 text-xs" disabled={pending} onClick={() => run(() => runFraudCheck(report.phone))}>
            <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} /> আবার চেক করুন
          </Button>
        )}
        {blocked ? (
          <Button variant="ghost" className="h-8 text-xs" disabled={pending} onClick={() => run(() => unblockPhone(report.phone))}>
            ব্লক তুলে দিন
          </Button>
        ) : (
          <Button variant="ghost" className="h-8 text-xs text-red-700 hover:bg-red-50" disabled={pending} onClick={() => setBlockOpen(true)}>
            <Ban className="size-3.5" /> নাম্বার ব্লক করুন
          </Button>
        )}
      </div>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title={`${report.phone} ব্লক করবেন?`} width="max-w-md">
        <p className="text-sm text-adm-ink-soft">এই নাম্বার থেকে অর্ডার এলে নেওয়া হবে, তবে লাল চিহ্ন দেখাবে। পরে চাইলে ব্লক তুলে দেওয়া যাবে।</p>
        <TextInput className="mt-3" value={reason} maxLength={255} placeholder="কারণ, যেমন: ৩ বার পার্সেল ফেরত দিয়েছে" onChange={(e) => setReason(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBlockOpen(false)}>
            বাতিল
          </Button>
          <Button
            variant="danger"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              run(async () => {
                const r = await blockPhone(report.phone, reason);
                if (r.ok) setBlockOpen(false);
                return r;
              })
            }
          >
            ব্লক করুন
          </Button>
        </div>
      </Modal>
    </section>
  );
}
