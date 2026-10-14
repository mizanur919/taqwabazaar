"use client";

// Small form primitives shared by admin forms.
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const inputClass =
  "h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-adm-accent-strong focus:ring-2 focus:ring-adm-accent/30 disabled:bg-stone-50";

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-700">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-adm-muted">{hint}</span>
      )}
    </label>
  );
}

export function TextInput({
  error,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...props} aria-invalid={error || undefined} className={`${inputClass} ${error ? "border-red-400" : "border-adm-line"} ${className}`} />;
}

export function TextArea({ error, className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={error || undefined}
      className={`${inputClass} h-auto min-h-28 py-2 leading-relaxed ${error ? "border-red-400" : "border-adm-line"} ${className}`}
    />
  );
}

export function Select({ error, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return <select {...props} aria-invalid={error || undefined} className={`${inputClass} ${error ? "border-red-400" : "border-adm-line"} ${className}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-adm-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-adm-ink" : "bg-stone-300"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-adm-ink text-white hover:bg-stone-800",
    secondary: "border border-adm-line bg-white hover:bg-stone-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "hover:bg-stone-900/5",
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

/** Native <dialog> based modal: Esc and backdrop click close it. */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`admin-theme m-auto w-[calc(100%-2rem)] ${width} rounded-2xl border border-adm-line bg-adm-surface p-0 text-adm-ink shadow-2xl backdrop:bg-stone-900/30 backdrop:backdrop-blur-sm`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="rounded-md p-1 text-adm-muted hover:bg-stone-900/5">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "ডিলিট করুন",
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md">
      <div className="text-sm text-adm-ink-soft">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          বাতিল
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "হচ্ছে..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
