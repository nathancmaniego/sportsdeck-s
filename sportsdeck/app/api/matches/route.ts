// app/api/matches/route.js
//
// GET /api/matches
//
// Returns upcoming and recent matches from the DB (already seeded).
// Supports optional query params:
//   ?status=SCHEDULED   — filter by status
//   ?matchday=N         — filter by matchday number
//   ?limit=20           — max results (default 20)
//
// We query the DB directly here — no need to hit the API since all matches
// are already seeded. The DB has all 380 matches with scores and statuses.
// The only time we'd re-fetch is if scores are stale, which is handled by
// the refresh logic in GET /api/matches/[id].

// Prompt: create a Next.js API route at /api/matches that returns a list of matches from the database. Each match should include the home and away team names, match date, status, and score if available. Support optional query parameters to filter by match status (e.g. "SCHEDULED", "FINISHED") and to limit the number of results returned.
// Claude 4.6 Sonnet
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/prisma/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');       // e.g. "SCHEDULED"
    const matchday = searchParams.get('matchday');   // e.g. "28"
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build the where clause dynamically based on query params
    const where: Prisma.MatchWhereInput = {};
    if (status) where.status = status;
    if (matchday) where.matchday = parseInt(matchday, 10);

    // If no filters given, default to showing recent + upcoming matches:
    // last 7 days of finished matches + all upcoming scheduled matches
    if (!status && !matchday) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      where.utcDate = { gte: sevenDaysAgo };
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: { utcDate: 'asc' },
      take: limit,
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
        season: {
          select: { id: true, currentMatchday: true }
        },
        thread: {
          select: { id: true } // just the thread id so frontend can link to it
        }
      },
    });

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('GET /api/matches error:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}