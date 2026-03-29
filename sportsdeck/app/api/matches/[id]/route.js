// app/api/matches/[id]/route.js
//
// GET /api/matches/[id]
//
// Returns a single match by its internal DB id.
// Also checks if the match score might be stale and refreshes from the API
// if needed. Specifically: if the match status is not FINISHED and the
// utcDate has passed, we re-fetch that matchday from the API to get
// the latest score, then update the DB.
//
// This is the only place we call the API for individual match data —
// everything else comes straight from the seeded DB.

// Prompt: create a Next.js API route at /api/matches/[id] that returns detailed information about a single match from the database, including home and away team names, match date, status, and score. If the match is scheduled but the match date has passed, refresh the match data from football-data.org before returning it.
// Claude 4.6 Sonnet

import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/db';
import { getCached } from '@/utils/cache';
import { fetchMatchesByMatchday } from '@/utils/footballapi';
import { createTeamFavoriteFeedEvents, getSystemActorForFeed } from '@/utils/feedEvent';


export async function GET(request, { params }) {
  try {
    const {id} = await params;
    const matchId = parseInt(id);

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: true,
        thread: {
          select: { id: true, title: true, isHidden: true }
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Stale score check:
    // If the match should be finished (utcDate is in the past) but our DB
    // still shows it as SCHEDULED/TIMED, refresh that matchday from the API.
    const now = new Date();
    const matchPassed = new Date(match.utcDate) < now;
    const notFinished = !['FINISHED', 'CANCELLED', 'POSTPONED'].includes(match.status);

    if (matchPassed && notFinished && match.matchday) {
      // Use cache with a short TTL so we don't hammer the API
      // but still get reasonably fresh data
      const cacheKey = `matches_matchday_${match.matchday}`;
      const freshMatches = await getCached(
        cacheKey,
        30, // 30 minute TTL for active matchday data
        () => fetchMatchesByMatchday(match.matchday)
      );

      // Find our specific match in the fresh data and update the DB
      const freshMatch = freshMatches.find((m) => m.id === match.externalId);
      if (freshMatch) {
        const statusChanged = freshMatch.status !== match.status;
        const scoreChanged = 
          freshMatch.score.fullTime.home !== match.homeScore ||
          freshMatch.score.fullTime.away !== match.awayScore;

        await prisma.match.update({
          where: { id: matchId },
          data: {
            status: freshMatch.status,
            homeScore: freshMatch.score.fullTime.home,
            awayScore: freshMatch.score.fullTime.away,
            halfTimeHome: freshMatch.score.halfTime.home,
            halfTimeAway: freshMatch.score.halfTime.away,
            lastUpdated: new Date(freshMatch.lastUpdated),
          },
        });

        // Create feed events for users with these teams as favorites
        if (statusChanged || scoreChanged) {
          const eventType = statusChanged ? "match_status" : "match_score";
          const groupKey = `match_${matchId}`;
          const systemActor = await getSystemActorForFeed();
          if (systemActor) {
            await createTeamFavoriteFeedEvents(
              match.homeTeamId,
              systemActor.id,
              eventType,
              matchId,
              groupKey
            );
            await createTeamFavoriteFeedEvents(
              match.awayTeamId,
              systemActor.id,
              eventType,
              matchId,
              groupKey
            );
          }
        }

        // Re-fetch from DB to return updated data
        const updatedMatch = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            homeTeam: true,
            awayTeam: true,
            season: true,
            thread: { select: { id: true, title: true, isHidden: true } },
          },
        });
        return NextResponse.json({ match: updatedMatch });
      }
    }

    return NextResponse.json({ match });
  } catch (error) {
    console.error('GET /api/matches/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 });
  }
}