"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteBrand,
  deleteCategory,
  saveBrand,
  saveCategory,
  uploadBrandLogo,
  uploadCategoryImage,
  type BrandInput,
  type CategoryInput,
} from "@/app/admin/(panel)/categories/actions";
import { CategoryIcon, categoryIcons } from "@/components/category-icon";
import { slugify } from "@/lib/slug";
import { Button, ConfirmModal, Field, Modal, TextInput, Toggle } from "./form";
import { ImageUploader } from "./image-uploader";
import { Card } from "./ui";

export type CategoryRow = {
  id: number;
  name: string;
  nameBn: string | null;
  slug: string;
  icon: string | null;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  products: number;
};
export type BrandRow = { id: number; name: string; slug: string; logo: string | null; products: number };

export function CatalogManager({ categories, brands }: { categories: CategoryRow[]; brands: BrandRow[] }) {
  const [tab, setTab] = useState<"categories" | "brands">("categories");
  const [editCategory, setEditCategory] = useState<CategoryInput | null>(null);
  const [editBrand, setEditBrand] = useState<BrandInput | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "category" | "brand"; id: number; name: string; warning?: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categories &amp; Brands</h1>
          <p className="text-sm text-adm-muted">স্টোরের মেনু আর ফিল্টারে এগুলোই দেখায়</p>
        </div>
        <Button
          onClick={() =>
            tab === "categories"
              ? setEditCategory({ name: "", nameBn: "", slug: "", icon: "package", image: "", sortOrder: String(categories.length), isActive: true })
              : setEditBrand({ name: "", slug: "", logo: "" })
          }
        >
          <Plus className="size-4" /> {tab === "categories" ? "নতুন ক্যাটাগরি" : "নতুন ব্র্যান্ড"}
        </Button>
      </div>

      <div className="flex w-fit rounded-lg bg-stone-900/5 p-0.5 text-sm">
        {(
          [
            ["categories", `Categories (${categories.length})`],
            ["brands", `Brands (${brands.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 ${tab === id ? "bg-adm-ink font-semibold text-white" : "text-adm-ink-soft hover:text-adm-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {deleteError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{deleteError}</p>}

      <Card className="!p-0">
        <div className="overflow-x-auto">
          {tab === "categories" ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-2 py-3 font-medium">URL</th>
                  <th className="px-2 py-3 text-right font-medium">Products</th>
                  <th className="px-2 py-3 text-right font-medium">ক্রম</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-adm-line/70 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="relative grid size-10 place-items-center overflow-hidden rounded-lg bg-adm-accent-soft text-adm-accent-strong">
                          {c.image ? <Image src={c.image} alt="" fill sizes="40px" className="object-contain p-1" /> : <CategoryIcon name={c.icon} className="size-5" />}
                        </span>
                        <span>
                          <span className="block font-semibold">{c.name}</span>
                          {c.nameBn && <span className="block text-xs text-adm-muted">{c.nameBn}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-adm-muted">/category/{c.slug}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.products}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{c.sortOrder}</td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? "bg-green-50 text-green-800" : "bg-stone-100 text-stone-700"}`}>
                        <span className={`size-1.5 rounded-full ${c.isActive ? "bg-green-600" : "bg-stone-500"}`} />
                        {c.isActive ? "চালু" : "লুকানো"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <RowButtons
                        onEdit={() =>
                          setEditCategory({
                            id: c.id,
                            name: c.name,
                            nameBn: c.nameBn ?? "",
                            slug: c.slug,
                            icon: c.icon ?? "package",
                            image: c.image ?? "",
                            sortOrder: String(c.sortOrder),
                            isActive: c.isActive,
                          })
                        }
                        onDelete={() =>
                          setToDelete({
                            kind: "category",
                            id: c.id,
                            name: c.name,
                            warning: c.products ? `এই ক্যাটাগরিতে ${c.products}টি প্রোডাক্ট আছে, তাই ডিলিট করা যাবে না।` : undefined,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-adm-line text-left text-xs text-adm-muted">
                  <th className="px-5 py-3 font-medium">Brand</th>
                  <th className="px-2 py-3 font-medium">URL</th>
                  <th className="px-2 py-3 text-right font-medium">Products</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-adm-line/70 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="relative grid size-10 place-items-center overflow-hidden rounded-lg border border-adm-line bg-white text-xs font-bold text-adm-muted">
                          {b.logo ? <Image src={b.logo} alt="" fill sizes="40px" className="object-contain p-1" /> : b.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-semibold">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-adm-muted">{b.slug}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{b.products}</td>
                    <td className="px-5 py-2.5">
                      <RowButtons
                        onEdit={() => setEditBrand({ id: b.id, name: b.name, slug: b.slug, logo: b.logo ?? "" })}
                        onDelete={() =>
                          setToDelete({
                            kind: "brand",
                            id: b.id,
                            name: b.name,
                            warning: b.products ? `${b.products}টি প্রোডাক্ট থেকে এই ব্র্যান্ড সরে যাবে (প্রোডাক্টগুলো থাকবে)।` : undefined,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {editCategory && <CategoryModal initial={editCategory} onClose={() => setEditCategory(null)} />}
      {editBrand && <BrandModal initial={editBrand} onClose={() => setEditBrand(null)} />}

      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`"${toDelete?.name}" ডিলিট করবেন?`}
        message={toDelete?.warning ?? "এটি স্থায়ীভাবে মুছে যাবে।"}
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            if (!toDelete) return;
            const res = toDelete.kind === "category" ? await deleteCategory(toDelete.id) : await deleteBrand(toDelete.id);
            setDeleteError(res.ok ? null : (res.error ?? "ডিলিট করা যায়নি"));
            setToDelete(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}

function RowButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEdit} aria-label="এডিট" title="এডিট" className="rounded-md p-1.5 text-adm-muted hover:bg-stone-900/5 hover:text-adm-ink">
        <Pencil className="size-4" />
      </button>
      <button type="button" onClick={onDelete} aria-label="ডিলিট" title="ডিলিট" className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function CategoryModal({ initial, onClose }: { initial: CategoryInput; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<CategoryInput>) => setV((s) => ({ ...s, ...patch }));

  return (
    <Modal open onClose={onClose} title={initial.id ? "ক্যাটাগরি এডিট" : "নতুন ক্যাটাগরি"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveCategory(v);
            if (res.ok) {
              onClose();
              router.refresh();
            } else {
              setErrors(res.fieldErrors ?? {});
              setError(res.error ?? null);
            }
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="নাম (English)" required error={errors.name}>
            <TextInput
              value={v.name}
              error={!!errors.name}
              onChange={(e) => set({ name: e.target.value, ...(initial.id ? {} : { slug: slugify(e.target.value) }) })}
            />
          </Field>
          <Field label="নাম (বাংলা)">
            <TextInput value={v.nameBn} onChange={(e) => set({ nameBn: e.target.value })} />
          </Field>
          <Field label="URL" error={errors.slug} hint={`/category/${v.slug || "..."}`}>
            <TextInput value={v.slug} error={!!errors.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
          </Field>
          <Field label="ক্রম" hint="ছোট সংখ্যা আগে দেখাবে">
            <TextInput inputMode="numeric" value={v.sortOrder} onChange={(e) => set({ sortOrder: e.target.value.replace(/[^\d-]/g, "") })} />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">আইকন</p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {Object.keys(categoryIcons).map((name) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                title={name}
                onClick={() => set({ icon: name })}
                className={`grid aspect-square place-items-center rounded-lg border ${v.icon === name ? "border-adm-ink bg-adm-accent-soft" : "border-adm-line bg-white hover:border-adm-accent-strong"}`}
              >
                <CategoryIcon name={name} className="size-5" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">ছবি (ঐচ্ছিক, দিলে আইকনের বদলে দেখাবে)</p>
          <ImageUploader value={v.image ? [v.image] : []} onChange={(urls) => set({ image: urls[0] ?? "" })} upload={uploadCategoryImage} max={1} />
        </div>

        <Toggle checked={v.isActive} onChange={(isActive) => set({ isActive })} label="স্টোরে দেখাবে" />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BrandModal({ initial, onClose }: { initial: BrandInput; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<BrandInput>) => setV((s) => ({ ...s, ...patch }));

  return (
    <Modal open onClose={onClose} title={initial.id ? "ব্র্যান্ড এডিট" : "নতুন ব্র্যান্ড"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveBrand(v);
            if (res.ok) {
              onClose();
              router.refresh();
            } else {
              setErrors(res.fieldErrors ?? {});
              setError(res.error ?? null);
            }
          });
        }}
      >
        <Field label="নাম" required error={errors.name}>
          <TextInput
            value={v.name}
            error={!!errors.name}
            onChange={(e) => set({ name: e.target.value, ...(initial.id ? {} : { slug: slugify(e.target.value) }) })}
          />
        </Field>
        <Field label="URL" error={errors.slug}>
          <TextInput value={v.slug} error={!!errors.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">লোগো (ঐচ্ছিক)</p>
          <ImageUploader value={v.logo ? [v.logo] : []} onChange={(urls) => set({ logo: urls[0] ?? "" })} upload={uploadBrandLogo} max={1} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
