"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Image as ImageIcon, Megaphone, Share2, Smartphone, Type } from "lucide-react";
import { saveHeaderFooter, uploadBrandImage } from "@/app/admin/(panel)/settings/actions";
import type { LayoutSettings } from "@/lib/layout";
import { Button, Field, TextArea, TextInput, Toggle } from "../form";
import { ImageUploader } from "../image-uploader";
import { Card, CardHeader } from "../ui";

type Values = Pick<LayoutSettings, "announcement" | "logo" | "favicon" | "footerAbout" | "copyright" | "license" | "social" | "badges" | "mobileNav">;

const colors: { id: LayoutSettings["announcement"]["color"]; label: string; className: string }[] = [
  { id: "brand", label: "কমলা", className: "bg-brand" },
  { id: "dark", label: "গাঢ় নীল", className: "bg-ink" },
  { id: "green", label: "সবুজ", className: "bg-green-600" },
  { id: "red", label: "লাল", className: "bg-red-600" },
];

const socials: { key: keyof LayoutSettings["social"]; label: string }[] = [
  { key: "facebook", label: "Facebook পেজ" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
];

const uploadFavicon = (fd: FormData) => {
  fd.set("kind", "favicon");
  return uploadBrandImage(fd);
};
const uploadLogo = (fd: FormData) => {
  fd.set("kind", "logo");
  return uploadBrandImage(fd);
};

export function HeaderFooterForm({ initial, badgeOptions }: { initial: Values; badgeOptions: { key: string; label: string }[] }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Values>) => {
    setV((s) => ({ ...s, ...patch }));
    setMessage(null);
  };
  const dirty = JSON.stringify(v) !== saved;
  const ann = v.announcement;
  const annColor = colors.find((c) => c.id === ann.color) ?? colors[0];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveHeaderFooter(v);
          if (res.ok) {
            setSaved(JSON.stringify(v));
            setErrors({});
            setMessage({ ok: true, text: res.message ?? "সেভ হয়েছে" });
          } else {
            setErrors(res.fieldErrors ?? {});
            setMessage({ ok: false, text: res.error });
          }
        });
      }}
    >
      <Card>
        <CardHeader title="ঘোষণা বার" subtitle="সাইটের একদম উপরে একটা লাইন, যেমন অফার বা ছুটির খবর" action={<Megaphone className="size-5 text-adm-accent-strong" />} />
        <div className="space-y-4">
          <Toggle checked={ann.enabled} onChange={(enabled) => set({ announcement: { ...ann, enabled } })} label="ঘোষণা দেখান" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="লেখা" error={errors.annText}>
              <TextInput value={ann.text} maxLength={160} placeholder="🎉 ঈদ অফার: সব পণ্যে ১০% ছাড়" error={!!errors.annText} onChange={(e) => set({ announcement: { ...ann, text: e.target.value } })} />
            </Field>
            <Field label="ক্লিক করলে কোথায় যাবে (ঐচ্ছিক)" error={errors.annLink}>
              <TextInput value={ann.link} maxLength={300} placeholder="/category/offer" error={!!errors.annLink} onChange={(e) => set({ announcement: { ...ann, link: e.target.value } })} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-adm-muted">রং:</span>
            {colors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set({ announcement: { ...ann, color: c.id } })}
                className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 ${ann.color === c.id ? "border-adm-ink" : "border-adm-line"}`}
              >
                <span className={`size-3.5 rounded-full ${c.className}`} /> {c.label}
              </button>
            ))}
          </div>
          {ann.text && <p className={`rounded-lg px-4 py-2 text-center text-sm font-semibold text-white ${annColor.className}`}>{ann.text}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="লোগো আর আইকন" subtitle="লোগো না দিলে Header-এ “TaqwaBazaar” লেখা দেখাবে" action={<ImageIcon className="size-5 text-adm-accent-strong" />} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="লোগো" error={errors.logo} hint="চওড়া ছবি ভালো (যেমন ৪০০×১০০), PNG বা WebP, স্বচ্ছ ব্যাকগ্রাউন্ড হলে সবচেয়ে ভালো">
            <ImageUploader value={v.logo ? [v.logo] : []} onChange={(urls) => set({ logo: urls[0] ?? "" })} upload={uploadLogo} max={1} />
          </Field>
          <Field label="ব্রাউজার ট্যাবের আইকন (favicon)" error={errors.favicon} hint="বর্গাকার ছবি, যেমন ১২৮×১২৮">
            <ImageUploader value={v.favicon ? [v.favicon] : []} onChange={(urls) => set({ favicon: urls[0] ?? "" })} upload={uploadFavicon} max={1} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Footer-এর লেখা" action={<Type className="size-5 text-adm-accent-strong" />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="দোকানের পরিচিতি" className="sm:col-span-2" hint="খালি রাখলে আগের লেখা দেখাবে">
            <TextArea rows={3} maxLength={500} value={v.footerAbout} onChange={(e) => set({ footerAbout: e.target.value })} />
          </Field>
          <Field label="কপিরাইট লাইন" hint="খালি রাখলে: © TaqwaBazaar, সর্বস্বত্ব সংরক্ষিত।">
            <TextInput maxLength={160} value={v.copyright} onChange={(e) => set({ copyright: e.target.value })} />
          </Field>
          <Field label="ট্রেড লাইসেন্স / DBID (ঐচ্ছিক)">
            <TextInput maxLength={160} value={v.license} placeholder="ট্রেড লাইসেন্স নং: ..." onChange={(e) => set({ license: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="সোশ্যাল মিডিয়া" subtitle="লিংক দিলে Footer-এ আইকন দেখাবে, খালি রাখলে দেখাবে না" action={<Share2 className="size-5 text-adm-accent-strong" />} />
        <div className="grid gap-4 sm:grid-cols-2">
          {socials.map((s) => (
            <Field key={s.key} label={s.label} error={errors[`social_${s.key}`]}>
              <TextInput
                value={v.social[s.key]}
                maxLength={300}
                placeholder={`https://${s.key}.com/...`}
                error={!!errors[`social_${s.key}`]}
                onChange={(e) => set({ social: { ...v.social, [s.key]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="পেমেন্ট ও ডেলিভারি ব্যাজ" subtitle="Footer-এ দেখাবে, কাস্টমারের আস্থা বাড়ায়। যেগুলো আসলে আছে শুধু সেগুলো বাছাই করুন।" action={<BadgeCheck className="size-5 text-adm-accent-strong" />} />
        <div className="flex flex-wrap gap-2">
          {badgeOptions.map((b) => {
            const on = v.badges.includes(b.key);
            return (
              <label key={b.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm ${on ? "border-adm-ink bg-adm-accent-soft" : "border-adm-line"}`}>
                <input type="checkbox" checked={on} onChange={() => set({ badges: on ? v.badges.filter((x) => x !== b.key) : [...v.badges, b.key] })} />
                {b.label}
              </label>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="মোবাইল" action={<Smartphone className="size-5 text-adm-accent-strong" />} />
        <Toggle
          checked={v.mobileNav}
          onChange={(mobileNav) => set({ mobileNav })}
          label="মোবাইলে নিচের ন্যাভিগেশন বার"
          description="হোম, মেনু, কার্ট আর WhatsApp বাটন স্ক্রিনের নিচে আটকে থাকবে। মেনুতে Header-এর সব আইটেম আর সাব-ক্যাটাগরি দেখাবে।"
        />
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-xl bg-adm-surface/95 px-1 py-3 backdrop-blur">
        {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </form>
  );
}
