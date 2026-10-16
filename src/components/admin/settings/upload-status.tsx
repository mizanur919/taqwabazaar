import { CheckCircle2, HardDrive, XCircle } from "lucide-react";
import type { UploadStatus } from "@/lib/uploads";
import { Card, CardHeader } from "../ui";

/** Read-only check of the image upload setup (images subdomain on the live site, a local folder in development). */
export function UploadStatusCard({ status }: { status: UploadStatus }) {
  const host = status.mode === "remote" ? new URL(status.target).host : null;
  return (
    <Card>
      <CardHeader
        title="ছবির স্টোরেজ"
        subtitle="আপলোড করা ছবি কোথায় যাচ্ছে। Hostinger-এর environment variable (UPLOAD_ENDPOINT, UPLOAD_KEY, UPLOAD_BASE_URL) থেকে আসে।"
        action={<HardDrive className="size-5 text-adm-accent-strong" />}
      />
      {status.ok ? (
        <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          <CheckCircle2 className="size-4 shrink-0" />
          {host ? `${host} এর সাথে সংযোগ ঠিক আছে` : "লোকাল ফোল্ডারে ছবি সেভ করা যাচ্ছে"}
        </p>
      ) : (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <XCircle className="size-4 shrink-0" />
            {host ? `${host} এর সাথে সংযোগ হচ্ছে না` : "লোকাল ফোল্ডারে ছবি সেভ করা যাচ্ছে না"}
          </p>
          {status.detail && <p className="mt-1 text-xs">{status.detail}</p>}
        </div>
      )}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-adm-muted">{status.mode === "remote" ? "আপলোড স্ক্রিপ্ট (UPLOAD_ENDPOINT)" : "ফোল্ডার (UPLOAD_DIR)"}</dt>
          <dd className="break-all font-mono text-xs">{status.target}</dd>
        </div>
        <div>
          <dt className="text-xs text-adm-muted">ছবির ঠিকানা (UPLOAD_BASE_URL)</dt>
          <dd className="break-all font-mono text-xs">{status.baseUrl}</dd>
        </div>
      </dl>
      {status.mode === "local" && (
        <p className="mt-3 text-xs text-adm-muted">লাইভ সাইটে UPLOAD_ENDPOINT দিলে ছবি images.taqwabazaar.com-এ যাবে।</p>
      )}
    </Card>
  );
}
