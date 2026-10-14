"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/admin-theme";
import { Card, CardHeader } from "../ui";

// Dashboard look is a per-browser preference (each staff member can pick their own).
// themeBootScript in src/lib/admin-theme.ts applies it before the first paint.
export const ACCENTS = [
  { id: "amber", label: "Amber", swatch: "#f0b43c" },
  { id: "teal", label: "Teal", swatch: "#4fb8a5" },
  { id: "rose", label: "Rose", swatch: "#ec8aa6" },
  { id: "blue", label: "Blue", swatch: "#7aa7f0" },
] as const;
const MODES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
] as const;

type Theme = { accent: (typeof ACCENTS)[number]["id"]; mode: (typeof MODES)[number]["id"] };
const DEFAULT: Theme = { accent: "amber", mode: "light" };

function read(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY) ?? "{}");
    return {
      accent: ACCENTS.some((a) => a.id === t.accent) ? t.accent : DEFAULT.accent,
      mode: MODES.some((m) => m.id === t.mode) ? t.mode : DEFAULT.mode,
    };
  } catch {
    return DEFAULT;
  }
}

function apply(t: Theme) {
  const root = document.documentElement;
  root.dataset.admAccent = t.accent;
  const dark = t.mode === "dark" || (t.mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.admMode = dark ? "dark" : "light";
}

export function AppearanceSettings() {
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [theme, setTheme] = useState<Theme | null>(null);
  const current = theme ?? (loaded ? read() : DEFAULT);

  const choose = (patch: Partial<Theme>) => {
    const next = { ...current, ...patch };
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: still applies for this visit
    }
    apply(next);
  };

  return (
    <Card>
      <CardHeader title="Appearance" subtitle="শুধু এই ব্রাউজারে আপনার জন্য প্রযোজ্য, সাথে সাথে সেভ হয়" />
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">থিম</p>
          <div className="flex w-fit rounded-lg bg-stone-900/5 p-0.5 text-sm" role="radiogroup" aria-label="থিম">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={current.mode === m.id}
                  onClick={() => choose({ mode: m.id })}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${current.mode === m.id ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}
                >
                  <Icon className="size-4" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Accent রং</p>
          <div className="flex gap-3" role="radiogroup" aria-label="Accent রং">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={current.accent === a.id}
                aria-label={a.label}
                title={a.label}
                onClick={() => choose({ accent: a.id })}
                className={`grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-adm-surface ${current.accent === a.id ? "ring-2 ring-adm-ink" : ""}`}
                style={{ background: a.swatch }}
              >
                {current.accent === a.id && <Check className="size-4 text-stone-900" />}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-adm-muted">পুরো ড্যাশবোর্ডের রং বদলে যাবে: বাটন, চার্ট, ব্যাজ আর ব্যাকগ্রাউন্ড</p>
        </div>
      </div>
    </Card>
  );
}
