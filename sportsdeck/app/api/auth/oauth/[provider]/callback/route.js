import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import {
  getBaseUrl,
  readOAuthStateFromCookie,
  clearOAuthStateCookie,
  completeOAuthProfile,
} from "@/utils/oauth";
import {
  generateToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
  makeRefreshCookie,
} from "@/utils/auth";

const ALLOWED = new Set(["google"]);

export async function GET(request, { params }) {
  const { provider: raw } = await params;
  const provider = String(raw || "").toLowerCase();
  const baseUrl = getBaseUrl(request);

  if (!ALLOWED.has(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const oauthError = searchParams.get("error");

  const appendClearState = (response) => {
    response.headers.append("Set-Cookie", clearOAuthStateCookie());
    return response;
  };

  if (oauthError) {
    const dest =
      oauthError === "access_denied"
        ? "/login?error=oauth_denied"
        : "/login?error=oauth";
    return appendClearState(NextResponse.redirect(new URL(dest, baseUrl)));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = readOAuthStateFromCookie(request.headers.get("cookie"));

  if (!code || !state || !cookieState || state !== cookieState) {
    return appendClearState(
      NextResponse.redirect(new URL("/login?error=oauth_state", baseUrl))
    );
  }

  const result = await completeOAuthProfile(provider, code, baseUrl);
  if (result.error || !result.user) {
    return appendClearState(
      NextResponse.redirect(new URL("/login?error=oauth", baseUrl))
    );
  }

  const user = result.user;

  if (user.isBanned) {
    return appendClearState(
      NextResponse.redirect(new URL("/login?error=banned", baseUrl))
    );
  }

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  const accessToken = generateToken(user);
  const rawRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      token: rawRefreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiresAt(),
    },
  });

  const redirectUrl = new URL("/auth/oauth-callback", baseUrl);
  redirectUrl.hash = `token=${encodeURIComponent(accessToken)}`;

  const res = NextResponse.redirect(redirectUrl.toString());
  res.headers.append("Set-Cookie", makeRefreshCookie(rawRefreshToken));
  res.headers.append("Set-Cookie", clearOAuthStateCookie());
  return res;
}
