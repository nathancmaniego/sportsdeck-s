// app/api/digest/route.js
// Prompt: GET endpoint that returns today's AI-generated daily digest.
// If no digest exists for today (UTC date), generate one using Hugging Face,
// summarising recent matches, standings, and top forum discussions.
// Claude Sonnet 4.6

import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { generateText } from "@/utils/huggingface";

/** Return midnight UTC for today so we get one digest per calendar day. */
function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/digest
 *
 * Returns:
 *   {
 *     id        : number
 *     content   : string   // AI-generated digest text
 *     date      : string   // ISO date
 *     fresh     : boolean  // true if just generated now
 *   }
 */
export async function GET() {
  const today = todayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // -------------------------------------------------------------------------
  // 1. Return existing digest if already generated today
  // -------------------------------------------------------------------------
  const existing = await prisma.dailyDigest.findFirst({
    where: { date: { gte: today, lt: tomorrow } },
    orderBy: { date: "desc" },
  });

  if (existing) {
    return NextResponse.json({
      id:      existing.id,
      content: existing.content,
      date:    existing.date,
      fresh:   false,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Gather context for the prompt
  // -------------------------------------------------------------------------

  // Recent finished matches (last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentMatches = await prisma.match.findMany({
    where: {
      status:  "FINISHED",
      utcDate: { gte: threeDaysAgo },
    },
    include: {
      homeTeam: { select: { shortName: true } },
      awayTeam: { select: { shortName: true } },
    },
    orderBy: { utcDate: "desc" },
    take: 5,
  });

  // Upcoming matches (next 2 days)
  const twoDaysAhead = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const upcomingMatches = await prisma.match.findMany({
    where: {
      status:  { in: ["SCHEDULED", "TIMED"] },
      utcDate: { lte: twoDaysAhead },
    },
    include: {
      homeTeam: { select: { shortName: true } },
      awayTeam: { select: { shortName: true } },
    },
    orderBy: { utcDate: "asc" },
    take: 3,
  });

  // Most active threads today (by post count)
  const topThreads = await prisma.thread.findMany({
    where: {
      isHidden: false,
      posts: {
        some: { createdAt: { gte: today }, isHidden: false },
      },
    },
    include: {
      _count: { select: { posts: true } },
      team:   { select: { shortName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  // -------------------------------------------------------------------------
  // 3. Build prompt
  // -------------------------------------------------------------------------
  const matchSummary = recentMatches.length > 0
    ? recentMatches
        .map((m) => `${m.homeTeam.shortName} ${m.homeScore ?? "?"} – ${m.awayScore ?? "?"} ${m.awayTeam.shortName}`)
        .join(", ")
    : "No recent matches.";

  const upcomingSummary = upcomingMatches.length > 0
    ? upcomingMatches
        .map((m) => `${m.homeTeam.shortName} vs ${m.awayTeam.shortName}`)
        .join(", ")
    : "No upcoming matches in the next 2 days.";

  const threadSummary = topThreads.length > 0
    ? topThreads
        .map((t) => `"${t.title}" (${t._count.posts} posts${t.team ? ", " + t.team.shortName : ""})`)
        .join("; ")
    : "No active discussions today.";

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const prompt = `<s>[INST] You are a witty sports journalist writing the daily digest for SportsDeck, a Premier League fan hub. Write a short, engaging daily digest (3–4 paragraphs, plain text, no markdown) for ${todayStr}.

Recent results: ${matchSummary}
Upcoming fixtures: ${upcomingSummary}
Hottest forum threads: ${threadSummary}

Keep it punchy, fan-friendly, and under 300 words. Do not invent scores or facts beyond what is provided. [/INST]`;

  // -------------------------------------------------------------------------
  // 4. Generate via HF
  // -------------------------------------------------------------------------
  let content = await generateText(prompt, 350);

  if (!content || content.trim().length < 20) {
    // Graceful fallback — simple structured digest without AI prose
    content = [
      `📅 Daily Digest — ${todayStr}`,
      "",
      recentMatches.length > 0
        ? `⚽ Recent results: ${matchSummary}`
        : "No matches played in the last 3 days.",
      "",
      upcomingMatches.length > 0
        ? `📆 Coming up: ${upcomingSummary}`
        : "No fixtures scheduled in the next 48 hours.",
      "",
      topThreads.length > 0
        ? `💬 Trending on the forums: ${threadSummary}`
        : "Be the first to start a discussion today!",
    ].join("\n");
  }

  // -------------------------------------------------------------------------
  // 5. Persist and return
  // -------------------------------------------------------------------------
  const digest = await prisma.dailyDigest.create({
    data: { content, date: today },
  });

  return NextResponse.json({
    id:      digest.id,
    content: digest.content,
    date:    digest.date,
    fresh:   true,
  });
}