"use server";

import { redirect } from "next/navigation";
import { endSession, startSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type LoginState = { error?: string; email?: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "ইমেইল ও পাসওয়ার্ড দিন", email };

  const user = await prisma.adminUser.findUnique({ where: { email } });
  const ok = user?.isActive ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    // small fixed delay slows down password guessing
    await new Promise((r) => setTimeout(r, 600));
    return { error: "ইমেইল বা পাসওয়ার্ড সঠিক নয়", email };
  }

  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.adminSession.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  await startSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}
