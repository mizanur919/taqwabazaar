// Creates (or resets the password of) an admin user.
// Usage: npm run admin:create -- <email> <password> [name]
//   or set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env and run without arguments.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// Must match hashPassword() in src/lib/auth.ts
async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

const [argEmail, argPassword, ...nameParts] = process.argv.slice(2);
const email = (argEmail ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = argPassword ?? process.env.ADMIN_PASSWORD ?? "";
const name = nameParts.join(" ") || process.env.ADMIN_NAME || "Admin";

if (!email || password.length < 8) {
  console.error("Provide an email and a password of at least 8 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await hashPassword(password);
const user = await prisma.adminUser.upsert({
  where: { email },
  create: { email, name, passwordHash, role: "ADMIN" },
  update: { passwordHash, isActive: true },
});
await prisma.adminSession.deleteMany({ where: { userId: user.id } });
console.log(`Admin ready: ${user.email} (id ${user.id})`);
await prisma.$disconnect();
