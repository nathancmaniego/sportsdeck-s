// app/api/matchdays/route.js
//
// GET /api/matchdays
//
// Returns a summary of all matchdays in the current season.
// For each matchday we return the matchday number, how many matches
// are played vs total, and the date range.
//
// We query the DB directly — no API call needed since all matches are seeded.
// This is what the frontend uses to render the matchday browser/selector.

// Prompt: create a Next.js API route at /api/matchdays that returns a summary of all matchdays in the current season. For each matchday, include the matchday number, how many matches are played vs total, and the date range. Also include the current matchday number from the Season table. This endpoint should query the database directly since all match data is already seeded.
// Claude 4.6 Sonnet
import { NextResponse } from 'next/server';
import {prisma} from '@/prisma/db';

export async function GET() {
  try {
    // Get all distinct matchdays with aggregate info
    // groupBy matchday, count matches, count finished matches
    const matchdays = await prisma.match.groupBy({
      by: ['matchday'],
      where: {
        matchday: { not: null },
      },
      _count: { id: true },
      orderBy: { matchday: 'asc' },
    });

    // For each matchday, also get the date range and finished count
    const result = await Promise.all(
      matchdays.map(async (md) => {
        const matches = await prisma.match.findMany({
          where: { matchday: md.matchday },
          select: { utcDate: true, status: true },
          orderBy: { utcDate: 'asc' },
        });

        const finishedCount = matches.filter((m) => m.status === 'FINISHED').length;
        const dates = matches.map((m) => new Date(m.utcDate));

        return {
          matchday: md.matchday,
          totalMatches: md._count.id,
          finishedMatches: finishedCount,
          startDate: dates[0],               // earliest match in this matchday
          endDate: dates[dates.length - 1],  // latest match in this matchday
          isComplete: finishedCount === md._count.id,
        };
      })
    );

    // Also return the current matchday from the Season table
    const season = await prisma.season.findFirst({
      orderBy: { startDate: 'desc' },
      select: { currentMatchday: true },
    });

    return NextResponse.json({
      matchdays: result,
      currentMatchday: season?.currentMatchday ?? null,
    });
  } catch (error) {
    console.error('GET /api/matchdays error:', error);
    return NextResponse.json({ error: 'Failed to fetch matchdays' }, { status: 500 });
  }
}