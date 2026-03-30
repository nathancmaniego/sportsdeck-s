// app/api/users/[id]/route.js
//
// GET /api/users/[id] — public user profile (no auth required)
// PUT /api/users/[id] — edit own profile (auth required)

// Prompt: create a Next.js API route at /api/users/[id] that supports GET and PUT methods. The GET method should return a public user profile by id, including username, avatar, favorite team, and counts of followers/following/threads/posts. The PUT method should allow a logged-in user to update their own profile (username, avatar, favorite team) but not anyone else's. Use JWT for authentication and Prisma for database access.
// Claude 4.6 Sonnet
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/prisma/db';
import { authenticate } from '@/utils/auth';

// ---------------------------------------------------------------------------
// GET /api/users/[id]
// ---------------------------------------------------------------------------
// Returns a public profile — no sensitive fields like password or email.
// Includes follower/following counts, favorite team, and recent threads/posts.
// If the requester is authenticated, also returns isFollowedByMe.

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        role: true,
        favoriteTeamId: true,
        createdAt: true,
        isBanned: true,
        favoriteTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
        _count: {
          select: {
            followers: true,
            following: true,
            threads: { where: { isHidden: false } },
            posts: { where: { isHidden: false } },
          }
        },
        threads: {
          where: { isHidden: false },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            title: true,
            createdAt: true,
            team: { select: { id: true, shortName: true, tla: true } },
          }
        },
        posts: {
          where: { isHidden: false },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: {
            id: true,
            content: true,
            createdAt: true,
            parentId: true,
            thread: { select: { id: true, title: true, teamId: true } },
          }
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Optional auth — attach isFollowedByMe for the frontend follow button
    const authRequester = await authenticate(request);
    const requester = authRequester.ok ? authRequester.user : null;
    let isFollowedByMe = false;
    if (requester && requester.id !== userId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: requester.id, followingId: userId },
        },
      });
      isFollowedByMe = follow !== null;
    }

    return NextResponse.json({ user: { ...user, isFollowedByMe } });
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/users/[id]
// ---------------------------------------------------------------------------
// Allows a logged-in user to update their own profile.
// Only the owner can edit — returns 403 if someone tries to edit another user.
// Updatable fields: username, avatar, favoriteTeamId

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    const authPut = await authenticate(request);
    if (!authPut.ok) return NextResponse.json({ error: authPut.error }, { status: 401 });
    const authUser = authPut.user;

    if (authUser.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      username?: string;
      avatar?: string | null;
      favoriteTeamId?: number | null;
    };
    const { username, avatar, favoriteTeamId } = body;

    // Build update object — only include fields that were actually provided
    const updateData: {
      username?: string;
      avatar?: string | null;
      favoriteTeamId?: number | null;
    } = {};
    if (username !== undefined) updateData.username = username;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (favoriteTeamId !== undefined) updateData.favoriteTeamId = favoriteTeamId;

    // Check username isn't already taken by someone else
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: userId } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    }

    // Check favoriteTeamId is a valid team (or null to clear)
    let teamForCrest = null;
    if (favoriteTeamId !== undefined) {
      if (favoriteTeamId === null) {
        // clearing favourite team — no crest sync
      } else {
        teamForCrest = await prisma.team.findUnique({ where: { id: favoriteTeamId } });
        if (!teamForCrest) {
          return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }
      }
    }

    // Favourite team set/changed without an explicit avatar field → use team crest
    if (
      teamForCrest &&
      favoriteTeamId !== undefined &&
      !Object.prototype.hasOwnProperty.call(body, 'avatar')
    ) {
      updateData.avatar = teamForCrest.crestUrl ?? null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        avatar: true,
        favoriteTeamId: true,
        favoriteTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}