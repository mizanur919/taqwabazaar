"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import { deleteProduct, saveProduct, uploadProductImage } from "@/app/admin/(panel)/products/actions";
import type { ProductFormValues } from "@/lib/admin/products";
import { slugify } from "@/lib/slug";
import { Button, ConfirmModal, Field, Select, TextArea, TextInput, Toggle } from "./form";
import { ImageUploader } from "./image-uploader";
import { Card, CardHeader } from "./ui";

type Option = { id: number; name: string };

export const emptyProduct: ProductFormValues = {
  name: "",
  nameBn: "",
  slug: "",
  categoryId: "",
  brandId: "",
  price: "",
  salePrice: "",
  stock: "0",
  lowStockAt: "5",
  sku: "",
  warranty: "",
  description: "",
  descriptionBn: "",
  metaTitle: "",
  metaDesc: "",
  isActive: true,
  isFeatured: false,
  images: [],
  variants: [],
};

export function ProductForm({
  initial,
  categories,
  brands,
}: {
  initial: ProductFormValues;
  categories: Option[];
  brands: Option[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const isNew = !initial.id;

  const set = <K extends keyof ProductFormValues>(key: K, v: ProductFormValues[K]) => {
    setValues((s) => ({ ...s, [key]: v }));
    setSaved(false);
  };

  const hasVariants = values.variants.some((v) => v.isActive);
  const variantStock = values.variants.filter((v) => v.isActive).reduce((n, v) => n + (Number(v.stock) || 0), 0);
  const discount =
    Number(values.salePrice) > 0 && Number(values.price) > Number(values.salePrice)
      ? Math.round((1 - Number(values.salePrice) / Number(values.price)) * 100)
      : 0;

  const submit = () =>
    startTransition(async () => {
      setFormError(null);
      const res = await saveProduct(values);
      if (res.ok) {
        setErrors({});
        setSaved(true);
        // reload from the DB so new variant/image rows get their ids
        router.replace(`/admin/products/${res.id}?${isNew ? "created" : "saved"}=${Date.now()}`, { scroll: false });
      } else {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error ?? null);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5 pb-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" aria-label="প্রোডাক্ট তালিকায় ফিরে যান" className="rounded-lg border border-adm-line bg-white p-2 hover:bg-stone-50">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{isNew ? "নতুন প্রোডাক্ট" : "প্রোডাক্ট এডিট"}</h1>
            {!isNew && <p className="text-sm text-adm-muted">{initial.name}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <a href={`/product/${initial.slug}`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-adm-line bg-white px-3 text-sm font-medium hover:bg-stone-50">
              <ExternalLink className="size-4" /> স্টোরে দেখুন
            </a>
          )}
          <Button type="submit" disabled={pending}>
            {saved && !pending ? <Check className="size-4" /> : null}
            {pending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>
      </div>

      {formError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="মূল তথ্য" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="প্রোডাক্টের নাম (English)" required error={errors.name} className="sm:col-span-2">
                <TextInput
                  value={values.name}
                  error={!!errors.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugTouched) set("slug", slugify(e.target.value));
                  }}
                  placeholder="যেমন: Apple AirPods Pro 2"
                />
              </Field>
              <Field label="প্রোডাক্টের নাম (বাংলা)" hint="ঐচ্ছিক" className="sm:col-span-2">
                <TextInput value={values.nameBn} onChange={(e) => set("nameBn", e.target.value)} />
              </Field>
              <Field label="URL (slug)" error={errors.slug} hint={`taqwabazaar.com/product/${values.slug || "..."}`} className="sm:col-span-2">
                <TextInput
                  value={values.slug}
                  error={!!errors.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="ক্যাটাগরি" required error={errors.categoryId}>
                <Select
                  value={values.categoryId}
                  error={!!errors.categoryId}
                  onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">নির্বাচন করুন</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ব্র্যান্ড" error={errors.brandId}>
                <Select value={values.brandId} onChange={(e) => set("brandId", e.target.value ? Number(e.target.value) : "")}>
                  <option value="">কোনো ব্র্যান্ড নেই</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="ছবি" subtitle="প্রথম ছবিটি স্টোরে মূল ছবি হিসেবে দেখাবে" />
            <ImageUploader value={values.images} onChange={(urls) => set("images", urls)} upload={uploadProductImage} />
            {errors.images && <p className="mt-2 text-sm text-red-700">{errors.images}</p>}
          </Card>

          <Card>
            <CardHeader title="বিবরণ" />
            <div className="space-y-4">
              <Field label="বিবরণ (English)" hint="নতুন লাইন দিলে আলাদা প্যারাগ্রাফ হবে">
                <TextArea rows={6} value={values.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="বিবরণ (বাংলা)" hint="ঐচ্ছিক">
                <TextArea rows={6} value={values.descriptionBn} onChange={(e) => set("descriptionBn", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="ভ্যারিয়েন্ট"
              subtitle="কালার, স্টোরেজ বা সাইজ, যেমন: Black / 128GB"
              action={
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  onClick={() => set("variants", [...values.variants, { name: "", sku: "", price: "", stock: "0", isActive: true }])}
                >
                  <Plus className="size-3.5" /> ভ্যারিয়েন্ট যোগ
                </Button>
              }
            />
            {values.variants.length === 0 ? (
              <p className="text-sm text-adm-muted">কোনো ভ্যারিয়েন্ট নেই। একই প্রোডাক্টের আলাদা কালার বা স্টোরেজ থাকলে যোগ করুন।</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-[1.5fr_1fr_1fr_0.8fr_auto_auto] gap-2 px-1 text-xs text-adm-muted sm:grid">
                  <span>নাম</span>
                  <span>SKU</span>
                  <span>দাম (খালি = মূল দাম)</span>
                  <span>স্টক</span>
                  <span>চালু</span>
                  <span />
                </div>
                {values.variants.map((v, i) => {
                  const update = (patch: Partial<typeof v>) =>
                    set(
                      "variants",
                      values.variants.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                    );
                  return (
                    <div key={v.id ?? `new-${i}`}>
                      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto_auto]">
                        <TextInput placeholder="Black / 128GB" value={v.name} onChange={(e) => update({ name: e.target.value })} className="col-span-2 sm:col-span-1" />
                        <TextInput placeholder="SKU" value={v.sku} onChange={(e) => update({ sku: e.target.value })} />
                        <TextInput placeholder="দাম" inputMode="decimal" value={v.price} onChange={(e) => update({ price: e.target.value })} />
                        <TextInput placeholder="স্টক" inputMode="numeric" value={v.stock} onChange={(e) => update({ stock: e.target.value.replace(/\D/g, "") })} />
                        <input
                          type="checkbox"
                          aria-label="চালু"
                          checked={v.isActive}
                          onChange={(e) => update({ isActive: e.target.checked })}
                          className="size-4 accent-stone-900"
                        />
                        <button
                          type="button"
                          aria-label="ভ্যারিয়েন্ট মুছুন"
                          onClick={() => set("variants", values.variants.filter((_, j) => j !== i))}
                          className="rounded-md p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      {errors[`variant-${i}`] && <p className="mt-1 text-xs text-red-700">{errors[`variant-${i}`]}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="SEO" subtitle="Google সার্চে যা দেখাবে (খালি রাখলে নাম ও বিবরণ ব্যবহার হবে)" />
            <div className="space-y-4">
              <Field label="Meta title">
                <TextInput value={values.metaTitle} maxLength={200} onChange={(e) => set("metaTitle", e.target.value)} />
              </Field>
              <Field label="Meta description" hint={`${values.metaDesc.length}/300`}>
                <TextArea rows={3} maxLength={300} value={values.metaDesc} onChange={(e) => set("metaDesc", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="স্ট্যাটাস" />
            <div className="space-y-4">
              <Toggle checked={values.isActive} onChange={(v) => set("isActive", v)} label="স্টোরে দেখাবে" description="বন্ধ করলে কাস্টমাররা প্রোডাক্টটি দেখবে না" />
              <Toggle checked={values.isFeatured} onChange={(v) => set("isFeatured", v)} label="Featured" description="হোমপেজের Featured Product অংশে দেখাবে" />
            </div>
          </Card>

          <Card>
            <CardHeader title="দাম" />
            <div className="space-y-4">
              <Field label="রেগুলার দাম (৳)" required error={errors.price}>
                <TextInput inputMode="decimal" value={values.price} error={!!errors.price} onChange={(e) => set("price", e.target.value)} />
              </Field>
              <Field label="অফার দাম (৳)" error={errors.salePrice} hint={discount ? `${discount}% ছাড়` : "ঐচ্ছিক"}>
                <TextInput inputMode="decimal" value={values.salePrice} error={!!errors.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="স্টক ও অন্যান্য" />
            <div className="space-y-4">
              <Field
                label="স্টক"
                error={errors.stock}
                hint={hasVariants ? `ভ্যারিয়েন্টের স্টকের যোগফল: ${variantStock}` : undefined}
              >
                <TextInput
                  inputMode="numeric"
                  value={hasVariants ? String(variantStock) : values.stock}
                  disabled={hasVariants}
                  error={!!errors.stock}
                  onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="কম স্টকের সীমা" hint="স্টক এই সংখ্যা বা তার কম হলে &quot;Running low&quot; দেখাবে">
                <TextInput inputMode="numeric" value={values.lowStockAt} onChange={(e) => set("lowStockAt", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="SKU" hint="প্রোডাক্ট কোড, ঐচ্ছিক">
                <TextInput value={values.sku} onChange={(e) => set("sku", e.target.value)} />
              </Field>
              <Field label="ওয়ারেন্টি" hint="যেমন: ১ বছর অফিসিয়াল ওয়ারেন্টি">
                <TextInput value={values.warranty} onChange={(e) => set("warranty", e.target.value)} />
              </Field>
            </div>
          </Card>

          {!isNew && (
            <Card>
              <CardHeader title="ডিলিট" subtitle="প্রোডাক্ট ও এর ছবি স্থায়ীভাবে মুছে যাবে। আগের অর্ডারের তথ্য থাকবে।" />
              <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> প্রোডাক্ট ডিলিট করুন
              </Button>
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="প্রোডাক্ট ডিলিট করবেন?"
        message={
          <>
            <b>{initial.name}</b> স্থায়ীভাবে মুছে যাবে। এটি আর ফেরত আনা যাবে না। শুধু লুকাতে চাইলে &quot;স্টোরে দেখাবে&quot; বন্ধ করুন।
          </>
        }
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteProduct(initial.id!);
            if (res.ok) router.replace("/admin/products?deleted=1");
            else setFormError(res.error ?? "ডিলিট করা যায়নি");
            setConfirmDelete(false);
          })
        }
      />
    </form>
  );
}
