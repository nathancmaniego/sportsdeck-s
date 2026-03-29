/**
 * Google OAuth helpers for the App Router.
 *
 * Env (add to .env):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL — optional; full origin e.g. https://myapp.com (no trailing slash)
 */

import crypto from "crypto";
import { prisma } from "@/prisma/db";

const STATE_COOKIE = "sd_oauth_state";

function cookieSecureFlag() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function getBaseUrl(request) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost:3000";
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function oauthRedirectUri(baseUrl, provider) {
  return `${baseUrl}/api/auth/oauth/${provider}/callback`;
}

export function setOAuthStateCookie(state) {
  const maxAge = 600;
  return `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieSecureFlag()}`;
}

export function clearOAuthStateCookie() {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecureFlag()}`;
}

export function readOAuthStateFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)sd_oauth_state=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function randomOAuthState() {
  return crypto.randomBytes(32).toString("hex");
}

export async function suggestUniqueUsername(base) {
  const normalized =
    String(base || "fan")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) || "fan";
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? normalized : `${normalized.slice(0, 20)}${i}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
    });
    if (!taken) return candidate;
  }
  return `${normalized}${Date.now()}`;
}

export function googleAuthorizeUrl(baseUrl, state) {
  const cid = process.env.GOOGLE_CLIENT_ID;
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", cid);
  u.searchParams.set("redirect_uri", oauthRedirectUri(baseUrl, "google"));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

async function exchangeGoogleCode(code, baseUrl) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: oauthRedirectUri(baseUrl, "google"),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

async function fetchGoogleProfile(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j.sub) return null;
  return {
    providerId: j.sub,
    email: j.email ? String(j.email).toLowerCase().trim() : null,
    name: j.name || j.email?.split("@")[0] || "user",
    avatarUrl: j.picture || null,
  };
}

export async function findOrCreateOAuthUser({
  provider,
  providerId,
  email,
  name,
  avatarUrl,
}) {
  if (!email) return null;

  const existingAcct = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });
  if (existingAcct?.user) {
    let u = existingAcct.user;
    if (avatarUrl && !u.avatar) {
      u = await prisma.user.update({
        where: { id: u.id },
        data: { avatar: avatarUrl },
      });
    }
    return u;
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    await prisma.oAuthAccount.create({
      data: { provider, providerId, userId: user.id },
    });
    if (avatarUrl && !user.avatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar: avatarUrl },
      });
    }
    return user;
  }

  const username = await suggestUniqueUsername(name || email.split("@")[0]);
  user = await prisma.user.create({
    data: {
      email,
      password: null,
      username,
      avatar: avatarUrl || null,
      oauthAccounts: {
        create: { provider, providerId },
      },
    },
  });
  return user;
}

/**
 * @param {string} provider — must be "google"
 * @param {string} code
 * @param {string} baseUrl
 * @returns {Promise<{ user?: import('@prisma/client').User; error?: string }>}
 */
export async function completeOAuthProfile(provider, code, baseUrl) {
  if (provider !== "google") return { error: "provider" };
  const oauthAccess = await exchangeGoogleCode(code, baseUrl);
  if (!oauthAccess) return { error: "token" };
  const prof = await fetchGoogleProfile(oauthAccess);
  if (!prof?.email) return { error: "email" };
  const user = await findOrCreateOAuthUser({
    provider: "google",
    providerId: prof.providerId,
    email: prof.email,
    name: prof.name,
    avatarUrl: prof.avatarUrl,
  });
  if (!user) return { error: "user" };
  return { user };
}
