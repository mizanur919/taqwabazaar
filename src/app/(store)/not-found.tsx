import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-bold">পেজটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-2 text-muted">আপনি যে পেজটি খুঁজছেন সেটি সরানো হয়েছে বা নেই।</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        হোমপেজে ফিরে যান
      </Link>
    </div>
  );
}
