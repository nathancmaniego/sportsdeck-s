// lib/footballApi.js
//
// This file is the ONLY place in the entire app that talks to football-data.org.
// No route handler or seed script should import fetch from here directly —
// they should go through cache.js instead (which calls these functions on a miss).
//
// All functions here just fetch and return the raw API data. They do NOT touch
// the database. That's the seed script's job.
//
// football-data.org free tier limits:
//   - 10 requests per minute
//   - Auth header: X-Auth-Token: <your key>
//   - Base URL: https://api.football-data.org/v4
//   - PL competition code: "PL", id: 2021

// Prompt: How can I implement a utility module to fetch Premier League data from football-data.org? I want functions to get the current season, all teams, all matches, and the current standings. Each function should return the raw API data as JSON. I also want to handle API errors gracefully by throwing an error with the status code if the response is not OK.
// Claude 4.6 Sonnet
const BASE_URL = "https://api.football-data.org/v4";

// Every request needs this header. The API key lives in .env so it's never
// exposed to the frontend or committed to git.
function getHeaders() {
  return {
    "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY,
  };
}

// A small helper so we don't repeat try/catch everywhere.
// It fetches a URL and returns the parsed JSON.
// If the API returns a non-OK status (e.g. 429 rate limit, 403 forbidden),
// it throws an error with the status code so the caller can handle it.
async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`football-data.org error: ${res.status} on ${path}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Competition / Season
// ---------------------------------------------------------------------------

// Fetches the Premier League competition object.
// The important part we care about is `currentSeason`, which looks like:
//   {
//     id: 733,
//     startDate: "2024-08-16",
//     endDate: "2025-05-25",
//     currentMatchday: 28,
//     winner: null
//   }
// We use this to seed the Season table and know which matchday we're on.
export async function fetchCompetition() {
  return apiFetch("/competitions/PL");
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

// Fetches all 20 Premier League teams for the current season.
// Returns an array under the `teams` key. Each team looks like:
//   {
//     id: 57,                          ← this becomes externalId in our DB
//     name: "Arsenal FC",
//     shortName: "Arsenal",
//     tla: "ARS",                      ← three-letter abbreviation
//     crest: "https://crests.football-data.org/57.png",  ← becomes crestUrl
//     address: "...",
//     website: "http://www.arsenal.com",
//     founded: 1886,
//     clubColors: "Red / White",
//     venue: "Emirates Stadium",
//   }
export async function fetchTeams() {
  const data = await apiFetch("/competitions/PL/teams");
  return data.teams; // return just the array, not the wrapper object
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

// Fetches ALL matches for the current PL season.
// Returns an array under the `matches` key. Each match looks like:
//   {
//     id: 419085,                      ← becomes externalId
//     utcDate: "2024-08-16T19:00:00Z", ← kick-off time
//     status: "FINISHED",              ← SCHEDULED | TIMED | IN_PLAY | FINISHED | POSTPONED etc.
//     matchday: 1,                     ← matchday number (1-38)
//     stage: "REGULAR_SEASON",
//     homeTeam: { id: 57, name: "Arsenal FC", tla: "ARS", crest: "..." },
//     awayTeam: { id: 65, name: "Manchester City FC", tla: "MCI", crest: "..." },
//     score: {
//       winner: "HOME_TEAM",
//       fullTime: { home: 2, away: 0 },   ← null if not finished
//       halfTime: { home: 1, away: 0 },   ← null if not finished
//     },
//     lastUpdated: "2024-08-17T08:00:00Z"
//   }
export async function fetchAllMatches() {
  const data = await apiFetch("/competitions/PL/matches");
  return data.matches;
}

// Fetches matches for a specific matchday only.
// Useful in cache.js to refresh just one matchday instead of all 380 matches.
export async function fetchMatchesByMatchday(matchday) {
  const data = await apiFetch(`/competitions/PL/matches?matchday=${matchday}`);
  return data.matches;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

// Fetches the current PL standings table.
// Returns an array under `standings`. We only care about type: "TOTAL".
// Each entry in standings[0].table looks like:
//   {
//     position: 1,
//     team: { id: 65, name: "Manchester City FC", crest: "..." },
//     playedGames: 28,
//     won: 19, draw: 5, lost: 4,
//     points: 62,
//     goalsFor: 58, goalsAgainst: 28, goalDifference: 30
//   }
// We do NOT store standings in the DB — they're cached in ApiCache as raw JSON
// because they change after every match and don't need relational storage.
export async function fetchStandings() {
  const data = await apiFetch("/competitions/PL/standings");
  // The API returns TOTAL, HOME, and AWAY standings.
  // We only need TOTAL for the league table.
  const total = data.standings.find((s) => s.type === "TOTAL");
  return total.table;
}