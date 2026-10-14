"use client";

import { useState, useTransition } from "react";
import { Activity, KeyRound, Send } from "lucide-react";
import { saveMarketing, sendMetaTestEvent } from "@/app/admin/(panel)/settings/actions";
import { Button, Field, TextInput, Toggle } from "../form";
import { Card, CardHeader } from "../ui";

type Values = { enabled: boolean; pixelId: string; testCode: string };

const EVENTS: [string, string][] = [
  ["PageView", "যেকোনো পেজ খুললে"],
  ["ViewContent", "প্রোডাক্ট পেজ দেখলে"],
  ["Search", "সার্চ করলে"],
  ["AddToCart", "কার্টে যোগ করলে"],
  ["AddToWishlist", "উইশলিস্টে যোগ করলে"],
  ["InitiateCheckout", "চেকআউট পেজ বা দ্রুত অর্ডার পপআপ খুললে"],
  ["Purchase", "ওয়েবসাইট থেকে অর্ডার সফল হলে (ফোন অর্ডার বাদে)"],
  ["Contact", "WhatsApp বা ফোন নাম্বারে ক্লিক করলে"],
];

export function MarketingForm({ initial, tokenEnd: initialTokenEnd }: { initial: Values; tokenEnd: string }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [token, setToken] = useState("");
  const [removeToken, setRemoveToken] = useState(false);
  const [tokenEnd, setTokenEnd] = useState(initialTokenEnd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();
  const set = (patch: Partial<Values>) => {
    setV((s) => ({ ...s, ...patch }));
    setMessage(null);
  };
  const dirty = JSON.stringify(v) !== JSON.stringify(saved) || !!token || removeToken;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveMarketing({ ...v, token, removeToken });
          if (res.ok) {
            setSaved(v);
            setToken("");
            setRemoveToken(false);
            setTokenEnd(res.tokenEnd ?? "");
            setErrors({});
            setMessage({ ok: true, text: res.message ?? "সেভ হয়েছে" });
          } else {
            setErrors(res.fieldErrors ?? {});
            setMessage({ ok: false, text: res.error });
          }
        });
      }}
      className="space-y-5"
    >
      <Card>
        <CardHeader
          title="Facebook Pixel"
          subtitle="Facebook Ads কোন বিজ্ঞাপন থেকে কতজন দেখল, কার্টে নিল আর অর্ডার করল তা মাপার জন্য"
          action={<Activity className="size-5 text-adm-accent-strong" />}
        />
        <div className="space-y-4">
          <Toggle
            checked={v.enabled}
            onChange={(enabled) => set({ enabled })}
            label="Pixel চালু"
            description="বন্ধ থাকলে স্টোরে কোনো Facebook কোড লোড হবে না"
          />
          <Field label="Pixel ID (Dataset ID)" required={v.enabled} error={errors.pixelId} hint="Events Manager → Data sources → আপনার Pixel-এর নামের নিচের সংখ্যা">
            <TextInput inputMode="numeric" value={v.pixelId} error={!!errors.pixelId} placeholder="যেমন 123456789012345" onChange={(e) => set({ pixelId: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Conversions API"
          subtitle="Ad blocker বা iPhone-এর প্রাইভেসি সেটিং থাকলেও অর্ডারের তথ্য সার্ভার থেকে সরাসরি Facebook-এ যায়"
          action={<KeyRound className="size-5 text-adm-accent-strong" />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Access Token"
            error={errors.token}
            hint={
              tokenEnd && !removeToken
                ? `সেভ করা আছে (শেষে …${tokenEnd})। বদলাতে চাইলে নতুনটা পেস্ট করুন, না হলে খালি রাখুন।`
                : "Events Manager → Settings → Conversions API → Generate access token"
            }
          >
            <TextInput
              type="password"
              autoComplete="off"
              value={token}
              error={!!errors.token}
              placeholder={tokenEnd && !removeToken ? "••••••••••••" : "টোকেন পেস্ট করুন"}
              onChange={(e) => {
                setToken(e.target.value.trim());
                setMessage(null);
              }}
            />
          </Field>
          <Field label="Test Event Code" error={errors.testCode} hint="শুধু পরীক্ষার সময় দিন (Events Manager → Test events)। লাইভ হলে খালি করে দিন।">
            <TextInput value={v.testCode} error={!!errors.testCode} placeholder="যেমন TEST12345" onChange={(e) => set({ testCode: e.target.value.trim() })} />
          </Field>
        </div>
        {tokenEnd && (
          <label className="mt-3 flex items-center gap-2 text-sm text-adm-muted">
            <input type="checkbox" checked={removeToken} onChange={(e) => setRemoveToken(e.target.checked)} />
            সেভ করা টোকেন মুছে দিন (Conversions API বন্ধ হবে, ব্রাউজার Pixel চলবে)
          </label>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-adm-line pt-4">
          <Button
            variant="secondary"
            disabled={testing || dirty || !tokenEnd || !saved.enabled}
            title={dirty ? "আগে সেভ করুন" : undefined}
            onClick={() =>
              startTest(async () => {
                setTestMessage(null);
                const res = await sendMetaTestEvent();
                setTestMessage(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
              })
            }
          >
            <Send className="size-4" /> {testing ? "পাঠানো হচ্ছে..." : "টেস্ট ইভেন্ট পাঠান"}
          </Button>
          <span className={`text-sm ${testMessage ? (testMessage.ok ? "text-green-700" : "text-red-700") : "text-adm-muted"}`}>
            {testMessage?.text ?? "সেভ করার পর টোকেন ঠিক আছে কিনা এখান থেকে যাচাই করুন"}
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader title="যে ইভেন্টগুলো যাবে" subtitle="টাকার হিসাব BDT-তে। কাস্টমারের ফোন আর নাম hash করে পাঠানো হয়, আসল তথ্য Facebook-এ যায় না। অ্যাডমিন প্যানেলে Pixel চলে না।" />
        <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {EVENTS.map(([name, when]) => (
            <li key={name} className="flex gap-2">
              <span className="w-36 shrink-0 font-mono text-xs leading-5 font-semibold">{name}</span>
              <span className="text-adm-muted">{when}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
        </Button>
      </div>
    </form>
  );
}
