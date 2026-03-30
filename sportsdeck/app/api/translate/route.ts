import { NextRequest, NextResponse } from "next/server";
import { translateToEnglish } from "@/utils/huggingface";

const MAX_LEN = 8000;

/**
 * POST /api/translate
 * Body: { text: string }
 * Stateless translation to English (thread titles, etc.). Post bodies use
 * POST /api/posts/[id]/translate for DB-backed caching.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_LEN) {
      return NextResponse.json(
        { error: `text must be at most ${MAX_LEN} characters` },
        { status: 400 }
      );
    }

    const content = await translateToEnglish(text);
    return NextResponse.json({ content, language: "en" });
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
