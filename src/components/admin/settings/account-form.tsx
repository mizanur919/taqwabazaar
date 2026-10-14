"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePassword, updateProfile } from "@/app/admin/(panel)/settings/actions";
import { Button, Field, TextInput } from "../form";
import { Card, CardHeader } from "../ui";

type Msg = { ok: boolean; text: string } | null;

export function AccountForm({ initial }: { initial: { name: string; email: string; role: string } }) {
  const router = useRouter();
  const [profile, setProfile] = useState({ name: initial.name, email: initial.email });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="প্রোফাইল" subtitle={initial.role === "ADMIN" ? "Administrator" : "Staff"} />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await updateProfile(profile);
              setProfileErrors(res.ok ? {} : (res.fieldErrors ?? {}));
              setProfileMsg(res.ok ? { ok: true, text: res.message ?? "সেভ হয়েছে" } : { ok: false, text: res.error });
              if (res.ok) router.refresh(); // sidebar shows the new name
            });
          }}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-adm-accent-soft text-lg font-bold text-adm-accent-strong">
              {profile.name
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <p className="text-xs text-adm-muted">নামের প্রথম অক্ষর দিয়ে ছবি তৈরি হয়</p>
          </div>
          <Field label="নাম" error={profileErrors.name}>
            <TextInput value={profile.name} error={!!profileErrors.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Field label="ইমেইল" error={profileErrors.email} hint="লগইনের সময় এই ইমেইল ব্যবহার করবেন">
            <TextInput type="email" value={profile.email} error={!!profileErrors.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </Field>
          <div className="flex items-center justify-end gap-3">
            {profileMsg && <span className={`text-sm ${profileMsg.ok ? "text-green-700" : "text-red-700"}`}>{profileMsg.text}</span>}
            <Button type="submit" disabled={pending || (profile.name === initial.name && profile.email === initial.email)}>
              সেভ করুন
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="পাসওয়ার্ড" subtitle="নিয়মিত পাসওয়ার্ড বদলান, অন্য কারো সাথে শেয়ার করবেন না" />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await changePassword(pw);
              setPwErrors(res.ok ? {} : (res.fieldErrors ?? {}));
              setPwMsg(res.ok ? { ok: true, text: res.message ?? "বদলানো হয়েছে" } : { ok: false, text: res.error });
              if (res.ok) setPw({ current: "", next: "", confirm: "" });
            });
          }}
        >
          <Field label="বর্তমান পাসওয়ার্ড" error={pwErrors.current}>
            <TextInput type="password" autoComplete="current-password" value={pw.current} error={!!pwErrors.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="নতুন পাসওয়ার্ড" error={pwErrors.next} hint="কমপক্ষে ৮ অক্ষর">
            <TextInput type="password" autoComplete="new-password" value={pw.next} error={!!pwErrors.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="নতুন পাসওয়ার্ড আবার" error={pwErrors.confirm}>
            <TextInput type="password" autoComplete="new-password" value={pw.confirm} error={!!pwErrors.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <div className="flex items-center justify-end gap-3">
            {pwMsg && <span className={`text-sm ${pwMsg.ok ? "text-green-700" : "text-red-700"}`}>{pwMsg.text}</span>}
            <Button type="submit" disabled={pending || !pw.current || !pw.next}>
              পাসওয়ার্ড বদলান
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
