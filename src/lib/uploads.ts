// Image uploads: validate, resize to WebP with sharp, store outside the app folder.
// UPLOAD_DIR  = folder on disk (Hostinger: the img.taqwabazaar.com folder)
// UPLOAD_BASE_URL = public URL of that folder (Hostinger: https://img.taqwabazaar.com)
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

// turbopackIgnore: the folder is chosen at runtime, so the bundler must not try to trace it
export const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "storage/uploads");
export const uploadBaseUrl = () => (process.env.UPLOAD_BASE_URL || "/uploads").replace(/\/+$/, "");

export class UploadError extends Error {}

type Kind = "products" | "categories" | "brands" | "banners";

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
  if (!/^[a-z]+\/\d{4}\/\d{2}\/[a-f0-9]{24}\.webp$/.test(rel)) return; // only our own file names
  const abs = path.join(/* turbopackIgnore: true */ uploadDir(), rel);
  if (!abs.startsWith(uploadDir() + path.sep)) return;
  await unlink(abs).catch(() => {});
}
