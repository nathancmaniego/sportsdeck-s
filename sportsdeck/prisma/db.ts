import dns from "node:dns";
import { PrismaClient } from "@prisma/client";

// Prefer IPv4 when resolving DB hosts (e.g. Supabase direct URL on IPv4-only networks).
dns.setDefaultResultOrder("ipv4first");

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
