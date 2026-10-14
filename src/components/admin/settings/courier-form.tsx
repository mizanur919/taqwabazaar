"use client";

import { useState, useTransition } from "react";
import { Copy, PlugZap, RefreshCw, Truck, Webhook } from "lucide-react";
import { regenerateCourierWebhookToken, saveCourier, testCourier } from "@/app/admin/(panel)/settings/actions";
import { Button, Field, TextInput, Toggle } from "../form";
import { Card, CardHeader } from "../ui";

type Props = {
  enabled: boolean;
  apiKeyEnd: string;
  secretKeyEnd: string;
  webhookUrl: string;
  webhookToken: string;
  lastWebhookAt: string;
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label}>
      <span className="flex gap-2">
        <TextInput readOnly value={value} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        <Button
          variant="secondary"
          className="shrink-0"
          disabled={!value}
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {},
            );
          }}
        >
          <Copy className="size-4" /> {copied ? "কপি হয়েছে" : "কপি"}
        </Button>
      </span>
    </Field>
  );
}

export function CourierForm(props: Props) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [savedEnabled, setSavedEnabled] = useState(props.enabled);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [apiKeyEnd, setApiKeyEnd] = useState(props.apiKeyEnd);
  const [secretKeyEnd, setSecretKeyEnd] = useState(props.secretKeyEnd);
  const [token, setToken] = useState(props.webhookToken);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = enabled !== savedEnabled || !!apiKey || !!secretKey;
  const hasKeys = !!apiKeyEnd && !!secretKeyEnd;

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveCourier({ enabled, apiKey, secretKey });
            if (res.ok) {
              setSavedEnabled(enabled);
              setApiKey("");
              setSecretKey("");
              setApiKeyEnd(res.apiKeyEnd ?? "");
              setSecretKeyEnd(res.secretKeyEnd ?? "");
              if (res.webhookToken) setToken(res.webhookToken);
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
          <CardHeader
            title="Steadfast Courier"
            subtitle="অর্ডার তালিকা থেকে এক বা একাধিক Confirmed অর্ডার সরাসরি Steadfast-এ বুক করা যাবে"
            action={<Truck className="size-5 text-adm-accent-strong" />}
          />
          <div className="space-y-4">
            <Toggle checked={enabled} onChange={setEnabled} label="Steadfast চালু" description="বন্ধ থাকলে অর্ডার তালিকায় কুরিয়ারে পাঠানোর বাটন দেখাবে না" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="API Key"
                error={errors.apiKey}
                hint={apiKeyEnd ? `সেভ করা আছে (শেষে …${apiKeyEnd})। বদলাতে চাইলে নতুনটা দিন।` : "Steadfast প্যানেল → API অংশ থেকে"}
              >
                <TextInput type="password" autoComplete="off" value={apiKey} error={!!errors.apiKey} placeholder={apiKeyEnd ? "••••••••" : "API Key পেস্ট করুন"} onChange={(e) => setApiKey(e.target.value.trim())} />
              </Field>
              <Field label="Secret Key" error={errors.secretKey} hint={secretKeyEnd ? `সেভ করা আছে (শেষে …${secretKeyEnd})।` : undefined}>
                <TextInput type="password" autoComplete="off" value={secretKey} error={!!errors.secretKey} placeholder={secretKeyEnd ? "••••••••" : "Secret Key পেস্ট করুন"} onChange={(e) => setSecretKey(e.target.value.trim())} />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-adm-line pt-4">
            <Button
              variant="secondary"
              disabled={pending || dirty || !hasKeys}
              onClick={() =>
                startTransition(async () => {
                  setTestMessage(null);
                  const res = await testCourier();
                  setTestMessage(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
                })
              }
            >
              <PlugZap className="size-4" /> কানেকশন পরীক্ষা করুন
            </Button>
            <span className={`text-sm ${testMessage ? (testMessage.ok ? "text-green-700" : "text-red-700") : "text-adm-muted"}`}>
              {testMessage?.text ?? "Key ঠিক থাকলে আপনার Steadfast ব্যালেন্স দেখাবে। বারবার ভুল Key দিলে Steadfast কিছুক্ষণের জন্য আটকে দেয়।"}
            </span>
          </div>
        </Card>
      </form>

      <Card>
        <CardHeader
          title="স্ট্যাটাস নিজে থেকে আপডেট (Webhook)"
          subtitle="Steadfast প্যানেল → Webhook-এ এই URL আর টোকেন বসালে পার্সেল ডেলিভারি বা ফেরত হলে এখানে নিজে থেকে আপডেট হবে। সাইট লাইভ হওয়ার পরই কাজ করবে।"
          action={<Webhook className="size-5 text-adm-accent-strong" />}
        />
        <div className="space-y-4">
          <CopyField label="Callback URL" value={props.webhookUrl} />
          <CopyField label="Auth Token (Bearer)" value={token} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-adm-muted">
            <span>
              {props.lastWebhookAt
                ? `শেষ সিগন্যাল এসেছে: ${new Date(props.lastWebhookAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}`
                : "এখনো কোনো সিগন্যাল আসেনি"}
            </span>
            <Button
              variant="ghost"
              className="h-8 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await regenerateCourierWebhookToken();
                  if (res.ok && res.token) setToken(res.token);
                })
              }
            >
              <RefreshCw className="size-3.5" /> নতুন টোকেন
            </Button>
          </div>
          {!token && <p className="text-xs text-adm-muted">প্রথমবার সেভ করলে টোকেন তৈরি হবে।</p>}
        </div>
      </Card>
    </div>
  );
}
