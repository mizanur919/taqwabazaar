"use client";

import { useActionState } from "react";
import { LockKeyhole, Store } from "lucide-react";
import { login, type LoginState } from "../auth-actions";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);

  return (
    <div className="admin-theme grid min-h-screen place-items-center bg-adm-bg bg-[radial-gradient(ellipse_at_top_right,#f6dfa8_0%,transparent_55%)] px-4">
      <form action={action} className="w-full max-w-sm rounded-2xl border border-adm-line bg-adm-surface p-7 shadow-xl shadow-stone-900/5">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-adm-accent text-adm-ink">
            <Store className="size-4" />
          </span>
          TaqwaBazaar
        </div>
        <h1 className="mt-6 text-2xl font-bold">অ্যাডমিন লগইন</h1>
        <p className="mt-1 text-sm text-adm-muted">ড্যাশবোর্ডে ঢুকতে আপনার ইমেইল ও পাসওয়ার্ড দিন</p>

        <label className="mt-6 block text-sm font-medium">
          ইমেইল
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state?.email}
            className="mt-1.5 h-11 w-full rounded-lg border border-adm-line bg-white px-3 text-sm outline-none focus:border-adm-accent-strong"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          পাসওয়ার্ড
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1.5 h-11 w-full rounded-lg border border-adm-line bg-white px-3 text-sm outline-none focus:border-adm-accent-strong"
          />
        </label>

        {state?.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-adm-ink text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
        >
          <LockKeyhole className="size-4" /> {pending ? "লগইন হচ্ছে..." : "লগইন"}
        </button>
      </form>
    </div>
  );
}
