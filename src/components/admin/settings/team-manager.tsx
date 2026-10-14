"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { createStaff, deleteStaff, resetStaffPassword, updateStaff } from "@/app/admin/(panel)/settings/actions";
import { Button, ConfirmModal, Field, Modal, Select, TextInput } from "../form";
import { Card, CardHeader } from "../ui";

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  lastLoginAt: string | null;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" }) : "কখনো না";

export function TeamManager({ team, meId }: { team: TeamMember[]; meId: number }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<TeamMember | null>(null);
  const [toDelete, setToDelete] = useState<TeamMember | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.ok ? (res.message ? { ok: true, text: res.message } : null) : { ok: false, text: res.error ?? "করা যায়নি" });
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="টিম"
          subtitle="Administrator সবকিছু করতে পারেন। Staff অর্ডার, প্রোডাক্ট, স্টক আর রিপোর্ট দেখতে ও বদলাতে পারেন, কিন্তু স্টোর সেটিং আর টিম বদলাতে পারেন না।"
          action={
            <Button className="h-8 px-3 text-xs" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> নতুন সদস্য
            </Button>
          }
        />
        {message && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{message.text}</p>}
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                <th className="px-5 py-2 font-medium">সদস্য</th>
                <th className="px-2 py-2 font-medium">রোল</th>
                <th className="px-2 py-2 font-medium">অবস্থা</th>
                <th className="px-2 py-2 font-medium">শেষ লগইন</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {team.map((m) => {
                const me = m.id === meId;
                return (
                  <tr key={m.id} className="border-b border-adm-line/70 last:border-0">
                    <td className="px-5 py-2.5">
                      <p className="font-semibold">
                        {m.name} {me && <span className="text-xs font-normal text-adm-muted">(আপনি)</span>}
                      </p>
                      <p className="text-xs text-adm-muted">{m.email}</p>
                    </td>
                    <td className="px-2 py-2.5">
                      <Select
                        aria-label="রোল"
                        value={m.role}
                        disabled={me || pending}
                        onChange={(e) => run(() => updateStaff({ id: m.id, role: e.target.value as TeamMember["role"], isActive: m.isActive }))}
                        className="!h-8 w-auto"
                      >
                        <option value="ADMIN">Administrator</option>
                        <option value="STAFF">Staff</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        disabled={me || pending}
                        onClick={() => run(() => updateStaff({ id: m.id, role: m.role, isActive: !m.isActive }))}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold disabled:cursor-default ${m.isActive ? "bg-green-50 text-green-800" : "bg-stone-200 text-stone-700"}`}
                        title={me ? undefined : m.isActive ? "ক্লিক করলে বন্ধ হবে" : "ক্লিক করলে চালু হবে"}
                      >
                        {m.isActive ? "সক্রিয়" : "বন্ধ"}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-adm-muted">{fmt(m.lastLoginAt)}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        {!me && (
                          <>
                            <button type="button" title="পাসওয়ার্ড রিসেট" aria-label="পাসওয়ার্ড রিসেট" onClick={() => setResetFor(m)} className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink">
                              <KeyRound className="size-4" />
                            </button>
                            <button type="button" title="ডিলিট" aria-label="ডিলিট" onClick={() => setToDelete(m)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <AddMemberModal onClose={() => setAdding(false)} onDone={(text) => setMessage({ ok: true, text })} />}
      {resetFor && <ResetPasswordModal member={resetFor} onClose={() => setResetFor(null)} onDone={(text) => setMessage({ ok: true, text })} />}
      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`${toDelete?.name ?? ""}-এর অ্যাকাউন্ট ডিলিট করবেন?`}
        message="তিনি আর লগইন করতে পারবেন না। শুধু সাময়িকভাবে আটকাতে চাইলে অবস্থা &quot;বন্ধ&quot; করুন।"
        pending={pending}
        onConfirm={() => {
          if (toDelete) run(() => deleteStaff(toDelete.id));
          setToDelete(null);
        }}
      />
    </div>
  );
}

function AddMemberModal({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", password: "", role: "STAFF" as "ADMIN" | "STAFF" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Modal open onClose={onClose} title="নতুন সদস্য">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createStaff(v);
            if (res.ok) {
              onDone(res.message ?? "তৈরি হয়েছে");
              onClose();
              router.refresh();
            } else {
              setErrors(res.fieldErrors ?? {});
              setError(res.error);
            }
          });
        }}
      >
        <Field label="নাম" required error={errors.name}>
          <TextInput value={v.name} error={!!errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="ইমেইল" required error={errors.email} hint="এই ইমেইল দিয়ে লগইন করবেন">
          <TextInput type="email" autoComplete="off" value={v.email} error={!!errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field label="পাসওয়ার্ড" required error={errors.password} hint="কমপক্ষে ৮ অক্ষর। তাকে আলাদাভাবে জানিয়ে দিন।">
          <TextInput type="password" autoComplete="new-password" value={v.password} error={!!errors.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        </Field>
        <Field label="রোল">
          <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as "ADMIN" | "STAFF" })}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Administrator</option>
          </Select>
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "তৈরি হচ্ছে..." : "অ্যাকাউন্ট তৈরি করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose, onDone }: { member: TeamMember; onClose: () => void; onDone: (text: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Modal open onClose={onClose} title={`${member.name}-এর পাসওয়ার্ড রিসেট`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await resetStaffPassword(member.id, password);
            if (res.ok) {
              onDone(res.message ?? "বদলানো হয়েছে");
              onClose();
            } else setError(res.error);
          });
        }}
      >
        <Field label="নতুন পাসওয়ার্ড" hint="কমপক্ষে ৮ অক্ষর। তিনি সব জায়গা থেকে লগআউট হয়ে যাবেন।">
          <TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending || password.length < 8}>
            {pending ? "হচ্ছে..." : "পাসওয়ার্ড বদলান"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
