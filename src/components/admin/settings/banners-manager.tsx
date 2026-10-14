"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteBanner, moveBanner, saveBanner, uploadBannerImage, type BannerInput } from "@/app/admin/(panel)/settings/actions";
import { Button, ConfirmModal, Field, Modal, TextInput, Toggle } from "../form";
import { ImageUploader } from "../image-uploader";
import { Card, CardHeader } from "../ui";

export type BannerRow = { id: number; position: string; image: string; title: string | null; link: string | null; isActive: boolean };

const sections = [
  { id: "main", title: "বড় ব্যানার (স্লাইডার)", text: "হোমপেজের বাম দিকের বড় ব্যানার। একাধিক দিলে কয়েক সেকেন্ড পর পর বদলাবে। আদর্শ মাপ ১৬০০×৭০০ পিক্সেল।" },
  { id: "side", title: "পাশের ছোট ব্যানার", text: "ডান দিকের দুটি ছোট ব্যানার (প্রথম ২টি দেখাবে)। আদর্শ মাপ ৮০০×৫০০ পিক্সেল।" },
] as const;

export function BannersManager({ banners }: { banners: BannerRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<BannerInput | null>(null);
  const [toDelete, setToDelete] = useState<BannerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.ok ? null : (res.error ?? "করা যায়নি"));
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-adm-accent-soft px-4 py-3 text-sm">
        কোনো ব্যানার না থাকলে হোমপেজে আগের মতো ডিজাইন করা ব্যানার দেখাবে। ব্যানার যোগ করলে সেটা তার জায়গা নেবে।
      </p>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {sections.map((s) => {
        const list = banners.filter((b) => b.position === s.id);
        return (
          <Card key={s.id}>
            <CardHeader
              title={s.title}
              subtitle={s.text}
              action={
                <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setEdit({ position: s.id, image: "", title: "", link: "", isActive: true })}>
                  <Plus className="size-3.5" /> যোগ করুন
                </Button>
              }
            />
            {list.length === 0 ? (
              <p className="text-sm text-adm-muted">এখনো কোনো ব্যানার নেই</p>
            ) : (
              <ul className="space-y-2">
                {list.map((b, i) => (
                  <li key={b.id} className={`flex items-center gap-3 rounded-xl border border-adm-line bg-white p-2 ${b.isActive ? "" : "opacity-60"}`}>
                    <span className="relative h-16 w-32 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                      {b.image ? <Image src={b.image} alt="" fill sizes="128px" className="object-cover" /> : <ImageOff className="m-auto mt-5 size-5" />}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-semibold">{b.title || "শিরোনাম নেই"}</p>
                      <p className="truncate text-xs text-adm-muted">{b.link || "লিংক নেই"}</p>
                      {!b.isActive && <p className="text-xs font-semibold text-adm-muted">লুকানো</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton label="উপরে" disabled={pending || i === 0} onClick={() => run(() => moveBanner(b.id, -1))}>
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton label="নিচে" disabled={pending || i === list.length - 1} onClick={() => run(() => moveBanner(b.id, 1))}>
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label="এডিট"
                        onClick={() =>
                          setEdit({ id: b.id, position: b.position === "side" ? "side" : "main", image: b.image, title: b.title ?? "", link: b.link ?? "", isActive: b.isActive })
                        }
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label="ডিলিট" danger onClick={() => setToDelete(b)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      {edit && <BannerModal initial={edit} onClose={() => setEdit(null)} />}
      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="ব্যানার ডিলিট করবেন?"
        message="ব্যানার আর এর ছবি স্থায়ীভাবে মুছে যাবে। শুধু লুকাতে চাইলে এডিট করে বন্ধ করুন।"
        pending={pending}
        onConfirm={() => {
          if (toDelete) run(() => deleteBanner(toDelete.id));
          setToDelete(null);
        }}
      />
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 disabled:opacity-30 ${danger ? "text-red-600 hover:bg-red-50" : "text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink"}`}
    >
      {children}
    </button>
  );
}

function BannerModal({ initial, onClose }: { initial: BannerInput; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<BannerInput>) => setV((s) => ({ ...s, ...patch }));

  return (
    <Modal open onClose={onClose} title={initial.id ? "ব্যানার এডিট" : "নতুন ব্যানার"} width="max-w-xl">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveBanner(v);
            if (res.ok) {
              onClose();
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <div>
          <p className="mb-1.5 text-sm font-medium">ছবি</p>
          <ImageUploader value={v.image ? [v.image] : []} onChange={(urls) => set({ image: urls[0] ?? "" })} upload={uploadBannerImage} max={1} />
        </div>
        <Field label="শিরোনাম" hint="ছবির বিবরণ হিসেবে ব্যবহার হবে (alt text), ঐচ্ছিক">
          <TextInput value={v.title} maxLength={150} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="ক্লিক করলে যাবে" hint="যেমন /category/phone বা /product/iphone-13-pro, ঐচ্ছিক">
          <TextInput value={v.link} maxLength={300} placeholder="/category/..." onChange={(e) => set({ link: e.target.value })} />
        </Field>
        <Toggle checked={v.isActive} onChange={(isActive) => set({ isActive })} label="হোমপেজে দেখাবে" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending || !v.image}>
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
