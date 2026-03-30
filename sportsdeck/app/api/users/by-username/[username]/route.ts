// GET /api/users/by-username/[username]
// Returns the same public profile shape as /api/users/[id] but looks up by username.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/prisma/db';
import { authenticate } from '@/utils/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatar: true,
        createdAt: true,
        isBanned: true,
        favoriteTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crestUrl: true }
        },
        _count: {
          select: {
            followers: true,
            following: true,
            threads: true,
            posts: true,
          }
        },
        threads: {
          where: { isHidden: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
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
          take: 10,
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

    const authRequester = await authenticate(request);
    const requester = authRequester.ok ? authRequester.user : null;
    let isFollowedByMe = false;
    if (requester && requester.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: requester.id, followingId: user.id },
        },
      });
      isFollowedByMe = follow !== null;
    }

    return NextResponse.json({ user: { ...user, isFollowedByMe } });
  } catch (error) {
    console.error('GET /api/users/by-username error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
