import Link from "next/link";
import { Suspense } from "react";
import { Hammer } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

// Placeholder for dashboard sections that are built in later parts.
const upcoming: Record<string, { title: string; part: string }> = {
};

export default function UpcomingSection({ params }: PageProps<"/admin/[...section]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-stone-900/5" />}>
      {params.then(({ section }) => (
        <UpcomingContent section={section[0]} />
      ))}
    </Suspense>
  );
}

async function UpcomingContent({ section }: { section: string }) {
  await requireAdmin();
  const info = upcoming[section] ?? { title: "পেজ", part: "পরের ভাগে" };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{info.title}</h1>
      <Card className="flex flex-col items-center py-16 text-center">
        <Hammer className="size-10 text-adm-accent-strong" />
        <p className="mt-4 font-semibold">এই অংশটি {info.part}-এ তৈরি হবে</p>
        <p className="mt-1 text-sm text-adm-muted">বর্তমানে Overview পেজ চালু আছে।</p>
        <Link href="/admin" className="mt-6 rounded-lg bg-adm-ink px-4 py-2 text-sm font-semibold text-white">
          Overview-তে ফিরে যান
        </Link>
      </Card>
    </div>
  );
}
