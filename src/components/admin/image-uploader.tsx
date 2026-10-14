"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

type UploadFn = (formData: FormData) => Promise<{ url?: string; error?: string }>;

/** Drag & drop multi-image picker. The first image is the main (cover) image. */
export function ImageUploader({
  value,
  onChange,
  upload,
  max = 10,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  upload: UploadFn;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const list = [...files].slice(0, Math.max(0, max - value.length));
    if (!list.length) return;
    setErrors([]);
    setBusy(list.length);
    let urls = [...value];
    const failed: string[] = [];
    // one request per file keeps each under the server action size limit
    for (const file of list) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await upload(fd);
        if (res.url) {
          urls = [...urls, res.url];
          onChange(urls);
        } else failed.push(res.error ?? `"${file.name}" আপলোড হয়নি`);
      } catch {
        failed.push(`"${file.name}" আপলোড হয়নি (ফাইল খুব বড় হতে পারে)`);
      }
      setBusy((n) => n - 1);
    }
    setErrors(failed);
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {value.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-adm-line bg-white">
            <Image src={url} alt="" fill sizes="160px" className="object-contain p-2" />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-adm-ink px-2 py-0.5 text-[10px] font-semibold text-white">
                <Star className="size-3" /> মূল ছবি
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <div className="flex gap-1">
                <IconBtn label="বামে সরান" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowLeft className="size-3.5" />
                </IconBtn>
                <IconBtn label="ডানে সরান" onClick={() => move(i, 1)} disabled={i === value.length - 1}>
                  <ArrowRight className="size-3.5" />
                </IconBtn>
              </div>
              <IconBtn label="ছবি সরান" onClick={() => onChange(value.filter((u) => u !== url))} danger>
                <Trash2 className="size-3.5" />
              </IconBtn>
            </div>
          </div>
        ))}

        {Array.from({ length: busy }, (_, i) => (
          <div key={`busy-${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-adm-line bg-white">
            <Loader2 className="size-5 animate-spin text-adm-muted" />
          </div>
        ))}

        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center text-xs transition ${
              dragging ? "border-adm-accent-strong bg-adm-accent-soft" : "border-adm-line bg-white hover:border-adm-accent-strong"
            }`}
          >
            <ImagePlus className="size-6 text-adm-accent-strong" />
            <span className="font-medium">ছবি যোগ করুন</span>
            <span className="px-2 text-[10px] text-adm-muted">টেনে আনুন বা ক্লিক করুন</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-adm-muted">JPG, PNG বা WebP · প্রতিটি সর্বোচ্চ ৫MB · সর্বোচ্চ {max}টি · আপলোডের সময় ছবি ছোট করে WebP করা হয়</p>
      {errors.map((e) => (
        <p key={e} className="mt-1 text-xs text-red-700">
          {e}
        </p>
      ))}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-7 place-items-center rounded-md bg-white/90 disabled:opacity-40 ${danger ? "text-red-600 hover:bg-red-50" : "hover:bg-white"}`}
    >
      {children}
    </button>
  );
}
