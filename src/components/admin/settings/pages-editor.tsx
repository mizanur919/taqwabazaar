"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { savePage } from "@/app/admin/(panel)/settings/actions";
import { Button, Field, TextArea, TextInput } from "../form";
import { Card } from "../ui";

type Page = { slug: string; title: string; body: string };

const labels: Record<string, string> = {
  "about-us": "About Us",
  "privacy-policy": "Privacy Policy",
  "refund-policy": "Refund Policy",
  "contact-us": "Contact Us",
};

export function PagesEditor({ pages }: { pages: Page[] }) {
  const [list, setList] = useState(pages);
  const [slug, setSlug] = useState(pages[0]?.slug ?? "");
  const page = list.find((p) => p.slug === slug)!;
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedMap, setSavedMap] = useState(Object.fromEntries(pages.map((p) => [p.slug, p])));
  const dirty = page.title !== savedMap[slug].title || page.body !== savedMap[slug].body;

  const update = (patch: Partial<Page>) => {
    setList((l) => l.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
    setMessage(null);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {list.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => {
              setSlug(p.slug);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap ${p.slug === slug ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:bg-stone-900/5"}`}
          >
            {labels[p.slug] ?? p.slug}
            {(p.title !== savedMap[p.slug].title || p.body !== savedMap[p.slug].body) && " •"}
          </button>
        ))}
      </nav>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await savePage(slug, page.title, page.body);
              if (res.ok) {
                setSavedMap((m) => ({ ...m, [slug]: { ...page } }));
                setMessage({ ok: true, text: res.message ?? "সেভ হয়েছে" });
              } else setMessage({ ok: false, text: res.error });
            });
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-adm-muted">taqwabazaar.com/page/{slug}</p>
            <a href={`/page/${slug}`} target="_blank" className="flex items-center gap-1 text-xs font-semibold text-adm-accent-strong hover:underline">
              <ExternalLink className="size-3.5" /> স্টোরে দেখুন
            </a>
          </div>
          <Field label="শিরোনাম">
            <TextInput value={page.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="লেখা" hint="একটা ফাঁকা লাইন দিলে নতুন প্যারাগ্রাফ হবে">
            <TextArea rows={14} value={page.body} onChange={(e) => update({ body: e.target.value })} />
          </Field>
          {slug === "contact-us" && (
            <p className="rounded-lg bg-adm-accent-soft px-3 py-2 text-xs">ফোন, ইমেইল আর ঠিকানা &quot;Store&quot; ট্যাবের তথ্য থেকে এই পেজে নিজে থেকেই দেখাবে।</p>
          )}
          <div className="flex items-center justify-end gap-3">
            {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
            {dirty && (
              <Button variant="secondary" onClick={() => update({ title: savedMap[slug].title, body: savedMap[slug].body })}>
                বাতিল
              </Button>
            )}
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
