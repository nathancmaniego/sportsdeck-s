// app/api/digest/route.js
// GET /api/digest — today's digest (UTC). Context: previous PL matchday results +
// upcoming matchday fixtures, plus forum highlights. Body via Hugging Face chat API.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { generateDigestText } from "@/utils/huggingface";

interface SeasonDates {
  startDate: Date;
  endDate: Date;
}

interface DigestMatchRow {
  utcDate: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  homeTeam: { shortName: string };
  awayTeam: { shortName: string };
}

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Season model has no seasonLabel (that lives on Match); derive e.g. "2024/25" from dates. */
function formatSeasonTag(season: SeasonDates | null | undefined) {
  if (!season?.startDate || !season?.endDate) return "";
  const y0 = new Date(season.startDate).getUTCFullYear();
  const y1 = new Date(season.endDate).getUTCFullYear();
  if (y0 === y1) return ` (${y0})`;
  return ` (${y0}/${String(y1).slice(-2)})`;
}

/**
 * Resolve Premier League season and matchday numbers.
 * Uses Season.currentMatchday (football-data.org: next round to play). Previous = that minus one.
 */
async function resolveSeasonAndMatchdays() {
  const season = await prisma.season.findFirst({
    orderBy: { id: "desc" },
    select: {
      id: true,
      currentMatchday: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!season) {
    return { season: null, previousMatchday: null, upcomingMatchday: null };
  }

  let upcomingMd = season.currentMatchday ?? null;
  let previousMd = null;

  if (upcomingMd != null && upcomingMd > 1) {
    previousMd = upcomingMd - 1;
  }

  // Stale/missing currentMatchday: infer from fixtures
  if (upcomingMd == null) {
    const nextLive = await prisma.match.findFirst({
      where: {
        seasonId: season.id,
        status: { in: ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"] },
        matchday: { not: null },
        utcDate: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
      orderBy: { utcDate: "asc" },
      select: { matchday: true },
    });
    upcomingMd = nextLive?.matchday ?? null;
    if (upcomingMd != null && upcomingMd > 1) {
      previousMd = upcomingMd - 1;
    }
  }

  if (previousMd == null && upcomingMd == null) {
    const maxDone = await prisma.match.aggregate({
      where: {
        seasonId: season.id,
        status: "FINISHED",
        matchday: { not: null },
      },
      _max: { matchday: true },
    });
    if (maxDone._max.matchday != null) {
      previousMd = maxDone._max.matchday;
      upcomingMd = previousMd + 1;
    }
  }

  return {
    season,
    previousMatchday: previousMd,
    upcomingMatchday: upcomingMd,
  };
}

function formatFinished(m: DigestMatchRow) {
  const ht =
    m.halfTimeHome != null || m.halfTimeAway != null
      ? ` (HT ${m.halfTimeHome ?? "?"}–${m.halfTimeAway ?? "?"})`
      : "";
  return `${m.homeTeam.shortName} ${m.homeScore ?? "?"}–${m.awayScore ?? "?"} ${m.awayTeam.shortName}${ht}`;
}

function formatFixture(m: DigestMatchRow) {
  const when = new Date(m.utcDate).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const st =
    m.status === "IN_PLAY" || m.status === "PAUSED"
      ? " [live]"
      : m.status === "TIMED" || m.status === "SCHEDULED"
        ? ""
        : ` [${m.status}]`;
  return `${when}: ${m.homeTeam.shortName} vs ${m.awayTeam.shortName}${st}`;
}

/**
 * GET /api/digest
 * Dev only: ?refresh=1 deletes today’s row so you can regenerate after fixing logic.
 */
export async function GET(request: NextRequest) {
  const today = todayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  try {
    const url = new URL(request.url);
    const forceRefresh =
      process.env.NODE_ENV === "development" &&
      (url.searchParams.get("refresh") === "1" ||
        url.searchParams.get("refresh") === "true");
    if (forceRefresh) {
      await prisma.dailyDigest.deleteMany({
        where: { date: { gte: today, lt: tomorrow } },
      });
    }
  } catch {
    // ignore bad URL in edge runtimes
  }

  const existing = await prisma.dailyDigest.findFirst({
    where: { date: { gte: today, lt: tomorrow } },
    orderBy: { date: "desc" },
  });

  if (existing) {
    return NextResponse.json({
      id: existing.id,
      content: existing.content,
      date: existing.date,
      fresh: false,
    });
  }

  const { season, previousMatchday, upcomingMatchday } =
    await resolveSeasonAndMatchdays();

  const teamSelect = { select: { shortName: true } };

  let previousMatches: DigestMatchRow[] = [];
  if (season && previousMatchday != null) {
    previousMatches = await prisma.match.findMany({
      where: {
        seasonId: season.id,
        matchday: previousMatchday,
        status: "FINISHED",
      },
      include: {
        homeTeam: teamSelect,
        awayTeam: teamSelect,
      },
      orderBy: { utcDate: "asc" },
    });
  }

  let upcomingMatches: DigestMatchRow[] = [];
  if (season && upcomingMatchday != null) {
    upcomingMatches = await prisma.match.findMany({
      where: {
        seasonId: season.id,
        matchday: upcomingMatchday,
        status: { in: ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"] },
      },
      include: {
        homeTeam: teamSelect,
        awayTeam: teamSelect,
      },
      orderBy: { utcDate: "asc" },
    });
  }

  const topThreads = await prisma.thread.findMany({
    where: {
      isHidden: false,
      posts: {
        some: { createdAt: { gte: today }, isHidden: false },
      },
    },
    include: {
      _count: { select: { posts: true } },
      team: { select: { shortName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const seasonTag = formatSeasonTag(season);
  const prevBlock =
    previousMatches.length > 0
      ? previousMatches.map(formatFinished).join("\n")
      : previousMatchday != null
        ? `(No finished results recorded for matchday ${previousMatchday} yet.)`
        : "(No prior matchday data yet.)";

  const nextBlock =
    upcomingMatches.length > 0
      ? upcomingMatches.map(formatFixture).join("\n")
      : upcomingMatchday != null
        ? `(No scheduled fixtures found for matchday ${upcomingMatchday} in the database.)`
        : "(No upcoming matchday data yet.)";

  const threadSummary =
    topThreads.length > 0
      ? topThreads
          .map(
            (t) =>
              `"${t.title}" (${t._count.posts} posts${t.team ? `, ${t.team.shortName}` : ""})`
          )
          .join("; ")
      : "No threads with new posts today.";

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Only call the model when BOTH blocks have real rows; otherwise the model invents fixtures/results.
  const hasFullMatchData =
    previousMatches.length > 0 && upcomingMatches.length > 0;

  const allowedTeams = new Set();
  for (const m of previousMatches) {
    allowedTeams.add(m.homeTeam.shortName);
    allowedTeams.add(m.awayTeam.shortName);
  }
  for (const m of upcomingMatches) {
    allowedTeams.add(m.homeTeam.shortName);
    allowedTeams.add(m.awayTeam.shortName);
  }
  const allowedList = [...allowedTeams].sort().join(", ");

  let content = "";

  if (hasFullMatchData) {
    const prompt = `Write the SportsDeck Premier League daily digest for ${todayStr}${seasonTag}.

Plain text only, no markdown, 3–4 short paragraphs, max ~260 words.

Paragraph 1: One line setting the scene (date/season only—no fake fixtures).

Paragraph 2: Summarise matchday ${previousMatchday} using ONLY the RESULTS lines below (you may rephrase slightly but keep every score and team name exactly correct).

Paragraph 3: Summarise matchday ${upcomingMatchday} using ONLY the FIXTURES lines below (keep kick-off times and pairings exact).

Paragraph 4: One sentence on forums using ONLY FORUM HIGHLIGHTS.

ALLOWED TEAM NAMES (only names you may use in paragraphs 2–3): ${allowedList}

--- MATCHDAY ${previousMatchday ?? "N/A"} RESULTS ---
${prevBlock}

--- MATCHDAY ${upcomingMatchday ?? "N/A"} FIXTURES ---
${nextBlock}

--- FORUM HIGHLIGHTS (today) ---
${threadSummary}`;

    content = await generateDigestText(prompt, 520);
  }

  if (!content || content.trim().length < 40) {
    content = [
      `📅 Premier League digest — ${todayStr}${seasonTag}`,
      "",
      previousMatchday != null
        ? `⚽ Matchday ${previousMatchday}: ${
            previousMatches.length > 0
              ? previousMatches.map(formatFinished).join(" · ")
              : "No results in database for this round."
          }`
        : "⚽ No previous matchday context available.",
      "",
      upcomingMatchday != null
        ? `📆 Matchday ${upcomingMatchday}: ${
            upcomingMatches.length > 0
              ? upcomingMatches.map(formatFixture).join(" · ")
              : "No fixtures in SportsDeck’s database for this round—so nothing to list for the weekend or next kick-offs until data is synced (e.g. international break or schedule gap)."
          }`
        : "📆 No upcoming matchday context available.",
      "",
      topThreads.length > 0
        ? `💬 Forums: ${threadSummary}`
        : "💬 No hot threads with new posts today.",
      "",
      process.env.HUGGINGFACE_API_KEY
        ? ""
        : "(AI summary unavailable — set HUGGINGFACE_API_KEY for generated prose.)",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const digest = await prisma.dailyDigest.create({
    data: { content, date: today },
  });

  return NextResponse.json({
    id: digest.id,
    content: digest.content,
    date: digest.date,
    fresh: true,
  });
}
