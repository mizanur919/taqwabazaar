"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, Truck, XCircle } from "lucide-react";
import {
  getCourierPreview,
  refreshCourierStatuses,
  sendToCourier,
  type CourierPreviewRow,
} from "@/app/admin/(panel)/orders/actions";
import type { SendResult } from "@/lib/courier";
import { taka } from "@/lib/format";
import { RiskBadge } from "./fraud-card";
import { Button, Modal } from "./form";

/** One row's selection state: "send" = Confirmed and not sent yet, "sent" = already with the courier. */
export type Selectable = "send" | "sent";

type Ctx = {
  selected: Map<number, Selectable>;
  toggle: (id: number, kind: Selectable) => void;
  setAll: (rows: { id: number; kind: Selectable }[], on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Ctx | null>(null);
const useSelection = () => useContext(SelectionContext)!;

/** Wraps the order table; selection resets when the page or filters change (the parent re-keys it). */
export function OrderSelection({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState(new Map<number, Selectable>());
  const value: Ctx = {
    selected,
    toggle: (id, kind) =>
      setSelected((m) => {
        const next = new Map(m);
        if (next.has(id)) next.delete(id);
        else next.set(id, kind);
        return next;
      }),
    setAll: (rows, on) =>
      setSelected((m) => {
        const next = new Map(m);
        for (const r of rows) {
          if (on) next.set(r.id, r.kind);
          else next.delete(r.id);
        }
        return next;
      }),
    clear: () => setSelected(new Map()),
  };
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

export function SelectAllCheckbox({ rows }: { rows: { id: number; kind: Selectable }[] }) {
  const { selected, setAll } = useSelection();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <input
      type="checkbox"
      aria-label="এই পেজের সব বাছাই করুন"
      disabled={rows.length === 0}
      checked={all}
      onChange={() => setAll(rows, !all)}
      className="size-4 accent-stone-900"
    />
  );
}

/** Row checkbox; clicks don't open the order drawer. */
export function RowCheckbox({ id, kind, disabledReason }: { id: number; kind: Selectable | null; disabledReason?: string }) {
  const { selected, toggle } = useSelection();
  return (
    <span onClick={(e) => e.stopPropagation()} title={kind ? undefined : disabledReason} className="inline-flex">
      <input
        type="checkbox"
        aria-label="বাছাই করুন"
        disabled={!kind}
        checked={selected.has(id)}
        onChange={() => kind && toggle(id, kind)}
        className="size-4 accent-stone-900 disabled:cursor-not-allowed disabled:opacity-30"
      />
    </span>
  );
}

/** Appears above the table while orders are selected. */
export function CourierToolbar({ courierReady }: { courierReady: boolean }) {
  const router = useRouter();
  const { selected, clear } = useSelection();
  const [sendOpen, setSendOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const toSend = [...selected].filter(([, k]) => k === "send").map(([id]) => id);
  const sent = [...selected].filter(([, k]) => k === "sent").map(([id]) => id);

  if (selected.size === 0 && !message) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-adm-line bg-adm-accent-soft/60 px-5 py-2.5 text-sm">
      {selected.size > 0 && (
        <>
          <b>{selected.size}টি বাছাই করা</b>
          {courierReady ? (
            <Button className="h-8 text-xs" disabled={pending || toSend.length === 0} onClick={() => setSendOpen(true)}>
              <Truck className="size-4" /> Steadfast-এ পাঠান ({toSend.length})
            </Button>
          ) : (
            <span className="text-xs text-adm-muted">কুরিয়ারে পাঠাতে Settings → Courier থেকে Steadfast চালু করুন</span>
          )}
          {sent.length > 0 && (
            <Button
              variant="secondary"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await refreshCourierStatuses(sent);
                  setMessage({ ok: res.ok, text: res.message });
                  clear();
                  router.refresh();
                })
              }
            >
              <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> স্ট্যাটাস আপডেট ({sent.length})
            </Button>
          )}
          <button type="button" onClick={clear} className="text-xs font-semibold text-adm-muted hover:underline">
            বাছাই মুছুন
          </button>
        </>
      )}
      {message && (
        <span className={`ml-auto text-xs ${message.ok ? "text-green-700" : "text-red-700"}`}>
          {message.text}{" "}
          <button type="button" onClick={() => setMessage(null)} className="font-semibold underline">
            ঠিক আছে
          </button>
        </span>
      )}
      {sendOpen && (
        <SendModal
          ids={toSend}
          onClose={(changed) => {
            setSendOpen(false);
            if (changed) {
              clear();
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

type Draft = { cod: string; note: string };

function SendModal({ ids, onClose }: { ids: number[]; onClose: (changed: boolean) => void }) {
  const [rows, setRows] = useState<CourierPreviewRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  // load the preview once when the dialog opens
  useEffect(() => {
    startLoading(async () => {
      const res = await getCourierPreview(ids);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.rows);
      setDrafts(Object.fromEntries(res.rows.map((r) => [r.id, { cod: String(r.total), note: "" }])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids are fixed for the life of the dialog
  }, []);

  const ready = (rows ?? []).filter((r) => !r.blocker);
  const badCod = ready.some((r) => !/^\d{1,7}$/.test(drafts[r.id]?.cod ?? ""));
  const totalCod = ready.reduce((n, r) => n + (Number(drafts[r.id]?.cod) || 0), 0);
  const okCount = results?.filter((r) => r.ok).length ?? 0;

  const send = () =>
    startSending(async () => {
      setError(null);
      const res = await sendToCourier(ready.map((r) => ({ id: r.id, cod: Number(drafts[r.id].cod), note: drafts[r.id].note })));
      if (res.ok) setResults(res.results);
      else setError(res.error);
    });

  return (
    <Modal open onClose={() => !sending && onClose(!!results && okCount > 0)} title={results ? "পাঠানোর ফলাফল" : "Steadfast-এ পাঠান"} width="max-w-3xl">
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {loading && <p className="py-8 text-center text-sm text-adm-muted">অর্ডারগুলো দেখা হচ্ছে...</p>}

      {results ? (
        <>
          <p className="mb-3 text-sm">
            <b className="text-green-700">{okCount}টি পাঠানো হয়েছে</b>
            {results.length - okCount > 0 && <b className="text-red-700">, {results.length - okCount}টি পাঠানো যায়নি</b>}
          </p>
          <ul className="max-h-[50vh] divide-y divide-adm-line overflow-y-auto rounded-xl border border-adm-line bg-white text-sm">
            {results.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                {r.ok ? <CheckCircle2 className="size-4 shrink-0 text-green-600" /> : <XCircle className="size-4 shrink-0 text-red-600" />}
                <span className="w-24 font-semibold">{r.orderNo}</span>
                <span className={r.ok ? "text-adm-ink-soft" : "text-red-700"}>{r.ok ? `Tracking: ${r.trackingCode ?? "—"}` : r.error}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => onClose(okCount > 0)}>ঠিক আছে</Button>
          </div>
        </>
      ) : (
        rows && (
          <>
            <p className="mb-3 text-sm text-adm-muted">
              COD = ডেলিভারির সময় রাইডার কত টাকা নেবেন। দরকার হলে বদলান। নোট খালি রাখলে পণ্যের নাম যাবে। পাঠানোর পর অর্ডার নিজে থেকে Shipped হবে আর এডিট করা যাবে না।
            </p>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl border p-3 text-sm ${
                    r.blocker || r.riskLevel === "risky" || r.riskLevel === "blocked" ? "border-red-200 bg-red-50/60" : "border-adm-line bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {r.orderNo} · {r.customerName} · <span className="font-normal">{r.phone}</span>{" "}
                        {r.riskLevel && r.riskLevel !== "safe" && <RiskBadge level={r.riskLevel} />}
                      </p>
                      {(r.riskLevel === "risky" || r.riskLevel === "blocked") && !r.blocker && (
                        <p className="text-xs font-semibold text-red-700">সতর্কতা: এই কাস্টমারের পার্সেল ফেরতের হার বেশি। পাঠানোর আগে কল করে নিশ্চিত হোন।</p>
                      )}
                      <p className="text-xs text-adm-muted">{r.address}</p>
                      <p className="mt-0.5 text-xs text-adm-ink-soft">{r.items}</p>
                      {r.blocker && <p className="mt-1 text-xs font-semibold text-red-700">পাঠানো যাবে না: {r.blocker}</p>}
                    </div>
                    {!r.blocker && (
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-adm-muted">COD (মোট {taka(r.total)})</span>
                        <span className="flex h-9 w-32 items-center gap-1 rounded-lg border border-adm-line bg-white px-2 focus-within:border-adm-accent-strong">
                          ৳
                          <input
                            inputMode="numeric"
                            aria-label={`${r.orderNo} COD`}
                            value={drafts[r.id]?.cod ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], cod: e.target.value.replace(/\D/g, "") } }))}
                            className="w-full bg-transparent text-right text-sm tabular-nums outline-none"
                          />
                        </span>
                      </label>
                    )}
                  </div>
                  {!r.blocker && (
                    <input
                      value={drafts[r.id]?.note ?? ""}
                      maxLength={250}
                      placeholder="কুরিয়ারের জন্য নোট (ঐচ্ছিক), যেমন: বিকেলে কল দিন"
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], note: e.target.value } }))}
                      className="mt-2 h-8 w-full rounded-md border border-adm-line bg-white px-2 text-xs outline-none focus:border-adm-accent-strong"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">
                {ready.length}টি পাঠানো হবে · মোট COD <b className="tabular-nums">{taka(totalCod)}</b>
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={sending} onClick={() => onClose(false)}>
                  বাতিল
                </Button>
                <Button disabled={sending || ready.length === 0 || badCod} onClick={send}>
                  <Truck className="size-4" /> {sending ? "পাঠানো হচ্ছে..." : `${ready.length}টি পাঠান`}
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </Modal>
  );
}
