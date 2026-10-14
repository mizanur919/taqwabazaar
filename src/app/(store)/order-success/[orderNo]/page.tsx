import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleCheck, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { taka } from "@/lib/format";
import { getStoreSettings } from "@/lib/settings";
import { deliveryZones } from "@/lib/site";

export const metadata: Metadata = { title: "অর্ডার সম্পন্ন হয়েছে", robots: { index: false } };

export default function OrderSuccessPage({ params }: PageProps<"/order-success/[orderNo]">) {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[60vh] max-w-2xl px-4 py-16" />}>
      {params.then(({ orderNo }) => (
        <OrderSummary orderNo={orderNo} />
      ))}
    </Suspense>
  );
}

// Order numbers are sequential, so this page deliberately shows no address and a masked phone.
const maskPhone = (p: string) => `${p.slice(0, 3)}****${p.slice(-4)}`;

async function OrderSummary({ orderNo }: { orderNo: string }) {
  const order = await prisma.order.findUnique({
    where: { orderNo: decodeURIComponent(orderNo).toUpperCase() },
    include: { items: true },
  });
  if (!order || order.deletedAt) notFound();

  const zone = deliveryZones.find((z) => z.id === order.zone);
  const { phone } = await getStoreSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <CircleCheck className="mx-auto size-16 text-green-600" />
        <h1 className="mt-4 text-3xl font-bold">ধন্যবাদ! আপনার অর্ডারটি সফল হয়েছে</h1>
        <p className="mt-2 text-muted">
          শীঘ্রই আমাদের প্রতিনিধি <span className="font-semibold text-ink">{maskPhone(order.phone)}</span> নাম্বারে কল করে
          অর্ডারটি কনফার্ম করবেন।
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-line bg-white">
        <div className="grid grid-cols-2 gap-4 border-b border-line p-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">অর্ডার নাম্বার</p>
            <p className="text-lg font-bold text-brand">{order.orderNo}</p>
          </div>
          <div>
            <p className="text-muted">পেমেন্ট</p>
            <p className="font-semibold">ক্যাশ অন ডেলিভারি</p>
          </div>
          <div>
            <p className="text-muted">ডেলিভারি</p>
            <p className="font-semibold">{zone?.label ?? order.zone}</p>
          </div>
        </div>

        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-4">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                {item.image && <Image src={item.image} alt={item.name} fill sizes="56px" className="object-contain p-1" />}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">
                  {item.name}
                  {item.variantName && <span className="font-normal text-muted"> ({item.variantName})</span>}
                </p>
                <p className="text-muted">
                  {taka(Number(item.unitPrice))} × {item.quantity}
                </p>
              </div>
              <p className="font-semibold">{taka(Number(item.unitPrice) * item.quantity)}</p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-line p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">সাবটোটাল</dt>
            <dd>{taka(Number(order.subtotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">ডেলিভারি চার্জ</dt>
            <dd>{taka(Number(order.shippingFee))}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
            <dt>সর্বমোট (ডেলিভারির সময় পরিশোধ করবেন)</dt>
            <dd>{taka(Number(order.total))}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className="rounded-lg bg-brand px-6 py-3 text-center text-sm font-semibold text-white hover:bg-brand-dark">
          আরও কেনাকাটা করুন
        </Link>
        <Link href="/track-order" className="rounded-lg border border-ink px-6 py-3 text-center text-sm font-semibold hover:bg-slate-50">
          অর্ডার ট্র্যাক করুন
        </Link>
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
        <Phone className="size-4" /> যেকোনো প্রয়োজনে কল করুন: <a href={`tel:${phone}`} className="font-semibold text-ink">{phone}</a>
      </p>
    </div>
  );
}
