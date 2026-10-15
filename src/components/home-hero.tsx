import Image from "next/image";
import Link from "next/link";
import type { BannerItem } from "@/lib/settings";
import { BannerSlider } from "./banner-slider";
import { BadgeCheck, Headphones, RotateCcw, ShieldCheck, Truck, Zap } from "lucide-react";

// Demo banners built from product photos. Replace with designed banner images later.
const IMG = "https://cdn.dummyjson.com/product-images";

const perks = [
  { icon: BadgeCheck, label: "অরিজিনাল প্রোডাক্ট" },
  { icon: Truck, label: "দ্রুত ডেলিভারি" },
  { icon: ShieldCheck, label: "অফিসিয়াল ওয়ারেন্টি" },
  { icon: Headphones, label: "২৪/৭ সাপোর্ট" },
];

const trust = [
  { icon: BadgeCheck, label: "১০০% অরিজিনাল পণ্য" },
  { icon: RotateCcw, label: "৭ দিনের মধ্যে রিটার্ন" },
  { icon: ShieldCheck, label: "নিরাপদ পেমেন্ট" },
  { icon: Zap, label: "সেরা দামে সেরা পণ্য" },
];

/**
 * Homepage hero. Banners uploaded in Admin → Settings → Banners replace the designed
 * defaults slot by slot (main slider, side banners).
 */
export function HomeHero({ banners }: { banners: { main: BannerItem[]; side: BannerItem[] } }) {
  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 pt-5 lg:grid-cols-[2.3fr_1fr]">
      {banners.main.length > 0 ? <BannerSlider banners={banners.main} /> : <DesignedMainBanner />}
      {banners.side.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
          {banners.side.map((b) => (
            <UploadedSideBanner key={b.id} banner={b} />
          ))}
        </div>
      ) : (
        <DefaultSideBanners />
      )}
    </section>
  );
}

function UploadedSideBanner({ banner }: { banner: BannerItem }) {
  const img = (
    <Image
      src={banner.image}
      alt={banner.title ?? ""}
      fill
      sizes="(max-width: 1024px) 50vw, 25vw"
      className="object-cover transition duration-300 group-hover:scale-105"
    />
  );
  const cls = "group relative block min-h-[150px] overflow-hidden rounded-2xl bg-slate-100";
  return banner.link ? (
    <Link href={banner.link} className={cls}>
      {img}
    </Link>
  ) : (
    <div className={cls}>{img}</div>
  );
}

function DesignedMainBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff4ec] via-[#fde7d8] to-[#fbd5bf]">
      <div className="grid min-h-[300px] items-center gap-4 p-6 sm:grid-cols-2 sm:p-10">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
            <Zap className="size-3" /> স্মার্ট গ্যাজেট, স্মার্ট জীবন
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-4xl">
            সেরা গ্যাজেট,
            <br />
            <span className="text-brand">সেরা দামে</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm text-ink-soft">
            অরিজিনাল মোবাইল, ল্যাপটপ, ইয়ারবাড ও স্মার্টওয়াচ এখন এক ক্লিকে আপনার হাতে।
          </p>
          <div className="mt-4 grid max-w-sm grid-cols-4 gap-2">
            {perks.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <span className="grid size-8 place-items-center rounded-full border border-brand/40 bg-white text-brand">
                  <Icon className="size-4" />
                </span>
                <span className="text-[10px] leading-tight text-ink-soft">{label}</span>
              </div>
            ))}
          </div>
          <Link
            href="/category/all"
            className="mt-5 inline-flex rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            এখনই কিনুন
          </Link>
        </div>
        <div className="relative hidden h-64 sm:block">
          <Image
            src={`${IMG}/smartphones/iphone-13-pro/1.webp`}
            alt="iPhone 13 Pro"
            fill
            preload
            sizes="(max-width: 1024px) 50vw, 30vw"
            className="object-contain drop-shadow-xl"
          />
        </div>
      </div>
      <div className="hidden grid-cols-4 gap-2 border-t border-white/70 bg-white/60 px-6 py-2 text-xs text-ink-soft backdrop-blur sm:grid">
        {trust.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center justify-center gap-1.5">
            <Icon className="size-3.5 text-brand" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DefaultSideBanners() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
      <SideBanner
        href="/category/smart-watch"
        title="স্মার্ট ওয়াচ"
        subtitle="নতুন কালেকশন"
        image={`${IMG}/mobile-accessories/apple-watch-series-4-gold/1.webp`}
        className="from-[#eef4ff] to-[#dbe7ff]"
      />
      <SideBanner
        href="/category/audio"
        title="ইয়ারবাড ও হেডফোন"
        subtitle="সাউন্ডে নতুন অভিজ্ঞতা"
        image={`${IMG}/mobile-accessories/apple-airpods-max-silver/1.webp`}
        className="from-[#f0fdf4] to-[#dcfce7]"
      />
    </div>
  );
}

function SideBanner(props: { href: string; title: string; subtitle: string; image: string; className: string }) {
  return (
    <Link
      href={props.href}
      className={`group relative flex min-h-[150px] items-start overflow-hidden rounded-2xl bg-gradient-to-br p-4 sm:items-center sm:p-5 ${props.className}`}
    >
      <div className="relative z-10">
        <p className="text-xs text-muted">{props.subtitle}</p>
        <p className="text-base font-bold text-ink sm:text-lg">{props.title}</p>
        <span className="mt-2 inline-block text-xs font-semibold text-brand">দেখুন →</span>
      </div>
      <div className="absolute bottom-2 right-2 h-1/2 w-2/3 sm:inset-y-3 sm:right-3 sm:h-auto sm:w-1/2">
        <Image
          src={props.image}
          alt={props.title}
          fill
          sizes="200px"
          className="object-contain transition duration-300 group-hover:scale-105"
        />
      </div>
    </Link>
  );
}

export function FeatureStrip() {
  const items = [
    { icon: Truck, title: "Cash on Delivery", text: "All over Bangladesh", color: "bg-green-50 text-green-600" },
    { icon: Zap, title: "Within 2 to 3 Days", text: "Delivered right on time", color: "bg-orange-50 text-brand" },
    {
      icon: Headphones,
      title: "24/7 Customer Support",
      text: "Message, Call, Chat",
      color: "bg-violet-50 text-violet-600",
    },
    {
      icon: ShieldCheck,
      title: "100% Product Guarantee",
      text: "Full product guarantee assured",
      color: "bg-pink-50 text-pink-600",
    },
  ];
  return (
    <section className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, text, color }) => (
        // phones: two narrow cards per row, so the icon sits above the text
        <div key={title} className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-3 text-center sm:flex-row sm:gap-3 sm:p-4 sm:text-left">
          <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${color}`}>
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted">{text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
