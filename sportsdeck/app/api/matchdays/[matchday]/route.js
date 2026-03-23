// app/api/matchdays/[matchday]/route.js
//
// GET /api/matchdays/[matchday]
//
// Returns all 10 matches for a specific matchday.
// Queries the DB directly for most cases.
//
// If the matchday is the current one (or recent), we also check the cache
// for any score updates — same stale-score logic as the single match route
// but applied to the whole matchday at once.

// Prompt: create a Next.js API route at /api/matchdays/[matchday] that returns all matches for a specific matchday from the database. If the matchday is the current one or recent, check if any matches have stale scores (scheduled but past their date) and refresh those matches from football-data.org before returning the data. Use caching to avoid hitting the API too often while still ensuring reasonably fresh data.
// Claude 4.6 Sonnet

import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/db';
import { getCached } from '@/utils/cache';
import { fetchMatchesByMatchday } from '@/utils/footballapi';


export async function GET(request, { params }) {
  try {
    const { matchday } = await params;
    const matchdayNum = parseInt(matchday);
    if (isNaN(matchdayNum) || matchdayNum < 1 || matchdayNum > 38) {
      return NextResponse.json({ error: 'Invalid matchday' }, { status: 400 });
    }

    // Check if this matchday has any unfinished matches whose date has passed
    // If so, refresh from the API before returning
    const now = new Date();
    const staleMatches = await prisma.match.findMany({
      where: {
        matchday: matchdayNum,
        utcDate: { lt: now },
        status: { notIn: ['FINISHED', 'CANCELLED', 'POSTPONED'] },
      },
    });

    if (staleMatches.length > 0) {
      // Fetch fresh data for this matchday (cached for 30 min)
      const freshMatches = await getCached(
        `matches_matchday_${matchdayNum}`,
        30,
        () => fetchMatchesByMatchday(matchdayNum)
      );

      // Bulk update all stale matches in this matchday
      await Promise.all(
        freshMatches.map((fm) =>
          prisma.match.updateMany({
            where: { externalId: fm.id },
            data: {
              status: fm.status,
              homeScore: fm.score.fullTime.home,
              awayScore: fm.score.fullTime.away,
              halfTimeHome: fm.score.halfTime.home,
              halfTimeAway: fm.score.halfTime.away,
              lastUpdated: new Date(fm.lastUpdated),
            },
          })
        )
      );
    }

    // Now fetch from DB (with updated scores if we just refreshed)
    const matches = await prisma.match.findMany({
      where: { matchday: matchdayNum },
      orderBy: { utcDate: 'asc' },
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
        thread: {
          select: { id: true }
        },
      },
    });

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Matchday not found' }, { status: 404 });
    }

    return NextResponse.json({ matchday: matchdayNum, matches });
  } catch (error) {
    console.error('GET /api/matchdays/[matchday] error:', error);
    return NextResponse.json({ error: 'Failed to fetch matchday' }, { status: 500 });
  }
}