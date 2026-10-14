// Serves uploaded images in local development (UPLOAD_BASE_URL="/uploads").
// In production the img.taqwabazaar.com web server serves the folder directly.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "@/lib/uploads";

export async function GET(_request: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await params;
  const rel = parts.join("/");
  if (!/^[a-z]+\/\d{4}\/\d{2}\/[a-f0-9]{24}\.webp$/.test(rel)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const file = await readFile(path.join(/* turbopackIgnore: true */ uploadDir(), rel));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
