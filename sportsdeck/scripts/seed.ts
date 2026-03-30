// scripts/seed.js
//
// This script runs ONCE when a new environment is set up (called from startup.sh).
// Its job is to populate the database with the real Premier League data needed
// for the app to work: the current season, all 20 teams, and all matches.
//
// After this runs, the app has real data to work with. The caching layer
// (lib/cache.js) handles keeping standings and new scores fresh after this.
//
// Run with:  npm run seed   (or npx tsx scripts/seed.ts)
//
// It uses `upsert` everywhere (insert if not exists, update if exists) so it's
// safe to run multiple times without creating duplicate records.

//Prompt: How can I seed my database with real Premier League data from football-data.org? I want to fetch the current season, all teams, and all matches, and save them to my database using Prisma. I also want to auto-create discussion threads for each match that open 2 weeks before kick-off and close 2 weeks after.
// Claude 4.6 Sonnet

import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import dotenv from "dotenv";
import { PrismaClient, type User } from "@prisma/client";
import { fetchCompetition, fetchTeams, fetchAllMatches } from "@/utils/footballapi";
import bcrypt from "bcrypt";

// Load .env from the sportsdeck folder even if cwd is wrong (e.g. running from repo root).
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local") });

// Supabase direct host often resolves to IPv6 first; many home networks cannot reach it.
dns.setDefaultResultOrder("ipv4first");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("❌ DATABASE_URL is missing. Set it in sportsdeck/.env (see .env.example).");
    process.exit(1);
  }

  try {
    await prisma.$connect();
  } catch (e) {
    console.error("❌ Could not connect to the database.");
    console.error(e);
    console.error(`
Try:
  • Supabase: open the dashboard and resume the project if it is paused.
  • Use a connection string with ?sslmode=require (Supabase usually needs SSL).
  • If host is db.*.supabase.co and it still fails, use Connection pooling → URI
    (pooler host, port 6543) and add &pgbouncer=true for Prisma.
  • Or seed against local Docker: DATABASE_URL postgresql://postgres:password@localhost:8008/sportsdeck
`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Step 1: Seed the Season
  // ---------------------------------------------------------------------------
  console.log("📅 Fetching current season...");
  const competition = await fetchCompetition();
  const apiSeason = competition.currentSeason;

  const season = await prisma.season.upsert({
    where: { externalId: apiSeason.id },
    update: {
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
  console.log("⚽ Fetching teams...");
  const apiTeams = await fetchTeams();

  for (const t of apiTeams) {
    await prisma.team.upsert({
      where: { externalId: t.id },
      update: {
        name: t.name,
        shortName: t.shortName,
        tla: t.tla,
        crestUrl: t.crest,
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
  console.log("🏟️  Fetching matches...");
  const apiMatches = await fetchAllMatches();

  const allTeams = await prisma.team.findMany({ select: { id: true, externalId: true } });
  const teamIdMap: Record<number, number> = {};
  for (const t of allTeams) {
    teamIdMap[t.externalId] = t.id;
  }

  let seeded = 0;
  let skipped = 0;

  for (const m of apiMatches) {
    const homeTeamId = teamIdMap[m.homeTeam.id];
    const awayTeamId = teamIdMap[m.awayTeam.id];

    if (!homeTeamId || !awayTeamId) {
      console.warn(`⚠️  Skipping match ${m.id} — team not found in DB`);
      skipped++;
      continue;
    }

    await prisma.match.upsert({
      where: { externalId: m.id },
      update: {
        status: m.status,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        halfTimeHome: m.score.halfTime.home,
        halfTimeAway: m.score.halfTime.away,
        lastUpdated: new Date(m.lastUpdated),
      },
      create: {
        externalId: m.id,
        seasonId: season.id,
        homeTeamId,
        awayTeamId,
        utcDate: new Date(m.utcDate),
        status: m.status,
        matchday: m.matchday,
        stage: m.stage,
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
  console.log("💬 Auto-creating match threads...");

  const matchesWithoutThreads = await prisma.match.findMany({
    where: { thread: null },
    include: { homeTeam: true, awayTeam: true },
  });

  let systemUser = await prisma.user.findFirst({ where: { role: "admin" } });

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: "system@sportsdeck.com",
        username: "SportsDeck",
        role: "admin",
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
    const openAt = twoWeeksBefore > now ? twoWeeksBefore : now;

    await prisma.thread.create({
      data: {
        title: `${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`,
        authorId: systemUser.id,
        teamId: match.homeTeamId,
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

  // ---------------------------------------------------------------------------
  // Step 5: Seed users
  // ---------------------------------------------------------------------------
  // Fan users use the EXACT shortName values from the DB (verified from Prisma Studio):
  //   Arsenal, Aston Villa, Chelsea, Everton, Fulham, Liverpool, Man City,
  //   Man United, Newcastle, Sunderland, Tottenham, Wolverhampton, Burnley,
  //   Leeds United, Nottingham, Crystal Palace, Brighton Hove, Brentford,
  //   West Ham, Bournemouth
  // ---------------------------------------------------------------------------
  const hashedPw = await bcrypt.hash("password123", 10);

  const dbTeams = await prisma.team.findMany({
    select: { id: true, shortName: true, crestUrl: true },
  });
  const teamByShort: Record<
    string,
    { id: number; shortName: string; crestUrl: string | null }
  > = {};
  for (const t of dbTeams) teamByShort[t.shortName] = t;

  const seedUsers = [
    { email: "user@example.com",  username: "user1",  password: hashedPw, role: "user" },
    { email: "other@example.com", username: "user2",  password: hashedPw, role: "user" },
    { email: "admin@example.com", username: "admin1", password: hashedPw, role: "admin" },
    // Fan users — teamShort must match DB shortName exactly
    { email: "gunnerdan@sd.com",   username: "GunnerDan",   password: hashedPw, role: "user", teamShort: "Arsenal",       tone: "positive" },
    { email: "bluesmark@sd.com",   username: "BluesMark",   password: hashedPw, role: "user", teamShort: "Chelsea",       tone: "mixed"    },
    { email: "kopking@sd.com",     username: "KopKing",     password: hashedPw, role: "user", teamShort: "Liverpool",     tone: "positive" },
    { email: "reddevil99@sd.com",  username: "RedDevil99",  password: hashedPw, role: "user", teamShort: "Man United",    tone: "negative" },
    { email: "cityzen@sd.com",     username: "Cityzen",     password: hashedPw, role: "user", teamShort: "Man City",      tone: "positive" },
    { email: "coysforever@sd.com", username: "COYSForever", password: hashedPw, role: "user", teamShort: "Tottenham",     tone: "mixed"    },
    { email: "hammers_amy@sd.com", username: "HammersAmy",  password: hashedPw, role: "user", teamShort: "West Ham",      tone: "negative" },
    { email: "toonlad@sd.com",     username: "ToonLad",     password: hashedPw, role: "user", teamShort: "Newcastle",     tone: "positive" },
    { email: "villanfaith@sd.com", username: "VillanFaith", password: hashedPw, role: "user", teamShort: "Aston Villa",   tone: "mixed"    },
    { email: "wolves_howl@sd.com", username: "WolvesHowl",  password: hashedPw, role: "user", teamShort: "Wolverhampton", tone: "negative" },
    { email: "brightonfan@sd.com", username: "SeagullDave", password: hashedPw, role: "user", teamShort: "Brighton Hove", tone: "positive" },
    { email: "efc_blue@sd.com",    username: "ToffeeBlue",  password: hashedPw, role: "user", teamShort: "Everton",       tone: "negative" },
  ];

  type SeedUserExtra = User & { tone?: string; teamShort?: string | null };
  const userMap: Record<string, SeedUserExtra> = {};
  const EXCLUDED_USER_IDS = new Set([1, 2, 3, 4]);
  for (const u of seedUsers) {
    const team = u.teamShort ? teamByShort[u.teamShort] : null;
    if (u.teamShort && !team) {
      console.warn(`⚠️  No team found for shortName "${u.teamShort}" — user ${u.username} will have no favourite team`);
    }
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        password: u.password,
        role: u.role,
        favoriteTeamId: team?.id ?? null,
        avatar: team?.crestUrl ?? null,
      },
    });
    userMap[u.username] = { ...user, tone: u.tone ?? "neutral", teamShort: u.teamShort ?? null };
  }
  console.log(`✅ ${seedUsers.length} users seeded`);

  // ---------------------------------------------------------------------------
  // Step 6: Populate match threads with posts (varied sentiment)
  // ---------------------------------------------------------------------------
  console.log("🗣️  Populating match threads with posts...");

  // Key fansByTeam by exact DB shortName
  const fansByTeam: Record<string, SeedUserExtra[]> = {};
  for (const u of Object.values(userMap)) {
    if (!u.teamShort) continue;
    if (!fansByTeam[u.teamShort]) fansByTeam[u.teamShort] = [];
    fansByTeam[u.teamShort].push(u);
  }

  // Neutral users (no team) — user1, user2, admin1
  const neutralUsers = Object.values(userMap).filter((u) => !u.teamShort);

  // All toned users as ultimate fallback for teams with no dedicated fan
  const allTonedUsers = Object.values(userMap).filter((u) => u.tone && u.tone !== "neutral");

  const positiveComments = [
    "What a match! Absolutely buzzing right now, couldn't have asked for a better performance.",
    "Brilliant display from the lads. The passing was crisp and the movement was outstanding.",
    "COME ON! Three points and a clean sheet. You love to see it.",
    "The manager got the tactics spot on today. Every substitution worked perfectly.",
    "That goal was pure class. Top corner, no chance for the keeper. Best goal of the season so far.",
    "We dominated from start to finish. This is the kind of football we've been waiting for.",
    "Fair play to the boys, they gave everything out there. Proud of each and every one of them.",
    "What a time to be a fan. The atmosphere in the stadium must have been incredible.",
    "Our midfield ran the show today. Controlled the tempo beautifully.",
    "Great result, great performance. If we keep this up, we're finishing top four easy.",
    "Love this team! The passion and desire was clear from the first whistle.",
    "Best signing of the season proving his worth again. Worth every penny.",
  ];

  const negativeComments = [
    "That was absolutely pathetic. No effort, no desire, no plan. Embarrassing for the fans who traveled.",
    "Sack the manager. I've seen better organisation in a pub league. Clueless.",
    "How much did we spend in the transfer window just to watch THIS? Robbery.",
    "Our defence is a complete joke. A traffic cone would do a better job at centre-back.",
    "I'm done. Not renewing my season ticket. This is the worst football I've ever watched.",
    "Ref was absolutely shocking. How is that not a red card? Blind and incompetent.",
    "VAR is a disgrace. Clear penalty not given, handball not called. Fix the game why don't you.",
    "Another loss. Another week of misery. Supporting this club is genuinely bad for my health.",
    "Zero creativity, zero urgency. They play like they don't care. Shameful performance.",
    "What is the board even doing? We need investment, we need signings, we need a new plan.",
    "Bottled it AGAIN. Every time we need a big result, we fold like a cheap tent.",
    "We were outplayed by a team with half our budget. No excuses for this.",
  ];

  const toxicComments = [
    "Their fans are absolute clowns LOL, celebrating like they won the league. Tinpot club.",
    "What a dive! These lot are the biggest cheats in the league. Disgraceful.",
    "Imagine spending a billion quid and playing like relegation fodder. Couldn't be my club.",
    "Worst team I've ever seen in the Prem. Genuinely should be playing in the Championship.",
    "Get off the pitch you donkey. My nan could play better and she's 87.",
    "Biggest fraud in football. Scores one goal every six months and celebrates like it's the World Cup final.",
  ];

  const mixedComments = [
    "Decent result but we could've been much better in the second half. Need to keep the intensity up.",
    "A draw was probably fair. Neither team deserved to win really.",
    "Happy with the point away from home, but the attack needs to do more. Too many half chances wasted.",
    "Good defensive work but going forward we offered nothing. Concerning pattern.",
    "The youngsters looked promising but the experienced players let us down. Mixed bag overall.",
    "I'll take it but I won't celebrate it. We need more if we want to push for Europe.",
    "Started strong, faded badly. Fitness levels clearly not where they need to be.",
    "Some encouraging signs but still too many individual errors at the back.",
    "Solid in midfield, shaky at the back. Story of our season really.",
    "We keep drawing games we should be winning. It's going to cost us come May.",
  ];

  const neutralComments = [
    "Interesting tactical battle. Both managers clearly did their homework.",
    "Fair result. Both teams had their moments. Could have gone either way.",
    "Good advert for the Premier League. End to end stuff.",
    "Stats say it was even — possession, shots, corners all roughly split. Fitting draw.",
    "Another day in the Premier League. Roll on next Saturday.",
    "Curious to see how the table looks after the other results come in.",
  ];

  const replyPool = [
    "Completely agree with this.",
    "Couldn't disagree more. What game were you watching?",
    "Spot on. Finally someone talking sense.",
    "You're deluded mate.",
    "This is exactly what I've been saying all week.",
    "Calm down, it's one game. Save the meltdown for when it actually matters.",
    "Best take in this whole thread honestly.",
    "Lol the state of this comment. Embarrassing.",
    "Yeah fair point, I can see both sides.",
    "Nah this ain't it. Watch the replay again.",
    "Subscribe. This is the analysis we need more of.",
    "Respectfully, you don't know ball.",
    "W comment. Absolutely nailed it.",
    "Ratio. Next.",
    "I was at the game and the atmosphere was absolutely electric. You had to be there.",
    "Classic keyboard warrior take. Actually watch the match live for once.",
  ];

  function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  function randomDate(after: Date, before: Date): Date {
    const a = after.getTime();
    const b = before.getTime();
    return new Date(a + Math.random() * (b - a));
  }

  function pickComment(
    fan: SeedUserExtra,
    isWin: boolean,
    isLoss: boolean
  ): string {
    const pools = [];
    if (fan.tone === "positive") {
      pools.push(
        ...positiveComments, ...positiveComments,
        ...mixedComments,
        ...(isLoss ? negativeComments : []),
      );
    } else if (fan.tone === "negative") {
      pools.push(
        ...negativeComments, ...negativeComments,
        ...toxicComments,
        ...mixedComments,
        ...(isWin ? positiveComments : []),
      );
    } else {
      pools.push(
        ...mixedComments, ...mixedComments,
        ...positiveComments,
        ...negativeComments,
        ...(Math.random() < 0.15 ? toxicComments : []),
      );
    }
    return randomItem(pools);
  }

  const matchThreads = await prisma.thread.findMany({
    where: {
      isMatchThread: true,
      isAutoCreated: true,
      match: {
        status: "FINISHED",
        homeScore: { not: null },
        awayScore: { not: null },
      },
    },
    include: {
      match: {
        include: {
          homeTeam: { select: { id: true, shortName: true } },
          awayTeam: { select: { id: true, shortName: true } },
        },
      },
      _count: { select: { posts: true } },
    },
  });

  const emptyThreads = matchThreads.filter((t) => t._count.posts === 0);
  console.log(`📋 Found ${emptyThreads.length} empty finished match threads to populate`);

  let totalPosts = 0;

  for (const thread of emptyThreads) {
    const match = thread.match;
    if (!match) continue;

    const homeShort = match.homeTeam.shortName;
    const awayShort = match.awayTeam.shortName;
    const homeWin = match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore;
    const awayWin = match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore;

    const homeFans = fansByTeam[homeShort] ?? [];
    const awayFans = fansByTeam[awayShort] ?? [];

    const baseTime = new Date(match.utcDate);

    // Always have commenters: specific fans first, then fall back to all toned users
    const specificCommenters = [...homeFans, ...awayFans]
    .filter((u) => !EXCLUDED_USER_IDS.has(u.id));
  
    const allCommenters = specificCommenters.length > 0
      ? specificCommenters
      : allTonedUsers.filter((u) => !EXCLUDED_USER_IDS.has(u.id));

    if (allCommenters.length === 0) continue;

    const numPosts = 6 + Math.floor(Math.random() * 10);
    const topLevelPosts = [];

    for (let i = 0; i < numPosts; i++) {
      const fan = randomItem(allCommenters);
      const isHomeFan = homeFans.some((f) => f.id === fan.id);
      const isAwayFan = awayFans.some((f) => f.id === fan.id);
      const isWin = (isHomeFan && homeWin) || (isAwayFan && awayWin);
      const isLoss = (isHomeFan && awayWin) || (isAwayFan && homeWin);
      const isNeutral = !isHomeFan && !isAwayFan;

      const content = isNeutral
        ? randomItem(neutralComments.concat(mixedComments))
        : pickComment(fan, isWin, isLoss);

      const createdAt = new Date(baseTime.getTime() + i * 60000); // + i minutes
      const post = await prisma.post.create({
        data: { threadId: thread.id, authorId: fan.id, content, createdAt, updatedAt: createdAt },
      });
      topLevelPosts.push(post);
      totalPosts++;
    }

    const numReplies = 3 + Math.floor(Math.random() * 6);

    for (let i = 0; i < numReplies; i++) {
      const parent = randomItem(topLevelPosts);
      const fan = randomItem(allCommenters);
      const content = randomItem(replyPool);
    
      const replyDate = new Date(parent.createdAt.getTime() + (i + 1) * 300000); // stagger replies
    
      await prisma.post.create({
        data: {
          threadId: thread.id,
          authorId: fan.id,
          parentId: parent.id,
          content,
          createdAt: replyDate,
          updatedAt: replyDate,
        },
      });
    
      totalPosts++;
    }

    if (Math.random() < 0.4) {
      const numToxic = 1 + Math.floor(Math.random() * 3);
    
      for (let i = 0; i < numToxic; i++) {
        const fan = randomItem(allCommenters);
        const content = randomItem(toxicComments);
    
        const createdAt = new Date(baseTime.getTime() + (numPosts + i + 1) * 60000);
    
        await prisma.post.create({
          data: {
            threadId: thread.id,
            authorId: fan.id,
            content,
            createdAt,
            updatedAt: createdAt,
          },
        });
    
        totalPosts++;
      }
    }
  }
  const finishedMatches = await prisma.match.count({
    where: { status: "FINISHED" },
  });
  console.log("Total finished threads:", matchThreads.length);
  if (matchThreads.length === 0) {
    console.log("❌ No FINISHED matches found — check your API data");
  }
  console.log("Finished matches:", finishedMatches);
  console.log(`✅ ${totalPosts} posts seeded across ${emptyThreads.length} match threads`);

  // ---------------------------------------------------------------------------
  // Step 7: Seed some general (non-match) threads with discussion
  // ---------------------------------------------------------------------------
  console.log("📝 Creating general discussion threads...");

  const generalThreadData = [
    {
      title: "Who's your Premier League Player of the Season so far?",
      content: "We're past the halfway point — who gets your vote? For me it has to be Salah, the numbers are insane.",
      comments: [
        { text: "Salah easily. Nobody else comes close this year." },
        { text: "Saka deserves a shout too. Arsenal's entire attack runs through him." },
        { text: "None of them. The quality of this league has dropped massively." },
        { text: "Palmer has been unreal for Chelsea. Young player doing things we haven't seen in years." },
        { text: "Tough one. Could make a case for at least five different players." },
        { text: "Overrated league with overrated players. Watch La Liga if you want real football." },
      ],
    },
    {
      title: "VAR needs to go — change my mind",
      content: "Every week it's another controversy. The game was better without it. No one celebrates goals anymore because you're just waiting for the flag.",
      comments: [
        { text: "Couldn't agree more. VAR has ruined the matchday experience completely." },
        { text: "It's not even accurate! They're drawing lines with crayons. What's the point?" },
        { text: "I think the concept is fine, the implementation is awful. Needs a major overhaul." },
        { text: "Disagree. It corrects obvious mistakes. People just hate it when it goes against their team." },
        { text: "Anyone who defends VAR has absolutely zero understanding of what makes football great. Brain dead take." },
        { text: "Semi-automated offside can't come soon enough. Current system is broken beyond repair." },
        { text: "The problem isn't VAR itself, it's the referees using it. Garbage in, garbage out." },
      ],
    },
    {
      title: "Bold predictions for the rest of the season",
      content: "Drop your hot takes for how the season ends. Relegation, title race, golden boot — anything goes.",
      comments: [
        { text: "Arsenal finally win the league. This is their year, I can feel it." },
        { text: "Man United finish 10th. Genuinely think they might be in a relegation scrap." },
        { text: "Liverpool win the league by 5+ points. City fall apart without key players." },
        { text: "Newcastle sneak into Champions League spots. Eddie Howe masterclass incoming." },
        { text: "Your club is getting relegated lmao. Save this comment." },
        { text: "Spurs finish 5th again. The hope and the heartbreak, as is tradition." },
        { text: "Golden Boot goes to Haaland. He's going to score 30+ once he hits form." },
        { text: "Wolves go down. I love the club but we've been dreadful this season." },
      ],
    },
    {
      title: "Best stadium atmosphere in the PL?",
      content: "Visited a few grounds this season. Anfield on a European night is unmatched but St James' Park was incredible too. What are your experiences?",
      comments: [
        { text: "Anfield no debate. YNWA before kickoff gives me chills every single time." },
        { text: "St James' Park is underrated. 52k screaming Geordies, nothing like it." },
        { text: "Emirates gets a bad rep but it's improved a lot this season. Can be electric for big games." },
        { text: "Most PL atmospheres are dead compared to the Bundesliga or Turkish league. Let's be real." },
        { text: "Selhurst Park on a good day is genuinely terrifying for visiting teams." },
      ],
    },
  ];

  const allFans = Object.values(userMap)
  .filter((u) => u.teamShort && !EXCLUDED_USER_IDS.has(u.id));

  for (const td of generalThreadData) {
    const author = randomItem(allFans);
    const now = new Date();
    const threadDate = randomDate(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() - 1 * 60 * 60 * 1000)
    );

    const existingThread = await prisma.thread.findFirst({
      where: { title: td.title },
    });
    if (existingThread) continue;

    const newThread = await prisma.thread.create({
      data: {
        title: td.title,
        authorId: author.id,
        openAt: threadDate,
        createdAt: threadDate,
        updatedAt: threadDate,
        posts: {
          create: {
            content: td.content,
            authorId: author.id,
            createdAt: threadDate,
            updatedAt: threadDate,
          },
        },
      },
    });

    for (const c of td.comments) {
      const commenter = randomItem(allFans.filter((f) => f.id !== author.id));
      const commentDate = randomDate(
        threadDate,
        new Date(Math.min(threadDate.getTime() + 3 * 24 * 60 * 60 * 1000, now.getTime()))
      );

      await prisma.post.create({
        data: {
          threadId: newThread.id,
          authorId: commenter.id,
          content: c.text,
          createdAt: commentDate,
          updatedAt: commentDate,
        },
      });
      totalPosts++;
    }
  }

  console.log("✅ General discussion threads seeded");
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