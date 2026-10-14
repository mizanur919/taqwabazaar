"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ClipboardList, History, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import {
  adjustStock,
  getStockHistory,
  receiveStock,
  setLowStockAt,
  type StockHistoryEntry,
} from "@/app/admin/(panel)/stock/actions";
import type { StockRow } from "@/lib/admin/stock";
import { taka } from "@/lib/format";
import { Button, Field, Modal, Select, TextInput } from "./form";
import { Card } from "./ui";

const statusMeta = {
  in: { label: "In stock", className: "bg-green-50 text-green-800", dot: "bg-green-600", bar: "var(--adm-accent)" },
  low: { label: "Running low", className: "bg-orange-50 text-orange-800", dot: "bg-orange-500", bar: "#f97316" },
  out: { label: "Out of stock", className: "bg-red-50 text-red-800", dot: "bg-red-600", bar: "#dc2626" },
} as const;

const label = (r: StockRow) => (r.variantName ? `${r.name} — ${r.variantName}` : r.name);

type Summary = { products: number; low: number; out: number; value: number; units: number };

export function StockManager({
  rows,
  summary,
  categories,
}: {
  rows: StockRow[];
  summary: Summary;
  categories: { id: number; name: string }[];
}) {
  const [tab, setTab] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [receiveFor, setReceiveFor] = useState<StockRow | null | "pick">(null);
  const [adjustFor, setAdjustFor] = useState<StockRow | null>(null);
  const [historyFor, setHistoryFor] = useState<StockRow | null>(null);

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "all" || r.status === tab) &&
          (!category || String(r.categoryId) === category) &&
          (!q.trim() || label(r).toLowerCase().includes(q.trim().toLowerCase()) || r.sku?.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [rows, tab, q, category],
  );

  const tabs = [
    { id: "all", label: "All", count: rows.length },
    { id: "low", label: "Running low", count: rows.filter((r) => r.status === "low").length },
    { id: "out", label: "Out of stock", count: rows.filter((r) => r.status === "out").length },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="text-sm text-adm-muted">প্রতিটি প্রোডাক্টের স্টক তার সীমার সাথে তুলনা করে দেখায়। নতুন মাল এলে এখান থেকে যোগ করুন।</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/print/stock"
            target="_blank"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 text-sm font-semibold hover:bg-stone-50"
          >
            <ClipboardList className="size-4" /> Count sheet
          </a>
          <Button onClick={() => setReceiveFor("pick")}>
            <PackagePlus className="size-4" /> Receive stock
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard title="Products" value={String(summary.products)} hint={`${summary.units.toLocaleString("en-IN")} ইউনিট`} />
        <SummaryCard title="Running low" value={String(summary.low)} hint="সীমার নিচে" tone="warn" />
        <SummaryCard title="Out of stock" value={String(summary.out)} hint="স্টক শেষ" tone="danger" />
        <SummaryCard title="Stock value" value={taka(summary.value)} hint="বিক্রয়মূল্যে" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-stone-900/5 p-0.5 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === t.id ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}
            >
              {t.label}
              <span className={`text-xs ${tab === t.id ? "text-white/70" : "text-adm-muted"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!h-9 w-auto" aria-label="ক্যাটাগরি">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-adm-line bg-white px-2.5">
            <Search className="size-4 text-adm-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="প্রোডাক্ট বা SKU" className="w-40 bg-transparent text-sm outline-none" />
          </label>
        </div>
      </div>

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-2 py-3 font-medium">Category</th>
                <th className="w-72 px-2 py-3 font-medium">Level against limit</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const meta = statusMeta[r.status];
                const scale = Math.max(r.lowStockAt * 4, r.stock, 1);
                return (
                  <tr key={r.key} className={`border-b border-adm-line/70 last:border-0 ${r.isActive ? "" : "opacity-55"}`}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-adm-line bg-white">
                          {r.image && <Image src={r.image} alt="" fill sizes="40px" className="object-contain p-1" />}
                        </span>
                        <span className="min-w-0">
                          <Link href={`/admin/products/${r.productId}`} className="block truncate font-semibold hover:underline">
                            {r.name}
                          </Link>
                          <span className="block text-xs text-adm-muted">
                            {r.variantName && <span className="font-medium text-adm-ink-soft">{r.variantName} · </span>}
                            {r.sku ?? "SKU নেই"}
                            {!r.isActive && " · লুকানো"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-adm-ink-soft">{r.category}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="relative h-2 flex-1 rounded-full bg-stone-900/[0.07]" title={`সীমা: ${r.lowStockAt}`}>
                          <div className="h-2 rounded-full" style={{ width: `${(Math.max(r.stock, 0) / scale) * 100}%`, background: meta.bar }} />
                          <div className="absolute -top-1 h-4 w-0.5 rounded bg-adm-ink/50" style={{ left: `${(r.lowStockAt / scale) * 100}%` }} />
                        </div>
                        <span className="w-20 text-right tabular-nums">
                          <b>{r.stock}</b> <span className="text-adm-muted">/ {r.lowStockAt}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${meta.className}`}>
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setReceiveFor(r)}
                          className="rounded-md border border-adm-line bg-adm-accent-soft px-2.5 py-1 text-xs font-semibold hover:bg-adm-accent"
                        >
                          Receive
                        </button>
                        <button type="button" title="স্টক ঠিক করুন" aria-label="স্টক ঠিক করুন" onClick={() => setAdjustFor(r)} className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink">
                          <SlidersHorizontal className="size-4" />
                        </button>
                        <button type="button" title="হিস্ট্রি" aria-label="হিস্ট্রি" onClick={() => setHistoryFor(r)} className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink">
                          <History className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-adm-muted">
                    কিছু পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {receiveFor && <ReceiveModal rows={rows} initial={receiveFor === "pick" ? null : receiveFor} onClose={() => setReceiveFor(null)} />}
      {adjustFor && <AdjustModal row={adjustFor} onClose={() => setAdjustFor(null)} />}
      {historyFor && <HistoryModal row={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function SummaryCard({ title, value, hint, tone }: { title: string; value: string; hint: string; tone?: "warn" | "danger" }) {
  return (
    <Card className="!p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === "warn" ? "text-orange-700" : tone === "danger" ? "text-red-700" : ""}`}>{value}</p>
      <p className="text-xs text-adm-muted">{hint}</p>
    </Card>
  );
}

function ReceiveModal({ rows, initial, onClose }: { rows: StockRow[]; initial: StockRow | null; onClose: () => void }) {
  const router = useRouter();
  const [key, setKey] = useState(initial?.key ?? "");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const row = rows.find((r) => r.key === key);

  return (
    <Modal open onClose={onClose} title="Receive stock">
      <p className="-mt-3 mb-4 text-sm text-adm-muted">সাপ্লায়ার থেকে আসা মালের পরিমাণ লিখুন। স্টক সব জায়গায় সাথে সাথে আপডেট হবে।</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!row) return setError("প্রোডাক্ট বাছাই করুন");
          startTransition(async () => {
            const res = await receiveStock({ productId: row.productId, variantId: row.variantId, qty: Number(qty), reference, note });
            if (res.ok) {
              onClose();
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <Field label="প্রোডাক্ট" required>
          <Select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">বাছাই করুন</option>
            {rows.map((r) => (
              <option key={r.key} value={r.key}>
                {label(r)} (এখন {r.stock})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="পরিমাণ" required hint={row && Number(qty) > 0 ? `নতুন স্টক হবে ${row.stock + Number(qty)}` : undefined}>
            <TextInput inputMode="numeric" value={qty} autoFocus onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="রেফারেন্স" hint="চালান / ইনভয়েস নং">
            <TextInput value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
        <Field label="নোট">
          <TextInput value={note} maxLength={255} placeholder="যেমন: সাপ্লায়ারের নাম" onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending || !row || !(Number(qty) > 0)}>
            {pending ? "যোগ হচ্ছে..." : "Add to stock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"count" | "damaged">("count");
  const [qty, setQty] = useState(String(row.stock));
  const [note, setNote] = useState("");
  const [low, setLow] = useState(String(row.lowStockAt));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const n = Number(qty) || 0;
  const result = mode === "count" ? n : row.stock - n;

  return (
    <Modal open onClose={onClose} title="স্টক ঠিক করুন">
      <p className="-mt-3 mb-4 text-sm text-adm-muted">
        {label(row)} · এখন স্টক <b className="text-adm-ink">{row.stock}</b>
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            if (Number(low) !== row.lowStockAt) await setLowStockAt(row.productId, Number(low));
            const res = await adjustStock({ productId: row.productId, variantId: row.variantId, mode, qty: n, note });
            if (res.ok) {
              onClose();
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <div className="flex rounded-lg bg-stone-900/5 p-0.5 text-sm">
          {(
            [
              ["count", "গুনে ঠিক করুন"],
              ["damaged", "নষ্ট / হারানো বাদ দিন"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setQty(id === "count" ? String(row.stock) : "");
              }}
              className={`flex-1 rounded-md px-3 py-1.5 ${mode === id ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft"}`}
            >
              {text}
            </button>
          ))}
        </div>
        <Field
          label={mode === "count" ? "গুনে কতটি পাওয়া গেছে" : "কতটি বাদ দেবেন"}
          hint={`নতুন স্টক হবে ${result}${result < 0 ? " (০ এর কম হতে পারে না)" : ""}`}
        >
          <TextInput inputMode="numeric" value={qty} autoFocus onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={mode === "damaged" ? "কারণ" : "নোট"} required={mode === "damaged"}>
          <TextInput value={note} maxLength={255} placeholder={mode === "damaged" ? "যেমন: ভাঙা অবস্থায় এসেছে" : "ঐচ্ছিক"} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="কম স্টকের সীমা" hint="পুরো প্রোডাক্টের (সব ভ্যারিয়েন্টের) জন্য প্রযোজ্য">
          <TextInput inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value.replace(/\D/g, ""))} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending || result < 0}>
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });

function HistoryModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const [entries, setEntries] = useState<StockHistoryEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    getStockHistory(row.productId, row.variantId).then((list) => alive && setEntries(list));
    return () => {
      alive = false;
    };
  }, [row.productId, row.variantId]);

  return (
    <Modal open onClose={onClose} title="স্টক হিস্ট্রি" width="max-w-2xl">
      <p className="-mt-3 mb-4 text-sm text-adm-muted">
        {label(row)} · এখন স্টক <b className="text-adm-ink">{row.stock}</b>
      </p>
      {entries === null ? (
        <p className="py-8 text-center text-sm text-adm-muted">লোড হচ্ছে...</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-adm-muted">এখনো কোনো স্টক পরিবর্তন রেকর্ড হয়নি</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-adm-surface">
              <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                <th className="py-2 font-medium">কখন</th>
                <th className="py-2 font-medium">কারণ</th>
                <th className="py-2 text-right font-medium">পরিবর্তন</th>
                <th className="py-2 text-right font-medium">পরে</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-adm-line/60 last:border-0 align-top">
                  <td className="py-2 pr-2 text-xs whitespace-nowrap text-adm-muted">{fmt(e.createdAt)}</td>
                  <td className="py-2 pr-2">
                    <span className="font-medium">{e.reason}</span>
                    {e.reference && <span className="text-adm-muted"> · {e.reference}</span>}
                    {(e.note || e.adminName) && (
                      <span className="block text-xs text-adm-muted">
                        {e.note}
                        {e.note && e.adminName && " · "}
                        {e.adminName}
                      </span>
                    )}
                  </td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${e.change > 0 ? "text-green-700" : "text-red-700"}`}>
                    {e.change > 0 ? `+${e.change}` : e.change}
                  </td>
                  <td className="py-2 text-right tabular-nums">{e.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
