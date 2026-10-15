"use server";

import { updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { hashPassword, requireAdmin, verifyPassword, type AdminViewer } from "@/lib/auth";
import { readFraudSettings, refreshRisk, saveFraudSettings } from "@/lib/fraud";
import { cleanItems, PAYMENT_BADGES, readLayout, safeLink, saveLayout, type FooterColumn, type LayoutSettings, type MenuItem } from "@/lib/layout";
import { getBalance, newWebhookToken, readSteadfastSettings, saveSteadfastSettings } from "@/lib/courier";
import { PIXEL_ID, readMetaSettings, saveMetaSettings, sendServerEvents } from "@/lib/meta";
import { normalizePhone, BD_PHONE } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { PAGE_SLUGS, saveInfoPage, saveStoreSettings, type BuyNowMode } from "@/lib/settings";
import { deleteImage, saveImage, UploadError, uploadBaseUrl } from "@/lib/uploads";

type Result = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Store-wide settings may only be changed by an Administrator. */
async function requireOwner(): Promise<AdminViewer | Result> {
  const admin = await requireAdmin();
  if (admin.role !== "ADMIN") return { ok: false, error: "শুধু Administrator এই সেটিং বদলাতে পারবেন" };
  return admin;
}
const denied = (x: AdminViewer | Result): x is Result => "ok" in x;

// ───────────── Store: Buy Now, contact, delivery fees ─────────────

export async function saveCheckoutSettings(input: { buyNowMode: BuyNowMode }): Promise<{ ok: boolean; error?: string }> {
  const who = await requireOwner();
  if (denied(who)) return who;
  await saveStoreSettings({ buyNowMode: input?.buyNowMode === "checkout" ? "checkout" : "popup" });
  updateTag("settings");
  return { ok: true };
}

export async function saveStoreInfo(input: {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  insideFee: string;
  outsideFee: string;
}): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;

  const fieldErrors: Record<string, string> = {};
  const phone = normalizePhone(input.phone);
  if (!BD_PHONE.test(phone)) fieldErrors.phone = "সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন";
  // WhatsApp: accept 01XXXXXXXXX or 8801XXXXXXXXX, store with country code
  const waDigits = String(input.whatsapp ?? "").replace(/\D/g, "");
  const whatsapp = /^01[3-9]\d{8}$/.test(waDigits) ? `88${waDigits}` : waDigits;
  if (!/^8801[3-9]\d{8}$/.test(whatsapp)) fieldErrors.whatsapp = "সঠিক WhatsApp নাম্বার দিন (01XXXXXXXXX)";
  const email = text(input.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "সঠিক ইমেইল দিন";
  const address = text(input.address, 200);
  if (address.length < 3) fieldErrors.address = "ঠিকানা লিখুন";
  const fee = (v: string) => (/^\d{1,5}$/.test(String(v).trim()) ? Number(v) : NaN);
  const insideFee = fee(input.insideFee);
  const outsideFee = fee(input.outsideFee);
  if (Number.isNaN(insideFee)) fieldErrors.insideFee = "০ বা তার বেশি সংখ্যা দিন";
  if (Number.isNaN(outsideFee)) fieldErrors.outsideFee = "০ বা তার বেশি সংখ্যা দিন";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };

  await saveStoreSettings({ phone, whatsapp, email, address, insideFee, outsideFee });
  updateTag("settings");
  return { ok: true, message: "সেভ হয়েছে। স্টোরে সাথে সাথে আপডেট হয়েছে।" };
}

// ───────────── Marketing: Facebook Pixel + Conversions API ─────────────

export async function saveMarketing(input: {
  enabled: boolean;
  pixelId: string;
  /** a new access token; empty keeps the saved one */
  token: string;
  removeToken: boolean;
  testCode: string;
}): Promise<Result & { tokenEnd?: string }> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const pixelId = String(input.pixelId ?? "").replace(/s/g, "");
  const token = String(input.token ?? "").trim();
  const testCode = text(input.testCode, 40);
  const fieldErrors: Record<string, string> = {};
  if (pixelId && !PIXEL_ID.test(pixelId)) fieldErrors.pixelId = "Pixel ID শুধু সংখ্যা, ১০-২০ ডিজিট";
  if (input.enabled && !pixelId) fieldErrors.pixelId = "Pixel চালু করতে Pixel ID দিন";
  if (token && !/^[A-Za-z0-9_-]{50,600}$/.test(token)) fieldErrors.token = "টোকেনটা ঠিক মনে হচ্ছে না, পুরোটা কপি করে আবার পেস্ট করুন";
  if (testCode && !/^[A-Za-z0-9]+$/.test(testCode)) fieldErrors.testCode = "শুধু অক্ষর আর সংখ্যা (যেমন TEST12345)";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };

  await saveMetaSettings({
    enabled: !!input.enabled,
    pixelId,
    testCode,
    ...(token ? { token } : input.removeToken ? { token: "" } : {}),
  });
  updateTag("settings");
  const saved = await readMetaSettings();
  return { ok: true, message: "সেভ হয়েছে। স্টোরে সাথে সাথে কার্যকর হয়েছে।", tokenEnd: saved.token ? saved.token.slice(-4) : "" };
}

/** Sends one PageView through the Conversions API so the admin can see it in Events Manager → Test events. */
export async function sendMetaTestEvent(): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const s = await readMetaSettings();
  if (!s.enabled || !PIXEL_ID.test(s.pixelId)) return { ok: false, error: "আগে Pixel ID দিয়ে Pixel চালু করে সেভ করুন" };
  if (!s.token) return { ok: false, error: "আগে Conversions API Access Token দিয়ে সেভ করুন" };
  const h = await headers();
  const res = await sendServerEvents(
    [
      {
        event_name: "PageView",
        event_id: `admin-test-${Date.now()}`,
        event_source_url: h.get("referer") ?? undefined,
        user_data: { client_user_agent: h.get("user-agent") ?? undefined, client_ip_address: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined },
      },
    ],
    s,
  );
  if (!res.ok) return { ok: false, error: `Facebook গ্রহণ করেনি: ${res.error}` };
  return {
    ok: true,
    message: s.testCode
      ? `Facebook ইভেন্টটা গ্রহণ করেছে। Events Manager → Test events-এ "PageView" দেখা যাবে।`
      : "Facebook ইভেন্টটা গ্রহণ করেছে। Test Event Code দেওয়া নেই, তাই এটা Overview-তে সাধারণ ইভেন্ট হিসেবে আসবে (কয়েক মিনিট লাগতে পারে)।",
  };
}

// ───────────── Info pages ─────────────

export async function savePage(slug: string, title: string, body: string): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  if (!PAGE_SLUGS.includes(slug)) return { ok: false, error: "পেজ পাওয়া যায়নি" };
  const t = text(title, 120);
  const b = String(body ?? "").trim().slice(0, 20000);
  if (t.length < 2) return { ok: false, error: "শিরোনাম লিখুন" };
  await saveInfoPage(slug, { title: t, body: b });
  updateTag("settings");
  return { ok: true, message: "পেজ সেভ হয়েছে।" };
}

// ───────────── Banners ─────────────

export async function uploadBannerImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  const who = await requireOwner();
  if (denied(who)) return { error: who.ok ? "" : who.error };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "কোনো ফাইল পাওয়া যায়নি" };
  try {
    return { url: await saveImage(file, "banners", 1600) };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    console.error("banner upload failed", e);
    return { error: "ছবি আপলোড করা যায়নি" };
  }
}

export type BannerInput = { id?: number; position: "main" | "side"; image: string; title: string; link: string; isActive: boolean };

export async function saveBanner(input: BannerInput): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const id = input.id ? Number(input.id) : undefined;
  const current = id ? await prisma.banner.findUnique({ where: { id } }) : null;
  if (id && !current) return { ok: false, error: "ব্যানার পাওয়া যায়নি" };

  const image = text(input.image, 500);
  if (!image || !(image === current?.image || image.startsWith(`${uploadBaseUrl()}/banners/`))) {
    return { ok: false, error: "ব্যানারের ছবি আপলোড করুন" };
  }
  const link = text(input.link, 300);
  // only links inside this site (or full https links) so a banner can't run javascript: URLs
  if (link && !/^\/[^/]/.test(link) && !/^https:\/\//.test(link)) {
    return { ok: false, error: "লিংক / দিয়ে শুরু হবে (যেমন /category/phone) অথবা https:// দিয়ে" };
  }
  const data = {
    position: input.position === "side" ? "side" : "main",
    image,
    title: text(input.title, 150) || null,
    link: link || null,
    isActive: !!input.isActive,
  };
  if (id) await prisma.banner.update({ where: { id }, data });
  else {
    const last = await prisma.banner.aggregate({ _max: { sortOrder: true } });
    await prisma.banner.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  if (current && current.image !== image) await deleteImage(current.image);
  updateTag("banners");
  return { ok: true };
}

export async function deleteBanner(id: number): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const banner = await prisma.banner.findUnique({ where: { id: Number(id) } });
  if (!banner) return { ok: false, error: "ব্যানার পাওয়া যায়নি" };
  await prisma.banner.delete({ where: { id: banner.id } });
  await deleteImage(banner.image);
  updateTag("banners");
  return { ok: true };
}

/** Moves a banner one step up or down among banners in the same position. */
export async function moveBanner(id: number, dir: -1 | 1): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const banner = await prisma.banner.findUnique({ where: { id: Number(id) } });
  if (!banner) return { ok: false, error: "ব্যানার পাওয়া যায়নি" };
  const siblings = await prisma.banner.findMany({ where: { position: banner.position }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const i = siblings.findIndex((b) => b.id === banner.id);
  const j = i + (dir === -1 ? -1 : 1);
  if (j < 0 || j >= siblings.length) return { ok: true };
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(siblings.map((b, n) => prisma.banner.update({ where: { id: b.id }, data: { sortOrder: n } })));
  updateTag("banners");
  return { ok: true };
}

// ───────────── Team (staff accounts) ─────────────

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function createStaff(input: { name: string; email: string; password: string; role: "ADMIN" | "STAFF" }): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const name = text(input.name, 120);
  const email = text(input.email, 191).toLowerCase();
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "নাম লিখুন";
  if (!validEmail(email)) fieldErrors.email = "সঠিক ইমেইল দিন";
  if (String(input.password ?? "").length < 8) fieldErrors.password = "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };
  try {
    await prisma.adminUser.create({
      data: { name, email, passwordHash: await hashPassword(input.password), role: input.role === "ADMIN" ? "ADMIN" : "STAFF" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "এই ইমেইলে আগেই অ্যাকাউন্ট আছে", fieldErrors: { email: "এই ইমেইলে আগেই অ্যাকাউন্ট আছে" } };
    }
    throw e;
  }
  return { ok: true, message: `${name}-এর অ্যাকাউন্ট তৈরি হয়েছে` };
}

/** Never leave the shop without an active Administrator. */
async function wouldRemoveLastAdmin(userId: number, next: { role?: string; isActive?: boolean }) {
  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN" || !user.isActive) return false;
  if (next.role === "ADMIN" && next.isActive !== false) return false;
  const otherAdmins = await prisma.adminUser.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } });
  return otherAdmins === 0;
}

export async function updateStaff(input: { id: number; role: "ADMIN" | "STAFF"; isActive: boolean }): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const id = Number(input.id);
  const role = input.role === "ADMIN" ? "ADMIN" : "STAFF";
  const isActive = !!input.isActive;
  if (id === who.id && (!isActive || role !== "ADMIN")) return { ok: false, error: "নিজের অ্যাকাউন্ট বন্ধ বা Staff করা যাবে না" };
  if (await wouldRemoveLastAdmin(id, { role, isActive })) return { ok: false, error: "অন্তত একজন সক্রিয় Administrator থাকতে হবে" };
  await prisma.adminUser.update({ where: { id }, data: { role, isActive } });
  if (!isActive) await prisma.adminSession.deleteMany({ where: { userId: id } }); // log them out everywhere
  return { ok: true };
}

export async function resetStaffPassword(id: number, password: string): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  if (String(password ?? "").length < 8) return { ok: false, error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" };
  await prisma.adminUser.update({ where: { id: Number(id) }, data: { passwordHash: await hashPassword(password) } });
  await prisma.adminSession.deleteMany({ where: { userId: Number(id) } });
  return { ok: true, message: "পাসওয়ার্ড বদলানো হয়েছে। তাকে নতুন পাসওয়ার্ড দিয়ে লগইন করতে হবে।" };
}

export async function deleteStaff(id: number): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  if (Number(id) === who.id) return { ok: false, error: "নিজের অ্যাকাউন্ট ডিলিট করা যাবে না" };
  if (await wouldRemoveLastAdmin(Number(id), { isActive: false })) return { ok: false, error: "অন্তত একজন সক্রিয় Administrator থাকতে হবে" };
  await prisma.adminUser.delete({ where: { id: Number(id) } }); // sessions cascade
  return { ok: true };
}

// ───────────── My account ─────────────

export async function updateProfile(input: { name: string; email: string }): Promise<Result> {
  const me = await requireAdmin();
  const name = text(input.name, 120);
  const email = text(input.email, 191).toLowerCase();
  if (name.length < 2) return { ok: false, error: "নাম লিখুন", fieldErrors: { name: "নাম লিখুন" } };
  if (!validEmail(email)) return { ok: false, error: "সঠিক ইমেইল দিন", fieldErrors: { email: "সঠিক ইমেইল দিন" } };
  try {
    await prisma.adminUser.update({ where: { id: me.id }, data: { name, email } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "এই ইমেইলে অন্য অ্যাকাউন্ট আছে", fieldErrors: { email: "এই ইমেইলে অন্য অ্যাকাউন্ট আছে" } };
    }
    throw e;
  }
  return { ok: true, message: "প্রোফাইল সেভ হয়েছে" };
}

export async function changePassword(input: { current: string; next: string; confirm: string }): Promise<Result> {
  const me = await requireAdmin();
  const user = await prisma.adminUser.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(String(input.current ?? ""), user.passwordHash))) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, error: "বর্তমান পাসওয়ার্ড সঠিক নয়", fieldErrors: { current: "বর্তমান পাসওয়ার্ড সঠিক নয়" } };
  }
  if (String(input.next ?? "").length < 8) return { ok: false, error: "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে", fieldErrors: { next: "কমপক্ষে ৮ অক্ষর" } };
  if (input.next !== input.confirm) return { ok: false, error: "দুটি পাসওয়ার্ড মিলছে না", fieldErrors: { confirm: "মিলছে না" } };
  await prisma.adminUser.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next) } });
  return { ok: true, message: "পাসওয়ার্ড বদলানো হয়েছে" };
}

// ───────────── Courier: Steadfast ─────────────

export async function saveCourier(input: {
  enabled: boolean;
  /** new keys; empty keeps the saved ones */
  apiKey: string;
  secretKey: string;
}): Promise<Result & { apiKeyEnd?: string; secretKeyEnd?: string; webhookToken?: string }> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const apiKey = String(input.apiKey ?? "").trim();
  const secretKey = String(input.secretKey ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  if (apiKey && !/^[A-Za-z0-9_\-]{8,200}$/.test(apiKey)) fieldErrors.apiKey = "API Key ঠিক মনে হচ্ছে না, পুরোটা কপি করে পেস্ট করুন";
  if (secretKey && !/^[A-Za-z0-9_\-]{8,200}$/.test(secretKey)) fieldErrors.secretKey = "Secret Key ঠিক মনে হচ্ছে না, পুরোটা কপি করে পেস্ট করুন";
  const current = await readSteadfastSettings();
  if (input.enabled && !(apiKey || current.apiKey)) fieldErrors.apiKey = "চালু করতে API Key দিন";
  if (input.enabled && !(secretKey || current.secretKey)) fieldErrors.secretKey = "চালু করতে Secret Key দিন";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };

  await saveSteadfastSettings({
    enabled: !!input.enabled,
    ...(apiKey ? { apiKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(current.webhookToken ? {} : { webhookToken: newWebhookToken() }),
  });
  const saved = await readSteadfastSettings();
  return { ok: true, message: "সেভ হয়েছে।", apiKeyEnd: saved.apiKey.slice(-4), secretKeyEnd: saved.secretKey.slice(-4), webhookToken: saved.webhookToken };
}

/** Checks the saved keys by asking Steadfast for the account balance. */
export async function testCourier(): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const s = await readSteadfastSettings();
  if (!s.apiKey || !s.secretKey) return { ok: false, error: "আগে API Key আর Secret Key দিয়ে সেভ করুন" };
  const res = await getBalance(s);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, message: `কানেকশন ঠিক আছে। Steadfast ব্যালেন্স: ৳${Number(res.data.current_balance ?? 0).toLocaleString("en-IN")}` };
}

export async function regenerateCourierWebhookToken(): Promise<Result & { token?: string }> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const token = newWebhookToken();
  await saveSteadfastSettings({ webhookToken: token });
  return { ok: true, message: "নতুন টোকেন তৈরি হয়েছে। Steadfast প্যানেলেও এটা বসাতে হবে।", token };
}

// ───────────── Fraud check ─────────────

export async function saveFraud(input: {
  enabled: boolean;
  /** a new BD Courier token; empty keeps the saved one */
  token: string;
  removeToken: boolean;
  safeAt: string;
  riskyBelow: string;
  minParcels: string;
}): Promise<Result & { tokenEnd?: string }> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const token = String(input.token ?? "").trim();
  const n = (v: string) => (/^\d{1,3}$/.test(String(v).trim()) ? Number(v) : NaN);
  const safeAt = n(input.safeAt);
  const riskyBelow = n(input.riskyBelow);
  const minParcels = n(input.minParcels);
  const fieldErrors: Record<string, string> = {};
  if (token && !/^[A-Za-z0-9._|\-]{10,400}$/.test(token)) fieldErrors.token = "টোকেনটা ঠিক মনে হচ্ছে না, পুরোটা কপি করে পেস্ট করুন";
  if (!(safeAt >= 1 && safeAt <= 100)) fieldErrors.safeAt = "১ থেকে ১০০";
  if (!(riskyBelow >= 0 && riskyBelow <= 100)) fieldErrors.riskyBelow = "০ থেকে ১০০";
  else if (riskyBelow > safeAt) fieldErrors.riskyBelow = "নিরাপদের সীমার চেয়ে বেশি হতে পারবে না";
  if (!(minParcels >= 1 && minParcels <= 50)) fieldErrors.minParcels = "১ থেকে ৫০";
  const current = await readFraudSettings();
  if (input.enabled && !token && (!current.token || input.removeToken)) fieldErrors.token = "চালু করতে BD Courier টোকেন দিন";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };

  await saveFraudSettings({
    enabled: !!input.enabled,
    safeAt,
    riskyBelow,
    minParcels,
    ...(token ? { token } : input.removeToken ? { token: "" } : {}),
  });
  const saved = await readFraudSettings();
  return { ok: true, message: "সেভ হয়েছে। নতুন সীমা পরের চেক থেকে কাজ করবে।", tokenEnd: saved.token.slice(-4) };
}

/** Looks up any number at BD Courier, to check the token works. */
export async function testFraudLookup(phone: string): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const p = normalizePhone(phone);
  if (!BD_PHONE.test(p)) return { ok: false, error: "সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন" };
  const s = await readFraudSettings();
  if (!s.enabled || !s.token) return { ok: false, error: "আগে BD Courier টোকেন দিয়ে চালু করে সেভ করুন" };
  const r = await refreshRisk(p, "force"); // also updates the risk on this number's orders
  if (!r.ok) return { ok: false, error: r.error };
  const c = r.report?.courier;
  return {
    ok: true,
    message: c
      ? `কাজ করছে। ${p}: মোট ${c.total}টি পার্সেল, সফল ${c.success}টি, বাতিল ${c.cancelled}টি${c.reports.length ? `, রিপোর্ট ${c.reports.length}টি` : ""}।`
      : "কাজ করছে, তবে এই নাম্বারের কোনো হিসাব পাওয়া যায়নি।",
  };
}

// ───────────── Menus and header/footer ─────────────

export async function saveMenus(input: { headerMenu: MenuItem[]; footerColumns: FooterColumn[] }): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const headerMenu = cleanItems(input?.headerMenu, 30);
  if (headerMenu.length === 0) return { ok: false, error: "Header মেনুতে অন্তত একটি আইটেম রাখুন" };
  const footerColumns = (Array.isArray(input?.footerColumns) ? input.footerColumns : []).slice(0, 4).map((c, n) => ({
    id: text(c?.id, 40) || `c${n}`,
    title: text(c?.title, 40),
    items: cleanItems(c?.items, 15),
  }));
  await saveLayout({ headerMenu, footerColumns });
  updateTag("settings");
  return { ok: true, message: "মেনু সেভ হয়েছে। স্টোরে সাথে সাথে বদলে গেছে।" };
}

export async function uploadBrandImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  const who = await requireOwner();
  if (denied(who)) return { error: who.ok ? "" : who.error };
  const file = formData.get("file");
  const kind = formData.get("kind") === "favicon" ? "favicon" : "logo";
  if (!(file instanceof File)) return { error: "কোনো ফাইল পাওয়া যায়নি" };
  try {
    return { url: await saveImage(file, "branding", kind === "favicon" ? 128 : 600) };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    console.error("brand image upload failed", e);
    return { error: "ছবি আপলোড করা যায়নি" };
  }
}

export async function saveHeaderFooter(input: {
  siteName: string;
  tagline: string;
  metaDescription: string;
  announcement: LayoutSettings["announcement"];
  logo: string;
  favicon: string;
  footerAbout: string;
  copyright: string;
  license: string;
  social: LayoutSettings["social"];
  badges: string[];
  mobileNav: boolean;
}): Promise<Result> {
  const who = await requireOwner();
  if (denied(who)) return who;
  const current = await readLayout();
  const fieldErrors: Record<string, string> = {};

  const a = input?.announcement ?? current.announcement;
  const annText = text(a.text, 160);
  const annLink = String(a.link ?? "").trim() ? safeLink(a.link) : "";
  if (String(a.link ?? "").trim() && !annLink) fieldErrors.annLink = "লিংক / দিয়ে শুরু হবে (যেমন /category/phone) অথবা https:// দিয়ে";
  if (a.enabled && !annText) fieldErrors.annText = "ঘোষণার লেখা দিন";

  const social = { facebook: "", instagram: "", youtube: "", tiktok: "" } as LayoutSettings["social"];
  for (const k of Object.keys(social) as (keyof typeof social)[]) {
    const v = String(input?.social?.[k] ?? "").trim();
    if (!v) continue;
    if (!/^https:\/\/[^\s]+$/.test(v) || v.length > 300) fieldErrors[`social_${k}`] = "https:// দিয়ে পুরো লিংক দিন";
    else social[k] = v;
  }

  // only images we uploaded ourselves (or the current ones) can be used as logo/favicon
  const ownImage = (v: unknown, cur: string) => {
    const s = String(v ?? "").trim();
    return !s || s === cur || s.startsWith(`${uploadBaseUrl()}/branding/`) ? s : null;
  };
  const logo = ownImage(input?.logo, current.logo);
  const favicon = ownImage(input?.favicon, current.favicon);
  if (logo === null) fieldErrors.logo = "লোগো আবার আপলোড করুন";
  if (favicon === null) fieldErrors.favicon = "আইকন আবার আপলোড করুন";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "কিছু তথ্য ঠিক করতে হবে", fieldErrors };

  await saveLayout({
    siteName: text(input?.siteName, 60),
    tagline: text(input?.tagline, 100),
    metaDescription: text(input?.metaDescription, 300),
    announcement: { enabled: !!a.enabled, text: annText, link: annLink, color: ["brand", "dark", "green", "red"].includes(a.color) ? a.color : "brand" },
    logo: logo!,
    favicon: favicon!,
    footerAbout: text(input?.footerAbout, 500),
    copyright: text(input?.copyright, 160),
    license: text(input?.license, 160),
    social,
    badges: (Array.isArray(input?.badges) ? input.badges : []).filter((b) => b in PAYMENT_BADGES),
    mobileNav: !!input?.mobileNav,
  });
  // replaced images are removed from disk
  if (current.logo && current.logo !== logo) await deleteImage(current.logo);
  if (current.favicon && current.favicon !== favicon) await deleteImage(current.favicon);
  updateTag("settings");
  return { ok: true, message: "সেভ হয়েছে। স্টোরে সাথে সাথে বদলে গেছে।" };
}
