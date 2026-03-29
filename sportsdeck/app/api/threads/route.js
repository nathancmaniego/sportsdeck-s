import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { authenticate } from "@/utils/auth"; // adjust path to wherever your auth file is
import { createFollowerFeedEvents, createTeamFavoriteFeedEvents } from "@/utils/feedEvent";

// Prompt: Implement GET /api/threads to return a list of threads with optional filtering by title, teamId, matchId, and tag. Implement POST /api/threads to allow authenticated users to create a new thread with a title, content, optional teamId, optional matchId, and optional tags. Ensure proper error handling and validation for both endpoints.
// Claude Sonnet 4.6
export async function GET(request){
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
        const limit = parseInt(searchParams.get("limit")) || 20;
        const offset = parseInt(searchParams.get("offset")) || 0;

        const now = new Date();
        const statusWhere =
          status === "open"
            ? {
                openAt: { lte: now },
                OR: [{ closeAt: null }, { closeAt: { gt: now } }],
              }
            : status === "closed"
              ? { closeAt: { not: null, lte: now } }
              : {};

        const threads = await prisma.thread.findMany({
            where: {
                isHidden: false,
                ...(title && { title: { contains: title, mode: "insensitive" } }),
                ...(teamId && { teamId: parseInt(teamId) }),
                ...(matchId && { matchId: parseInt(matchId) }),
                ...(tag && { tags: { some: { tag: { name: tag } } } }),
                ...(author && { author: { username: { contains: author, mode: "insensitive" } } }),
                ...statusWhere,
            },
            include: {
                author: { select: { username: true, avatar: true } },
                tags: { include: { tag: true } },
                team: { select: { id: true, name: true, shortName: true, tla: true, crestUrl: true } },
                match: true,
                _count: { select: { posts: true } }
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
        });
        return NextResponse.json(threads);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
    }
}

export async function POST(request) {
    // Protect POST with auth
    const { user, error } = await authenticate(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    try {
        const body = await request.json();
        const { title, content, teamId, matchId, tags } = body;

        const tagConnections = tags?.map((tagName) => ({
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