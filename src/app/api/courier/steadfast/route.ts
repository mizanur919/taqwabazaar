// Steadfast calls this URL whenever a parcel's status changes (Admin → Settings → Courier shows the URL and token).
import { timingSafeEqual } from "node:crypto";
import { applyCourierStatus, readSteadfastSettings, saveSteadfastSettings } from "@/lib/courier";
import { prisma } from "@/lib/prisma";

const json = (body: unknown, status = 200) => Response.json(body, { status });

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function POST(request: Request) {
  const s = await readSteadfastSettings();
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!s.webhookToken || !token || !sameToken(token, s.webhookToken)) return json({ error: "Unauthorized" }, 401);

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const consignmentId = payload?.consignment_id != null ? String(payload.consignment_id) : "";
  const invoice = typeof payload?.invoice === "string" ? payload.invoice : "";
  const status = typeof payload?.status === "string" ? payload.status : "";
  if ((!consignmentId && !invoice) || !status) return json({ error: "consignment_id and status are required" }, 400);

  const order = await prisma.order.findFirst({
    where: consignmentId ? { consignmentId } : { orderNo: invoice.toUpperCase(), courier: "steadfast" },
    select: { id: true },
  });
  if (!order) return json({ error: "Order not found" }, 404);

  await applyCourierStatus(order.id, status, "Steadfast");
  await saveSteadfastSettings({ lastWebhookAt: new Date().toISOString() });
  return json({ status: "success", message: "Webhook received" });
}
