// app/api/threads/[id]/sentiment/route.js
// Prompt: GET endpoint that analyses sentiment of all posts in a match thread.
// Stores overall, homeTeam, and awayTeam mood in ThreadSentiment. Cached result
// is returned if calculated within the last hour unless ?refresh=true.
// Claude Sonnet 4.6

import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { classifySentiment } from "@/utils/huggingface";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/threads/[id]/sentiment
 *
 * Query params:
 *   refresh=true   — force recalculation even if cached result is fresh
 *
 * Response:
 *   {
 *     threadId      : number
 *     overallMood   : "positive" | "negative" | "mixed" | "neutral"
 *     homeTeamMood  : string | null   (only for match threads)
 *     awayTeamMood  : string | null   (only for match threads)
 *     calculatedAt  : string (ISO)
 *     cached        : boolean
 *   }
 */
export async function GET(req, { params }) {
  const { id } = await params;
  const threadId = parseInt(id);
  if (isNaN(threadId))
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  // -------------------------------------------------------------------------
  // 1. Load thread (must be a match thread for team moods)
  // -------------------------------------------------------------------------
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
    },
  });

  if (!thread || thread.isHidden)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // -------------------------------------------------------------------------
  // 2. Return cached sentiment if fresh
  // -------------------------------------------------------------------------
  if (!forceRefresh) {
    const existing = await prisma.threadSentiment.findUnique({
      where: { threadId },
    });
    if (existing) {
      const age = Date.now() - new Date(existing.calculatedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          threadId,
          overallMood:  existing.overallMood,
          homeTeamMood: existing.homeTeamMood,
          awayTeamMood: existing.awayTeamMood,
          calculatedAt: existing.calculatedAt,
          cached: true,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Fetch all visible posts in the thread
  // -------------------------------------------------------------------------
  const posts = await prisma.post.findMany({
    where: { threadId, isHidden: false },
    include: {
      author: {
        select: { id: true, favoriteTeamId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100, // cap to keep HF payload reasonable
  });

  if (posts.length === 0) {
    // Nothing to analyse — store and return neutral
    const sentiment = await prisma.threadSentiment.upsert({
      where: { threadId },
      update: { overallMood: "neutral", homeTeamMood: null, awayTeamMood: null, calculatedAt: new Date() },
      create: { threadId, overallMood: "neutral", homeTeamMood: null, awayTeamMood: null },
    });
    return NextResponse.json({
      threadId,
      overallMood:  "neutral",
      homeTeamMood: null,
      awayTeamMood: null,
      calculatedAt: sentiment.calculatedAt,
      cached: false,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Classify sentiment
  // -------------------------------------------------------------------------
  const allTexts = posts.map((p) => p.content);
  const overallMood = await classifySentiment(allTexts);

  let homeTeamMood = null;
  let awayTeamMood = null;

  // Team-specific moods only make sense for match threads
  if (thread.isMatchThread && thread.match) {
    const homeTeamId = thread.match.homeTeamId;
    const awayTeamId = thread.match.awayTeamId;

    const homeFanPosts = posts
      .filter((p) => p.author.favoriteTeamId === homeTeamId)
      .map((p) => p.content);

    const awayFanPosts = posts
      .filter((p) => p.author.favoriteTeamId === awayTeamId)
      .map((p) => p.content);

    // Run in parallel — fall back to null if no fan posts for that team
    [homeTeamMood, awayTeamMood] = await Promise.all([
      homeFanPosts.length > 0 ? classifySentiment(homeFanPosts) : Promise.resolve(null),
      awayFanPosts.length > 0 ? classifySentiment(awayFanPosts) : Promise.resolve(null),
    ]);
  }

  // -------------------------------------------------------------------------
  // 5. Persist result
  // -------------------------------------------------------------------------
  const saved = await prisma.threadSentiment.upsert({
    where: { threadId },
    update: {
      overallMood,
      homeTeamMood,
      awayTeamMood,
      calculatedAt: new Date(),
    },
    create: {
      threadId,
      overallMood,
      homeTeamMood,
      awayTeamMood,
    },
  });

  return NextResponse.json({
    threadId,
    overallMood:  saved.overallMood,
    homeTeamMood: saved.homeTeamMood,
    awayTeamMood: saved.awayTeamMood,
    calculatedAt: saved.calculatedAt,
    cached: false,
  });
}