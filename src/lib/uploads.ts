// Image uploads: validate, resize to WebP with sharp, then store them in one of two places:
// - live site: UPLOAD_ENDPOINT is set (https://images.taqwabazaar.com/_upload/upload.php). The file is posted
//   there with UPLOAD_KEY and served by that subdomain; UPLOAD_BASE_URL = https://images.taqwabazaar.com.
//   The PHP script lives in hosting/images/_upload/.
// - local development: no UPLOAD_ENDPOINT. Files go to UPLOAD_DIR (default storage/uploads) and the app
//   serves them at UPLOAD_BASE_URL = "/uploads" (src/app/uploads).
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

// turbopackIgnore: the folder is chosen at runtime, so the bundler must not try to trace it
export const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "storage/uploads");
export const uploadBaseUrl = () => (process.env.UPLOAD_BASE_URL || "/uploads").replace(/\/+$/, "");
const uploadEndpoint = () => (process.env.UPLOAD_ENDPOINT || "").trim();

export class UploadError extends Error {}

type Kind = "products" | "categories" | "brands" | "banners" | "branding";

/** File names this code creates: <kind>/<yyyy>/<mm>/<24 hex>.webp */
const OWN_FILE = /^[a-z]+\/\d{4}\/\d{2}\/[a-f0-9]{24}\.webp$/;

type RemoteReply = { ok?: boolean; error?: string; path?: string; writable?: boolean; php?: string };

/** One POST to the images subdomain script. Throws on network errors and non-JSON replies. */
async function callEndpoint(form: FormData): Promise<{ status: number; body: RemoteReply }> {
  const res = await fetch(uploadEndpoint(), {
    method: "POST",
    headers: { "X-Upload-Key": process.env.UPLOAD_KEY || "" },
    body: form,
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as RemoteReply | null;
  if (!body) throw new Error(`images server replied HTTP ${res.status} without JSON`);
  return { status: res.status, body };
}

/** Saves one image and returns its public URL. Throws UploadError with a Bangla message. */
export async function saveImage(file: File, kind: Kind, maxSize = 1200): Promise<string> {
  if (file.size === 0) throw new UploadError("খালি ফাইল");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`"${file.name}" ৫MB এর বেশি বড়`);

  const input = Buffer.from(await file.arrayBuffer());
  // Check the real file contents, not the extension or browser-supplied type.
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new UploadError(`"${file.name}" কোনো বৈধ ছবি নয়`);
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new UploadError(`"${file.name}": শুধু JPG, PNG বা WebP ছবি দেওয়া যাবে`);
  }

  const output = await sharp(input, { limitInputPixels: 40_000_000 })
    .rotate() // respect phone camera orientation
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  if (uploadEndpoint()) {
    const form = new FormData();
    form.set("action", "upload");
    form.set("kind", kind);
    form.set("file", new Blob([new Uint8Array(output)], { type: "image/webp" }), "image.webp");
    let reply: { status: number; body: RemoteReply };
    try {
      reply = await callEndpoint(form);
    } catch (e) {
      console.error("image upload to images server failed", e);
      throw new UploadError("ছবির সার্ভারে পৌঁছানো যায়নি। একটু পরে আবার চেষ্টা করুন।");
    }
    if (!reply.body.ok || !reply.body.path || !OWN_FILE.test(reply.body.path)) {
      console.error("images server refused upload", reply.status, reply.body.error);
      throw new UploadError(reply.status === 401 ? "ছবির সার্ভারের key মিলছে না (UPLOAD_KEY)" : "ছবির সার্ভার ছবিটা সেভ করতে পারেনি");
    }
    return `${uploadBaseUrl()}/${reply.body.path}`;
  }

  const now = new Date();
  const relDir = path.posix.join(kind, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const name = `${randomBytes(12).toString("hex")}.webp`;
  const absDir = path.join(/* turbopackIgnore: true */ uploadDir(), relDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, name), output);
  return `${uploadBaseUrl()}/${relDir}/${name}`;
}

/** Deletes a file we uploaded earlier. URLs from elsewhere (e.g. demo images) are ignored. */
export async function deleteImage(url: string | null | undefined) {
  const base = uploadBaseUrl();
  if (!url || !url.startsWith(`${base}/`)) return;
  const rel = url.slice(base.length + 1);
  if (!OWN_FILE.test(rel)) return; // only our own file names
  if (uploadEndpoint()) {
    const form = new FormData();
    form.set("action", "delete");
    form.set("path", rel);
    await callEndpoint(form).catch((e) => console.error("image delete on images server failed", e));
    return;
  }
  const abs = path.join(/* turbopackIgnore: true */ uploadDir(), rel);
  if (!abs.startsWith(uploadDir() + path.sep)) return;
  await unlink(abs).catch(() => {});
}

export type UploadStatus = {
  mode: "remote" | "local";
  /** endpoint URL (remote) or folder on disk (local) */
  target: string;
  baseUrl: string;
  ok: boolean;
  detail: string | null;
};

/**
 * Whether uploads will work, shown in Admin → Settings → Store, so the live setup can be checked
 * without logging into the host: pings the images subdomain script, or test-writes the local folder.
 */
export async function uploadStatus(): Promise<UploadStatus> {
  const baseUrl = uploadBaseUrl();
  const target = uploadEndpoint();
  if (target) {
    const form = new FormData();
    form.set("action", "ping");
    try {
      const { status, body } = await callEndpoint(form);
      if (status === 401) return { mode: "remote", target, baseUrl, ok: false, detail: "key মিলছে না: UPLOAD_KEY আর upload-key.php একই কিনা দেখুন" };
      if (!body.ok) return { mode: "remote", target, baseUrl, ok: false, detail: body.error ?? `HTTP ${status}` };
      if (!body.writable) return { mode: "remote", target, baseUrl, ok: false, detail: "সংযোগ হয়েছে, কিন্তু সাবডোমেইনের ফোল্ডারে লেখার অনুমতি নেই" };
      return { mode: "remote", target, baseUrl, ok: true, detail: `PHP ${body.php ?? ""}` };
    } catch (e) {
      return { mode: "remote", target, baseUrl, ok: false, detail: `upload.php পাওয়া যায়নি বা সাড়া দিচ্ছে না (${e instanceof Error ? e.message : String(e)})` };
    }
  }
  const dir = uploadDir();
  try {
    await mkdir(dir, { recursive: true });
    const probe = path.join(/* turbopackIgnore: true */ dir, `.write-test-${randomBytes(4).toString("hex")}`);
    await writeFile(probe, "ok");
    await unlink(probe);
    return { mode: "local", target: dir, baseUrl, ok: true, detail: null };
  } catch (e) {
    return { mode: "local", target: dir, baseUrl, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
