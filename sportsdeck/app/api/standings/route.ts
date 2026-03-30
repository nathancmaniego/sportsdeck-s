// app/api/standings/route.js
//
// GET /api/standings
//
// Returns the current Premier League table.
// This is the one match-related endpoint that always hits the API (via cache)
// because standings change after every match and aren't stored relationally.
//
// Cached for 60 minutes in ApiCache under the key "standings".
// If the cache is fresh, the API is never called.

// Prompt: create a Next.js API route at /api/standings that returns the current Premier League table. This endpoint should always fetch fresh data from football-data.org (with caching) since standings change frequently. Use the getCached utility to cache the standings for 60 minutes to avoid hitting the API on every request.
// Claude 4.6 Sonnet

import { NextRequest, NextResponse } from "next/server";
import { getCached } from '@/utils/cache';
import { fetchStandings } from '@/utils/footballapi';

export async function GET() {
  try {
    // getCached will return DB-cached data if under 60 min old,
    // otherwise calls fetchStandings() and caches the result
    const standings = await getCached(
      'standings',
      60, // 60 minute TTL
      fetchStandings
    );

    return NextResponse.json({ standings });
  } catch (error) {
    console.error('GET /api/standings error:', error);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}