import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { getInfoPage, getStoreSettings, PAGE_SLUGS } from "@/lib/settings";

export function generateStaticParams() {
  return PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/page/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getInfoPage(slug))?.title ?? "পেজ" };
}

// About / Privacy / Refund / Contact. Text is edited in Admin → Settings → Pages.
export default async function InfoPage({ params }: PageProps<"/page/[slug]">) {
  const { slug } = await params;
  const page = await getInfoPage(slug);
  if (!page) notFound();
  const contact = slug === "contact-us" ? await getStoreSettings() : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <div className="mt-6 space-y-4 rounded-xl border border-line bg-white p-6 leading-relaxed text-ink-soft">
        {contact && (
          <ul className="space-y-2 border-b border-line pb-4 text-ink">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-brand" /> <a href={`tel:${contact.phone}`} className="hover:text-brand">{contact.phone}</a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-brand" /> <a href={`mailto:${contact.email}`} className="hover:text-brand">{contact.email}</a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-brand" /> {contact.address}
            </li>
          </ul>
        )}
        {page.body
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
      </div>
    </article>
  );
}
