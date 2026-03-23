import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";
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
      thread: { select: { id: true, title: true } },
      post:   { select: { id: true, content: true } },
      match: {
        include: {
          homeTeam: { select: { id: true, shortName: true, crestUrl: true } },
          awayTeam: { select: { id: true, shortName: true, crestUrl: true } },
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
      groupMap.set(key, { event, count: 1 });
    } else {
      const existing = groupMap.get(key);
      existing.count += 1;
      // Keep the most recent event as the representative
      if (new Date(event.createdAt) > new Date(existing.event.createdAt)) {
        existing.event = event;
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Sort groups by latest event time, then paginate
  // ------------------------------------------------------------------
  const groups = [...groupMap.values()].sort(
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
    createdAt: e.createdAt,
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
  // 5. Mark fetched events as read (fire-and-forget)
  // ------------------------------------------------------------------
  const eventIds = pageGroups.flatMap(({ event: e }) => {
    // Find all raw events in this group
    return allEvents
      .filter((ev) => (ev.groupKey ?? `ungrouped_${ev.id}`) === (e.groupKey ?? `ungrouped_${e.id}`))
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