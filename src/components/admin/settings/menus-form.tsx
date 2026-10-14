"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Columns3, PanelTop, Plus, Trash2 } from "lucide-react";
import { saveMenus } from "@/app/admin/(panel)/settings/actions";
import type { FooterColumn, MenuItem } from "@/lib/layout";
import { Button, TextInput } from "../form";
import { Card, CardHeader } from "../ui";
import { MenuEditor, type MenuOptions } from "./menu-editor";

export function MenusForm({ initial, options }: { initial: { headerMenu: MenuItem[]; footerColumns: FooterColumn[] }; options: MenuOptions }) {
  const [header, setHeader] = useState(initial.headerMenu);
  const [columns, setColumns] = useState(initial.footerColumns);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify({ headerMenu: header, footerColumns: columns }) !== saved;

  const setCol = (idx: number, patch: Partial<FooterColumn>) => {
    setColumns((cs) => cs.map((c, n) => (n === idx ? { ...c, ...patch } : c)));
    setMessage(null);
  };
  const moveCol = (from: number, to: number) => {
    if (to < 0 || to >= columns.length) return;
    const next = [...columns];
    const [c] = next.splice(from, 1);
    next.splice(to, 0, c);
    setColumns(next);
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveMenus({ headerMenu: header, footerColumns: columns });
          if (res.ok) {
            setSaved(JSON.stringify({ headerMenu: header, footerColumns: columns }));
            setMessage({ ok: true, text: res.message ?? "সেভ হয়েছে" });
          } else setMessage({ ok: false, text: res.error });
        });
      }}
    >
      <Card>
        <CardHeader
          title="Header মেনু"
          subtitle="উপরের মেনুতে কী কী থাকবে আর কোনটার পর কোনটা। টেনে বা ↑↓ দিয়ে সাজান। মোবাইলের মেনুতেও একই ক্রমে দেখাবে।"
          action={<PanelTop className="size-5 text-adm-accent-strong" />}
        />
        <MenuEditor
          items={header}
          options={options}
          allowDropdown
          onChange={(items) => {
            setHeader(items);
            setMessage(null);
          }}
        />
      </Card>

      <Card>
        <CardHeader
          title="Footer মেনু"
          subtitle="নিচের অংশের কলাম (সর্বোচ্চ ৪টা)। প্রতিটা কলামের শিরোনাম আর লিংক আলাদা।"
          action={<Columns3 className="size-5 text-adm-accent-strong" />}
        />
        <div className="space-y-4">
          {columns.map((col, idx) => (
            <div key={col.id} className="rounded-xl border border-adm-line bg-stone-900/[0.02] p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-adm-muted">কলাম {idx + 1}</span>
                <TextInput
                  className="h-9 w-56 text-sm font-semibold"
                  aria-label="কলামের শিরোনাম"
                  placeholder="শিরোনাম, যেমন: তথ্য"
                  maxLength={40}
                  value={col.title}
                  onChange={(e) => setCol(idx, { title: e.target.value })}
                />
                <div className="ml-auto flex">
                  <button type="button" aria-label="বামে" disabled={idx === 0} onClick={() => moveCol(idx, idx - 1)} className="rounded p-1.5 hover:bg-stone-900/5 disabled:opacity-30">
                    <ArrowLeft className="size-4" />
                  </button>
                  <button type="button" aria-label="ডানে" disabled={idx === columns.length - 1} onClick={() => moveCol(idx, idx + 1)} className="rounded p-1.5 hover:bg-stone-900/5 disabled:opacity-30">
                    <ArrowRight className="size-4" />
                  </button>
                  <button type="button" aria-label="কলাম মুছুন" onClick={() => setColumns((cs) => cs.filter((_, n) => n !== idx))} className="rounded p-1.5 text-red-600 hover:bg-red-50">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <MenuEditor items={col.items} options={options} allowDropdown={false} onChange={(items) => setCol(idx, { items })} />
            </div>
          ))}
          {columns.length < 4 && (
            <Button
              variant="secondary"
              onClick={() => setColumns((cs) => [...cs, { id: `c${Date.now().toString(36)}`, title: "", items: [] }])}
            >
              <Plus className="size-4" /> কলাম যোগ করুন
            </Button>
          )}
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-xl bg-adm-surface/95 px-1 py-3 backdrop-blur">
        {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
        {dirty && !message && <span className="text-xs text-adm-muted">সেভ করা হয়নি এমন পরিবর্তন আছে</span>}
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </form>
  );
}
