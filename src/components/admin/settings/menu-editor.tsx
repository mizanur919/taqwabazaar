"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import type { MenuBadge, MenuItem, MenuKind } from "@/lib/layout";
import { Button, Select, TextInput } from "../form";

export type MenuOptions = {
  categories: { id: number; name: string; parentName: string | null; hasChildren: boolean }[];
  pages: { slug: string; title: string }[];
  system: { key: string; label: string }[];
};

const kindLabel: Record<MenuKind, string> = { category: "ক্যাটাগরি", system: "পেজ", page: "তথ্য পেজ", custom: "লিংক" };

let counter = 0;
const newId = () => `n${Date.now().toString(36)}${++counter}`;

/** Name shown for an item when no custom label is set. */
function defaultName(i: MenuItem, o: MenuOptions) {
  if (i.kind === "category") return o.categories.find((c) => String(c.id) === i.ref)?.name ?? "(মুছে ফেলা ক্যাটাগরি)";
  if (i.kind === "system") return o.system.find((s) => s.key === i.ref)?.label ?? i.ref;
  if (i.kind === "page") return o.pages.find((p) => p.slug === i.ref)?.title ?? i.ref;
  return i.ref;
}

/** Ordered list editor for one menu: add, rename, badge, hide, reorder (drag or arrows), remove. */
export function MenuEditor({ items, onChange, options, allowDropdown }: { items: MenuItem[]; onChange: (items: MenuItem[]) => void; options: MenuOptions; allowDropdown: boolean }) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [kind, setKind] = useState<MenuKind>("category");
  const [ref, setRef] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<MenuItem>) => onChange(items.map((it, n) => (n === idx ? { ...it, ...patch } : it)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  const add = () => {
    setAddError(null);
    if (kind === "custom") {
      const url = customUrl.trim();
      if (!customLabel.trim()) return setAddError("লিংকের নাম দিন");
      if (!/^\/(?!\/)/.test(url) && !/^https:\/\/\S+$/.test(url)) return setAddError("লিংক / দিয়ে শুরু হবে (যেমন /category/phone) অথবা https:// দিয়ে");
      onChange([...items, { id: newId(), kind, ref: url, label: customLabel.trim(), hidden: false, badge: "", dropdown: false }]);
      setCustomLabel("");
      setCustomUrl("");
      return;
    }
    if (!ref) return setAddError("কোনটা যোগ করবেন বাছাই করুন");
    const cat = kind === "category" ? options.categories.find((c) => String(c.id) === ref) : null;
    onChange([...items, { id: newId(), kind, ref, label: "", hidden: false, badge: "", dropdown: !!cat?.hasChildren && allowDropdown }]);
    setRef("");
  };

  const refOptions =
    kind === "category"
      ? options.categories.map((c) => ({ value: String(c.id), label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }))
      : kind === "system"
        ? options.system.map((s) => ({ value: s.key, label: s.label }))
        : kind === "page"
          ? options.pages.map((p) => ({ value: p.slug, label: p.title }))
          : [];

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((it, idx) => {
          const cat = it.kind === "category" ? options.categories.find((c) => String(c.id) === it.ref) : null;
          const missing = it.kind === "category" && !cat;
          return (
            <li
              key={it.id}
              draggable
              onDragStart={(e) => {
                setDragFrom(idx);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(idx);
              }}
              onDragLeave={() => setDragOver((v) => (v === idx ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, idx);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2.5 ${dragOver === idx && dragFrom !== idx ? "border-adm-accent-strong ring-2 ring-adm-accent/30" : "border-adm-line"} ${it.hidden ? "opacity-55" : ""} ${dragFrom === idx ? "opacity-40" : ""}`}
            >
              <span className="cursor-grab text-adm-muted active:cursor-grabbing" title="টেনে সাজান">
                <GripVertical className="size-4" />
              </span>
              <span className="w-6 text-center text-xs font-semibold tabular-nums text-adm-muted">{idx + 1}</span>
              <span className="rounded bg-stone-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-adm-ink-soft">{kindLabel[it.kind]}</span>
              <TextInput
                className="h-8 min-w-36 flex-1 text-sm"
                value={it.label}
                aria-label="মেনুতে যে নাম দেখাবে"
                placeholder={defaultName(it, options)}
                maxLength={60}
                onChange={(e) => update(idx, { label: e.target.value })}
              />
              {it.kind === "custom" && <span className="max-w-40 truncate font-mono text-[11px] text-adm-muted" title={it.ref}>{it.ref}</span>}
              {missing && <span className="text-xs font-semibold text-red-700">ক্যাটাগরি নেই, স্টোরে দেখাবে না</span>}
              <Select className="h-8 w-24 text-xs" aria-label="ব্যাজ" value={it.badge} onChange={(e) => update(idx, { badge: e.target.value as MenuBadge })}>
                <option value="">ব্যাজ নেই</option>
                <option value="hot">Hot</option>
                <option value="new">New</option>
                <option value="sale">Sale</option>
              </Select>
              {allowDropdown && it.kind === "category" && cat?.hasChildren && (
                <label className="flex items-center gap-1 text-xs" title="মাউস রাখলে সাব-ক্যাটাগরি দেখাবে">
                  <input type="checkbox" checked={it.dropdown} onChange={(e) => update(idx, { dropdown: e.target.checked })} />
                  সাব-ক্যাটাগরি
                </label>
              )}
              <div className="ml-auto flex items-center">
                <button type="button" aria-label="উপরে" disabled={idx === 0} onClick={() => move(idx, idx - 1)} className="rounded p-1.5 hover:bg-stone-900/5 disabled:opacity-30">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label="নিচে" disabled={idx === items.length - 1} onClick={() => move(idx, idx + 1)} className="rounded p-1.5 hover:bg-stone-900/5 disabled:opacity-30">
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={it.hidden ? "দেখান" : "লুকান"}
                  title={it.hidden ? "লুকানো আছে, দেখাতে চাপুন" : "লুকান"}
                  onClick={() => update(idx, { hidden: !it.hidden })}
                  className="rounded p-1.5 hover:bg-stone-900/5"
                >
                  {it.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button type="button" aria-label="মুছে ফেলুন" onClick={() => onChange(items.filter((_, n) => n !== idx))} className="rounded p-1.5 text-red-600 hover:bg-red-50">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="rounded-xl border border-dashed border-adm-line p-4 text-center text-sm text-adm-muted">কোনো আইটেম নেই</li>}
      </ul>

      {/* add */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-stone-900/[0.03] p-3">
        <Select
          className="h-9 w-36 text-sm"
          aria-label="কী যোগ করবেন"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as MenuKind);
            setRef("");
            setAddError(null);
          }}
        >
          <option value="category">ক্যাটাগরি</option>
          <option value="system">সাইটের পেজ</option>
          <option value="page">তথ্য পেজ</option>
          <option value="custom">কাস্টম লিংক</option>
        </Select>
        {kind === "custom" ? (
          <>
            <TextInput className="h-9 w-40 text-sm" placeholder="নাম, যেমন: ঈদ অফার" value={customLabel} maxLength={60} onChange={(e) => setCustomLabel(e.target.value)} />
            <TextInput className="h-9 min-w-48 flex-1 text-sm" placeholder="/category/offer বা https://..." value={customUrl} maxLength={300} onChange={(e) => setCustomUrl(e.target.value)} />
          </>
        ) : (
          <Select className="h-9 min-w-48 flex-1 text-sm" aria-label="বাছাই করুন" value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">বাছাই করুন...</option>
            {refOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        <Button variant="secondary" className="h-9" onClick={add}>
          <Plus className="size-4" /> যোগ করুন
        </Button>
        {addError && <p className="w-full text-xs text-red-700">{addError}</p>}
      </div>
    </div>
  );
}
