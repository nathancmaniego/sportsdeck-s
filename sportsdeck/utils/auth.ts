import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/prisma/db";

const REFRESH_EXPIRY_DAYS = 7;

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export type TokenUser = Pick<User, "id" | "email" | "role" | "username">;

export function generateToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    jwtSecret(),
    { expiresIn: "15m" }
  );
}

export interface AuthJwtPayload extends jwt.JwtPayload {
  id?: number;
  email?: string;
  role?: string;
  username?: string;
}

export function verifyToken(token: string): AuthJwtPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret());
    if (typeof decoded === "string" || decoded === null || typeof decoded !== "object") {
      return null;
    }
    return decoded as AuthJwtPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_EXPIRY_DAYS);
  return d;
}

export function makeRefreshCookie(token: string): string {
  const expires = refreshTokenExpiresAt().toUTCString();
  return [
    `refreshToken=${token}`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Strict`,
    `Path=/api/auth`,
    `Expires=${expires}`,
  ].join("; ");
}

export type Authenticated = { ok: true; user: User };
export type AuthError = { ok: false; error: string };

export async function authenticate(request: NextRequest): Promise<Authenticated | AuthError> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, error: "No token provided" };
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded?.id) {
    return { ok: false, error: "Invalid token" };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) return { ok: false, error: "User not found" };
  if (user.isBanned) return { ok: false, error: "User is banned" };

  return { ok: true, user };
}

export async function authenticateIncludingBanned(
  request: NextRequest
): Promise<Authenticated | AuthError> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, error: "No token provided" };
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded?.id) {
    return { ok: false, error: "Invalid token" };
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) return { ok: false, error: "User not found" };

  return { ok: true, user };
}

export function isAdmin(user: User | Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "admin";
}
