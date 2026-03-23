// scripts/seed.js
//
// This script runs ONCE when a new environment is set up (called from startup.sh).
// Its job is to populate the database with the real Premier League data needed
// for the app to work: the current season, all 20 teams, and all matches.
//
// After this runs, the app has real data to work with. The caching layer
// (lib/cache.js) handles keeping standings and new scores fresh after this.
//
// Run with:  node scripts/seed.js
//
// It uses `upsert` everywhere (insert if not exists, update if exists) so it's
// safe to run multiple times without creating duplicate records.

//Prompt: How can I seed my database with real Premier League data from football-data.org? I want to fetch the current season, all teams, and all matches, and save them to my database using Prisma. I also want to auto-create discussion threads for each match that open 2 weeks before kick-off and close 2 weeks after.
// Claude 4.6 Sonnet

import { PrismaClient } from "@prisma/client";
import {
  fetchCompetition,
  fetchTeams,
  fetchAllMatches,
} from "../utils/footballapi.js";
import bcrypt from "bcrypt";

import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ---------------------------------------------------------------------------
  // Step 1: Seed the Season
  // ---------------------------------------------------------------------------
  // We call GET /v4/competitions/PL which returns the competition object.
  // Inside it is `currentSeason` — the active 2024/25 season with its id,
  // start/end dates, and current matchday.
  //
  // We save this to the Season table so Match records can reference it with
  // a proper foreign key (seasonId).

  console.log("📅 Fetching current season...");
  const competition = await fetchCompetition();
  const apiSeason = competition.currentSeason;

  const season = await prisma.season.upsert({
    where: { externalId: apiSeason.id },
    update: {
      // Update currentMatchday since it advances every week
      currentMatchday: apiSeason.currentMatchday,
    },
    create: {
      externalId: apiSeason.id,
      startDate: new Date(apiSeason.startDate),
      endDate: new Date(apiSeason.endDate),
      currentMatchday: apiSeason.currentMatchday,
      winner: apiSeason.winner?.name ?? null,
    },
  });

  console.log(`✅ Season seeded: ${apiSeason.startDate} → ${apiSeason.endDate}`);

  // ---------------------------------------------------------------------------
  // Step 2: Seed the Teams
  // ---------------------------------------------------------------------------
  // We call GET /v4/competitions/PL/teams which returns the 20 PL clubs.
  // Each team has a unique `id` from the API which we store as `externalId`.
  //
  // Note: the API field is called `crest` but we store it as `crestUrl` in our
  // schema to be more descriptive.

  console.log("⚽ Fetching teams...");
  const apiTeams = await fetchTeams();

  for (const t of apiTeams) {
    await prisma.team.upsert({
      where: { externalId: t.id },
      update: {
        // These rarely change but good to keep fresh on re-seed
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crestUrl: t.crest,       // API calls it `crest`, we store as `crestUrl`
        venue: t.venue ?? null,
        founded: t.founded ?? null,
        clubColors: t.clubColors ?? null,
        website: t.website ?? null,
      },
      create: {
        externalId: t.id,
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crestUrl: t.crest,
        venue: t.venue ?? null,
        founded: t.founded ?? null,
        clubColors: t.clubColors ?? null,
        website: t.website ?? null,
      },
    });
  }

  console.log(`✅ ${apiTeams.length} teams seeded`);

  // ---------------------------------------------------------------------------
  // Step 3: Seed the Matches
  // ---------------------------------------------------------------------------
  // We call GET /v4/competitions/PL/matches which returns ALL matches for the
  // current season (~380 total: 38 matchdays × 10 games each).
  //
  // For each match we need to:
  //   1. Find the home and away team's internal DB id using their externalId
  //   2. Map the API's nested score object to our flat fields
  //   3. Upsert the match record
  //
  // The API score object looks like:
  //   score.fullTime.home  → homeScore  (null if match not finished)
  //   score.fullTime.away  → awayScore
  //   score.halfTime.home  → halfTimeHome
  //   score.halfTime.away  → halfTimeAway

  console.log("🏟️  Fetching matches...");
  const apiMatches = await fetchAllMatches();

  // Build a lookup map: API team id → our internal DB id
  // This avoids doing a DB query inside the loop for every single match
  const allTeams = await prisma.team.findMany({ select: { id: true, externalId: true } });
  const teamIdMap = {};
  for (const t of allTeams) {
    teamIdMap[t.externalId] = t.id;
  }

  let seeded = 0;
  let skipped = 0;

  for (const m of apiMatches) {
    const homeTeamId = teamIdMap[m.homeTeam.id];
    const awayTeamId = teamIdMap[m.awayTeam.id];

    // Skip if we somehow don't have one of the teams (shouldn't happen)
    if (!homeTeamId || !awayTeamId) {
      console.warn(`⚠️  Skipping match ${m.id} — team not found in DB`);
      skipped++;
      continue;
    }

    await prisma.match.upsert({
      where: { externalId: m.id },
      update: {
        // These fields can change as matches are played
        status: m.status,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        halfTimeHome: m.score.halfTime.home,
        halfTimeAway: m.score.halfTime.away,
        lastUpdated: new Date(m.lastUpdated),
      },
      create: {
        externalId: m.id,
        seasonId: season.id,              // FK to the Season we just seeded
        homeTeamId,                        // resolved from our teamIdMap
        awayTeamId,
        utcDate: new Date(m.utcDate),     // kick-off time
        status: m.status,                 // e.g. "FINISHED", "SCHEDULED"
        matchday: m.matchday,             // 1–38
        stage: m.stage,                   // "REGULAR_SEASON"
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        halfTimeHome: m.score.halfTime.home,
        halfTimeAway: m.score.halfTime.away,
        lastUpdated: new Date(m.lastUpdated),
      },
    });

    seeded++;
  }

  console.log(`✅ ${seeded} matches seeded, ${skipped} skipped`);

  // ---------------------------------------------------------------------------
  // Step 4: Auto-create match threads
  // ---------------------------------------------------------------------------
  // The assignment says every match needs a dedicated discussion thread that
  // opens up to 2 weeks before the match and closes 2 weeks after.
  //
  // We find all matches that don't have a thread yet and create one.
  // We use a system user (id: 1, the first admin) as the thread author.
  // If no users exist yet that's fine — threads can be created without a real
  // author by using a seeded admin account.
  //
  // In production this same logic runs whenever new matches are detected
  // (you can re-run the seed or trigger it from a match route).

  console.log("💬 Auto-creating match threads...");

  // Find all matches that don't already have a thread
  const matchesWithoutThreads = await prisma.match.findMany({
    where: { thread: null },
    include: { homeTeam: true, awayTeam: true },
  });

  // We need at least one user in the DB to be the thread author.
  // The seed creates a system admin if none exists.
  let systemUser = await prisma.user.findFirst({ where: { role: "admin" } });

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: "system@sportsdeck.com",
        username: "SportsDeck",
        role: "admin",
        // No password — this account is just for auto-created content
      },
    });
    console.log("👤 Created system user for auto-generated threads");
  }

  let threadsCreated = 0;

  for (const match of matchesWithoutThreads) {
    const matchDate = new Date(match.utcDate);
    const twoWeeksBefore = new Date(matchDate);
    twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);

    const twoWeeksAfter = new Date(matchDate);
    twoWeeksAfter.setDate(twoWeeksAfter.getDate() + 14);

    const now = new Date();

    // Thread opens at max 2 weeks before the match (or now, whichever is later)
    const openAt = twoWeeksBefore > now ? twoWeeksBefore : now;

    await prisma.thread.create({
      data: {
        title: `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`,
        authorId: systemUser.id,
        matchId: match.id,
        isMatchThread: true,
        isAutoCreated: true,
        openAt,
        closeAt: twoWeeksAfter,
      },
    });

    threadsCreated++;
  }

  console.log(`✅ ${threadsCreated} match threads created`);
  const hashedPw = await bcrypt.hash("password123", 10);
    // in startup.sh or a seed script

  const seedUsers = [
    { email: "user@example.com",  username: "user1",  password: hashedPw, role: "user" },
    { email: "other@example.com", username: "user2",  password: hashedPw, role: "user" },
    { email: "admin@example.com", username: "admin1", password: hashedPw, role: "admin" },
  ];

  for (const u of seedUsers) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: u,
    });
  }
  console.log(`✅ ${seedUsers.length} users seeded (email:) ${seedUsers.map(u => u.email).join(", ")})`);

  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  