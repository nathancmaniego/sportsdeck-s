import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/utils/auth"; // adjust path to wherever your auth file is
import { createFollowerFeedEvents, createTeamFavoriteFeedEvents } from "@/utils/feedEvent";

// Prompt: Implement GET /api/threads to return a list of threads with optional filtering by title, teamId, matchId, and tag. Implement POST /api/threads to allow authenticated users to create a new thread with a title, content, optional teamId, optional matchId, and optional tags. Ensure proper error handling and validation for both endpoints.
// Claude Sonnet 4.6
export async function GET(request: NextRequest) {
    // GET stays public, no auth needed
    try {
        const { searchParams } = new URL(request.url);
        const title = searchParams.get("title");
        const teamId = searchParams.get("teamId");
        const matchId = searchParams.get("matchId");
        const tag = searchParams.get("tag");
        const author = searchParams.get("author");
        const theme = searchParams.get("theme");
        const status = searchParams.get("status"); // "open" | "closed"
        /** match_finished | match_upcoming | community */
        const threadCategory = searchParams.get("threadCategory");
        const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
        const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

        const now = new Date();
        // "Open" for listing: normal window OR match threads for not-yet-finished
        // fixtures (seed may set openAt in the future until 2 weeks before kick-off).
        const statusWhere =
          status === "open"
            ? {
                OR: [
                  {
                    openAt: { lte: now },
                    OR: [{ closeAt: null }, { closeAt: { gt: now } }],
                  },
                  {
                    isMatchThread: true,
                    closeAt: { gt: now },
                    match: { is: { status: { not: "FINISHED" } } },
                  },
                ],
              }
            : status === "closed"
              ? {
                  // Truly closed: window ended. Not "closed" if discussion never started yet.
                  closeAt: { not: null, lte: now },
                  openAt: { lte: now },
                }
              : {};

        const categoryWhere =
          threadCategory === "community"
            ? { isMatchThread: false }
            : threadCategory === "match_finished"
              ? {
                  isMatchThread: true,
                  match: { is: { status: "FINISHED" } },
                }
              : threadCategory === "match_upcoming"
                ? {
                    isMatchThread: true,
                    match: {
                      is: {
                        status: {
                          in: [
                            "SCHEDULED",
                            "TIMED",
                            "IN_PLAY",
                            "PAUSED",
                            "POSTPONED",
                            "SUSPENDED",
                          ],
                        },
                      },
                    },
                  }
                : {};

        const orderBy: Prisma.ThreadOrderByWithRelationInput =
          threadCategory === "match_finished"
            ? { match: { utcDate: "desc" } }
            : { createdAt: "desc" };

        const threadWhere: Prisma.ThreadWhereInput = {
            isHidden: false,
            ...(title && { title: { contains: title, mode: Prisma.QueryMode.insensitive } }),
            ...(teamId && { teamId: parseInt(teamId, 10) }),
            ...(matchId && { matchId: parseInt(matchId, 10) }),
            ...(tag && { tags: { some: { tag: { name: tag } } } }),
            ...(author && {
              author: { username: { contains: author, mode: Prisma.QueryMode.insensitive } },
            }),
            ...statusWhere,
            ...categoryWhere,
        };

        const threadInclude = {
            author: { select: { username: true, avatar: true } },
            tags: { include: { tag: true } },
            team: { select: { id: true, name: true, shortName: true, tla: true, crestUrl: true } },
            match: {
              select: {
                id: true,
                status: true,
                utcDate: true,
                homeScore: true,
                awayScore: true,
                matchday: true,
                homeTeam: { select: { shortName: true, tla: true } },
                awayTeam: { select: { shortName: true, tla: true } },
              },
            },
            _count: { select: { posts: true } },
        };

        // Upcoming/live: live first, then soonest kick-off (DB order alone can't express that).
        if (threadCategory === "match_upcoming") {
          const rows = await prisma.thread.findMany({
            where: threadWhere,
            select: {
              id: true,
              match: { select: { utcDate: true, status: true } },
            },
          });
          const isLive = (s: string) => s === "IN_PLAY" || s === "PAUSED";
          rows.sort((a, b) => {
            const al = a.match && isLive(a.match.status) ? 0 : 1;
            const bl = b.match && isLive(b.match.status) ? 0 : 1;
            if (al !== bl) return al - bl;
            const ta = a.match?.utcDate
              ? new Date(a.match.utcDate).getTime()
              : Number.MAX_SAFE_INTEGER;
            const tb = b.match?.utcDate
              ? new Date(b.match.utcDate).getTime()
              : Number.MAX_SAFE_INTEGER;
            return ta - tb;
          });
          const pageIds = rows.slice(offset, offset + limit).map((r) => r.id);
          if (pageIds.length === 0) return NextResponse.json([]);
          const threads = await prisma.thread.findMany({
            where: { id: { in: pageIds } },
            include: threadInclude,
          });
          const byId = new Map(threads.map((t) => [t.id, t]));
          const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean);
          return NextResponse.json(ordered);
        }

        const threads = await prisma.thread.findMany({
            where: threadWhere,
            include: threadInclude,
            orderBy,
            take: limit,
            skip: offset,
        });
        return NextResponse.json(threads);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    // Protect POST with auth
    const auth = await authenticate(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const { user } = auth;

    try {
        const body = await request.json();
        const { title, content, teamId, matchId, tags } = body;

        const tagConnections = tags?.map((tagName: string) => ({
            tag: {
                connectOrCreate: {
                    where: { name: tagName },
                    create: { name: tagName },
                },
            },
        })) || [];

        const newThread = await prisma.thread.create({
            data: {
                title,
                authorId: user.id, // use the authenticated user's id instead of body
                teamId: teamId ? parseInt(teamId) : null,
                matchId: matchId ? parseInt(matchId) : null,
                isMatchThread: !!matchId,
                openAt: new Date(),
                tags: { create: tagConnections },
                posts: {
                    create: {
                        content,
                        authorId: user.id,
                    },
                },
            },
        });

        // Create feed events for followers
        await createFollowerFeedEvents(user.id, "new_thread", {
            threadId: newThread.id,
            groupKey: `thread_${newThread.id}`,
        });

        // If thread is for a team, also create events for users with that team as favorite
        if (newThread.teamId) {
            await createTeamFavoriteFeedEvents(newThread.teamId, user.id, "new_thread", null, `thread_${newThread.id}`);
        }

        return NextResponse.json(newThread, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not create thread" }, { status: 500 });
    }
}