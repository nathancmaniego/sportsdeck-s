import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";
import { getSystemActorForFeed } from "@/utils/feedEvent";
// Prompt: Implement GET /api/users/[id]/feed. Only the authenticated user can view
// their own feed. Return FeedEvents for: people they follow, their own activity, and
// their favorite team. Group events by groupKey, collapsing multiple events into one
// with a count. Support pagination and mark events as read.
// Claude Sonnet 4.6

/**
 * GET /api/users/[id]/feed
 *
 * Returns the personalized feed for the authenticated user.
 * Only the owner can view their own feed.
 *
 * Grouping: events sharing the same groupKey are collapsed into one entry.
 * The most recent event in the group is shown, with a `count` field indicating
 * how many events are in the group.
 *
 * Query params:
 *   page       (default 1)
 *   limit      (default 20, max 50)  — applies to groups, not raw events
 *   unreadOnly (default false)       — only return unread events
 *
 * Response:
 *   { feed: FeedGroup[], pagination, unreadCount }
 *
 * FeedGroup:
 *   {
 *     groupKey    : string | null
 *     count       : number          // events collapsed into this group
 *     type        : string          // type of the latest event
 *     isRead      : boolean         // false if any event in group is unread
 *     createdAt   : string          // latest event time
 *     actor       : { id, username, avatar }
 *     thread      : { id, title } | null
 *     post        : { id, content } | null
 *     match       : { id, homeTeam, awayTeam, homeScore, awayScore } | null
 *   }
 */
export async function GET(req, { params }) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  if (user.id !== userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit      = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  // ------------------------------------------------------------------
  // 1. Fetch raw feed events for this user
  // ------------------------------------------------------------------
  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const allEvents = await prisma.feedEvent.findMany({
    where,
    include: {
      actor:  { select: { id: true, username: true, avatar: true } },
      thread: { select: { id: true, title: true, teamId: true } },
      post:   { select: { id: true, content: true } },
      match: {
        include: {
          homeTeam: { select: { id: true, shortName: true, crestUrl: true } },
          awayTeam: { select: { id: true, shortName: true, crestUrl: true } },
          thread: { select: { id: true, title: true, teamId: true, isHidden: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500, // fetch enough to group, then paginate groups
  });

  const unreadCount = await prisma.feedEvent.count({ where: { userId, isRead: false } });

  // ------------------------------------------------------------------
  // 2. Group by groupKey (null-keyed events each form their own group)
  // ------------------------------------------------------------------
  const groupMap = new Map(); // groupKey → latest event + count

  for (const event of allEvents) {
    const key = event.groupKey ?? `ungrouped_${event.id}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, { event, count: 1, isSynthetic: false });
    } else {
      const existing = groupMap.get(key);
      existing.count += 1;
      // Keep the most recent event as the representative
      if (new Date(event.createdAt) > new Date(existing.event.createdAt)) {
        existing.event = event;
      }
    }
  }

  let groups = [...groupMap.values()];

  // ------------------------------------------------------------------
  // 2b. Threads the user has posted/commented in — always fresh from DB
  // ------------------------------------------------------------------
  {
    // Find the most recent post per thread made by this user
    const userPostRows = await prisma.post.findMany({
      where: { authorId: userId, isHidden: false },
      include: {
        thread: {
          select: {
            id: true,
            title: true,
            teamId: true,
            isHidden: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Deduplicate: one synthetic event per thread (most recent post)
    const seenThreads = new Set();
    const meUser = { id: userId, username: user.username, avatar: user.avatar ?? null };

    for (const post of userPostRows) {
      if (!post.thread || post.thread.isHidden) continue;
      if (seenThreads.has(post.thread.id)) continue;
      seenThreads.add(post.thread.id);

      const synKey = `syn_mypost_thread_${post.thread.id}`;
      // Don't double-add if there's already a real FeedEvent for this thread
      if (groupMap.has(synKey)) continue;

      groups.push({
        event: {
          groupKey: synKey,
          type: "my_post",
          isRead: true,
          createdAt: post.createdAt,
          actor: meUser,
          thread: {
            id: post.thread.id,
            title: post.thread.title,
            teamId: post.thread.teamId,
          },
          post: { id: post.id, content: post.content },
          match: null,
        },
        count: 1,
        isSynthetic: true,
      });
    }
  }

  // ------------------------------------------------------------------
  // 2c. Favourite team — upcoming & last 5 finished matches (always fresh)
  // ------------------------------------------------------------------
  {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteTeamId: true },
    });
    const systemActor = await getSystemActorForFeed();

    if (me?.favoriteTeamId && systemActor) {
      const teamId = me.favoriteTeamId;
      const now = new Date();

      const teamSelect = { id: true, shortName: true, crestUrl: true };
      const matchInclude = {
        homeTeam: { select: teamSelect },
        awayTeam: { select: teamSelect },
        thread: { select: { id: true, title: true, teamId: true, isHidden: true } },
      };

      // Next 5 upcoming / live matches
      const liveOrUpcoming = await prisma.match.findMany({
        where: {
          status: { in: ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"] },
          utcDate: { gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        include: matchInclude,
        orderBy: { utcDate: "asc" },
        take: 5,
      });

      // Last 5 finished matches — no date cutoff so sparse leagues still show results
      const recentDone = await prisma.match.findMany({
        where: {
          status: "FINISHED",
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        include: matchInclude,
        orderBy: { utcDate: "desc" },
        take: 5,
      });

      const formatMatchRow = (m, type, createdAt) => ({
        groupKey: type === "new_match" ? `syn_match_up_${m.id}` : `syn_match_done_${m.id}`,
        count: 1,
        type,
        isRead: true,
        createdAt,
        actor: systemActor,
        thread:
          m.thread && !m.thread.isHidden
            ? { id: m.thread.id, title: m.thread.title, teamId: m.thread.teamId }
            : null,
        post: null,
        match: {
          id: m.id,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeScore: m.homeScore ?? null,
          awayScore: m.awayScore ?? null,
          status: m.status,
        },
        _synthetic: true,
      });

      for (const m of liveOrUpcoming) {
        groups.push({ event: formatMatchRow(m, "new_match", m.utcDate), count: 1, isSynthetic: true });
      }
      for (const m of recentDone) {
        groups.push({ event: formatMatchRow(m, "match_score", m.updatedAt ?? m.utcDate), count: 1, isSynthetic: true });
      }
    }
  }

  // ------------------------------------------------------------------
  // 2d. Recent threads & posts from people you follow (live DB, not only FeedEvent rows)
  // ------------------------------------------------------------------
  function collectCoveredContentIds(gs) {
    const postIds = new Set();
    const threadIdsAsThreadCard = new Set();
    for (const g of gs) {
      const e = g.event;
      if (e.post?.id != null) postIds.add(e.post.id);
      if (e.type === "new_thread" && e.thread?.id != null) {
        threadIdsAsThreadCard.add(e.thread.id);
      }
    }
    return { postIds, threadIdsAsThreadCard };
  }

  let { postIds: coveredPostIds, threadIdsAsThreadCard: coveredThreadIds } =
    collectCoveredContentIds(groups);

  const followRows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = [...new Set(followRows.map((f) => f.followingId))].filter(
    (id) => id !== userId
  );

  if (followingIds.length > 0) {
    const followThreads = await prisma.thread.findMany({
      where: { authorId: { in: followingIds }, isHidden: false },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    for (const t of followThreads) {
      if (coveredThreadIds.has(t.id)) continue;
      coveredThreadIds.add(t.id);
      groups.push({
        event: {
          groupKey: `syn_follow_thread_${t.id}`,
          type: "new_thread",
          isRead: true,
          createdAt: t.createdAt,
          actor: {
            id: t.author.id,
            username: t.author.username,
            avatar: t.author.avatar ?? null,
          },
          thread: {
            id: t.id,
            title: t.title,
            teamId: t.teamId,
          },
          post: null,
          match: null,
        },
        count: 1,
        isSynthetic: true,
      });
    }

    const followPosts = await prisma.post.findMany({
      where: {
        authorId: { in: followingIds },
        isHidden: false,
        thread: { isHidden: false },
      },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        thread: { select: { id: true, title: true, teamId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 32,
    });

    for (const p of followPosts) {
      if (coveredPostIds.has(p.id)) continue;
      if (p.parentId == null && coveredThreadIds.has(p.threadId)) continue;
      coveredPostIds.add(p.id);
      groups.push({
        event: {
          groupKey: `syn_follow_post_${p.id}`,
          type: "new_post",
          isRead: true,
          createdAt: p.createdAt,
          actor: {
            id: p.author.id,
            username: p.author.username,
            avatar: p.author.avatar ?? null,
          },
          thread: p.thread
            ? {
                id: p.thread.id,
                title: p.thread.title,
                teamId: p.thread.teamId,
              }
            : null,
          post: { id: p.id, content: p.content },
          match: null,
        },
        count: 1,
        isSynthetic: true,
      });
    }
  }

  const followSynCount = groups.filter((g) =>
    String(g.event.groupKey || "").startsWith("syn_follow_")
  ).length;

  // ------------------------------------------------------------------
  // 2e. Forum highlights when follows are quiet (keeps the feed from feeling empty)
  // ------------------------------------------------------------------
  const meForFill = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteTeamId: true },
  });
  const favoriteTeamId = meForFill?.favoriteTeamId ?? null;
  const needForumFill = followingIds.length === 0 || followSynCount < 6;

  if (needForumFill) {
    let added = 0;
    const maxForum = 14;

    const pushForumThread = (t) => {
      if (added >= maxForum || coveredThreadIds.has(t.id)) return;
      coveredThreadIds.add(t.id);
      added++;
      groups.push({
        event: {
          groupKey: `syn_forum_thread_${t.id}`,
          type: "new_thread",
          isRead: true,
          createdAt: t.createdAt,
          actor: {
            id: t.author.id,
            username: t.author.username,
            avatar: t.author.avatar ?? null,
          },
          thread: {
            id: t.id,
            title: t.title,
            teamId: t.teamId,
          },
          post: null,
          match: null,
        },
        count: 1,
        isSynthetic: true,
      });
    };

    const pushForumPost = (p) => {
      if (added >= maxForum || coveredPostIds.has(p.id)) return;
      if (p.parentId == null && coveredThreadIds.has(p.threadId)) return;
      coveredPostIds.add(p.id);
      added++;
      groups.push({
        event: {
          groupKey: `syn_forum_post_${p.id}`,
          type: "new_post",
          isRead: true,
          createdAt: p.createdAt,
          actor: {
            id: p.author.id,
            username: p.author.username,
            avatar: p.author.avatar ?? null,
          },
          thread: p.thread
            ? {
                id: p.thread.id,
                title: p.thread.title,
                teamId: p.thread.teamId,
              }
            : null,
          post: { id: p.id, content: p.content },
          match: null,
        },
        count: 1,
        isSynthetic: true,
      });
    };

    if (favoriteTeamId != null) {
      const teamThreads = await prisma.thread.findMany({
        where: {
          isHidden: false,
          authorId: { not: userId },
          teamId: favoriteTeamId,
        },
        include: {
          author: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      for (const t of teamThreads) pushForumThread(t);

      const teamPosts = await prisma.post.findMany({
        where: {
          isHidden: false,
          authorId: { not: userId },
          thread: { isHidden: false, teamId: favoriteTeamId },
        },
        include: {
          author: { select: { id: true, username: true, avatar: true } },
          thread: { select: { id: true, title: true, teamId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 16,
      });
      for (const p of teamPosts) pushForumPost(p);
    }

    const globalTake = favoriteTeamId != null && added < 5 ? 22 : 18;
    const globalPosts = await prisma.post.findMany({
      where: {
        isHidden: false,
        authorId: { not: userId },
        thread: { isHidden: false },
      },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        thread: { select: { id: true, title: true, teamId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: globalTake,
    });
    for (const p of globalPosts) pushForumPost(p);
  }

  // ------------------------------------------------------------------
  // 3. Sort groups by latest event time, then paginate
  // ------------------------------------------------------------------
  groups.sort(
    (a, b) => new Date(b.event.createdAt) - new Date(a.event.createdAt)
  );

  const total      = groups.length;
  const skip       = (page - 1) * limit;
  const pageGroups = groups.slice(skip, skip + limit);

  // ------------------------------------------------------------------
  // 4. Format response
  // ------------------------------------------------------------------
  const feed = pageGroups.map(({ event: e, count }) => ({
    groupKey:  e.groupKey,
    count,
    type:      e.type,
    isRead:    e.isRead,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    actor:     e.actor,
    thread:    e.thread  ?? null,
    post:      e.post
      ? { id: e.post.id, content: e.post.content?.slice(0, 200) }
      : null,
    match: e.match
      ? {
          id:        e.match.id,
          homeTeam:  e.match.homeTeam,
          awayTeam:  e.match.awayTeam,
          homeScore: e.match.homeScore,
          awayScore: e.match.awayScore,
          status:    e.match.status,
        }
      : null,
  }));

  // ------------------------------------------------------------------
  // 5. Mark fetched events as read (fire-and-forget) — real rows only
  // ------------------------------------------------------------------
  const eventIds = pageGroups
    .filter((g) => !g.isSynthetic)
    .flatMap(({ event: e }) => {
      return allEvents
        .filter(
          (ev) =>
            (ev.groupKey ?? `ungrouped_${ev.id}`) ===
            (e.groupKey ?? `ungrouped_${e.id}`)
        )
        .map((ev) => ev.id);
    });

  if (eventIds.length > 0) {
    prisma.feedEvent
      .updateMany({ where: { id: { in: eventIds }, isRead: false }, data: { isRead: true } })
      .catch((err) => console.error("[Feed] markRead failed:", err.message));
  }

  return NextResponse.json({
    feed,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    unreadCount,
  });
}