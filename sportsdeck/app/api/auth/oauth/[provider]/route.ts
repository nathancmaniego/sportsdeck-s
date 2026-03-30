import { NextRequest, NextResponse } from "next/server";
import {
  getBaseUrl,
  setOAuthStateCookie,
  randomOAuthState,
  googleAuthorizeUrl,
} from "@/utils/oauth";

const ALLOWED = new Set(["google"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await params;
  const provider = String(raw || "").toLowerCase();

  if (!ALLOWED.has(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });
  }

  const baseUrl = getBaseUrl(request);

  const missing =
    !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET;

  if (missing) {
    return NextResponse.redirect(new URL("/login?error=oauth_config", baseUrl));
  }

  const state = randomOAuthState();
  const url = googleAuthorizeUrl(baseUrl, state);

  const res = NextResponse.redirect(url);
  res.headers.set("Set-Cookie", setOAuthStateCookie(state));
  return res;
}
