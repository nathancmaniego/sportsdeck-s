import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { translateToEnglish } from "@/utils/huggingface";
// Prompt: POST /api/posts/[id]/translate — translate a post's content to English.
// Check the Translation table for a cached result first. If not cached, call
// translateToEnglish() from huggingface.js and store the result. Public endpoint.
// Claude Sonnet 4.6

/**
 * POST /api/posts/[id]/translate
 *
 * Translates the post content to English. Results are cached in the
 * Translation table (@@unique([postId, language])) so the same post is
 * never sent to HF twice for the same language.
 *
 * No auth required — translation is a public read-only feature.
 *
 * Response:
 *   {
 *     postId      : number
 *     language    : "en"
 *     content     : string   // translated (or original if already English)
 *     cached      : boolean
 *   }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);
  if (isNaN(postId))
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

  // Verify post exists and is visible
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, content: true, isHidden: true },
  });
  if (!post || post.isHidden)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const language = "en";

  // Return cached translation if it exists
  const cached = await prisma.translation.findUnique({
    where: { postId_language: { postId, language } },
  });
  if (cached) {
    return NextResponse.json({
      postId,
      language,
      content: cached.content,
      cached: true,
    });
  }

  // Call HF — translateToEnglish returns original text on failure
  const translated = await translateToEnglish(post.content);

  // Persist so subsequent requests are free
  await prisma.translation.create({
    data: { postId, language, content: translated },
  });

  return NextResponse.json({
    postId,
    language,
    content: translated,
    cached: false,
  });
}