// lib/cache.js

// Prompt: create a cache utility module that route handlers can use to fetch data from football-data.org with caching. It should check the ApiCache table for a valid cache entry before calling the API, and save new data to the DB on a cache miss. Include a function to invalidate the cache early if needed.
// Claude 4.6 Sonnet

//
// This is the ONLY file that route handlers should call when they need
// football-data.org data. It checks the ApiCache table first — if the
// data is fresh it returns it immediately without hitting the API.
// If the cache is stale or missing, it calls the provided fetch function,
// saves the result to the DB, then returns it.
//
// Usage in a route:
//   import { getCached } from '@/lib/cache';
//   import { fetchStandings } from '@/lib/footballApi';
//
//   const standings = await getCached('standings', 60, fetchStandings);
//
// The third argument is always a function that returns the fresh data.
// This way cache.js doesn't need to know anything about the API — it just
// calls whatever function you give it on a cache miss.

import {prisma} from '@/prisma/db'

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------
// key        — unique string identifying this piece of data (e.g. "standings")
// ttlMinutes — how many minutes before this cache entry expires
// fetchFn    — async function that fetches fresh data from football-data.org
//
// Returns the cached or freshly fetched data as a parsed JS object/array.

export async function getCached(key, ttlMinutes, fetchFn) {
  // Step 1: Check if we have a valid (non-expired) cache entry
  const cached = await prisma.apiCache.findUnique({
    where: { key },
  });

  if (cached && new Date() < new Date(cached.expiresAt)) {
    // Cache HIT — return the stored data without touching the API
    return JSON.parse(cached.data);
  }

  // Cache MISS or EXPIRED — fetch fresh data from football-data.org
  const freshData = await fetchFn();

  // Calculate expiry time from now
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // Save (or overwrite) the cache entry in the DB
  await prisma.apiCache.upsert({
    where: { key },
    update: {
      data: JSON.stringify(freshData),
      cachedAt: now,
      expiresAt,
    },
    create: {
      key,
      data: JSON.stringify(freshData),
      cachedAt: now,
      expiresAt,
    },
  });

  return freshData;
}

// ---------------------------------------------------------------------------
// invalidateCache
// ---------------------------------------------------------------------------
// Call this if you ever need to force-expire a cache entry early.
// Not required by the assignment but useful during development/testing.

export async function invalidateCache(key) {
  await prisma.apiCache.deleteMany({ where: { key } });
}