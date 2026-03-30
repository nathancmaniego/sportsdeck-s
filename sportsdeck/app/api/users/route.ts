import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";

/**
 * GET /api/users?q=&page=&limit=
 * Search and list public user profiles (no email/password). Banned users excluded.
 * Optional Bearer token: each row includes isFollowedByMe for the requester.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQ = (searchParams.get("q") ?? "").trim().slice(0, 64);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    const authRequester = await authenticate(request);
    const requester = authRequester.ok ? authRequester.user : null;
    const requesterId = requester?.id ?? null;

    const where: Prisma.UserWhereInput = {
      isBanned: false,
      ...(requesterId ? { NOT: { id: requesterId } } : {}),
      ...(rawQ.length > 0
        ? { username: { contains: rawQ, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          avatar: true,
          favoriteTeamId: true,
          favoriteTeam: {
            select: { id: true, shortName: true, crestUrl: true, tla: true },
          },
          _count: {
            select: { followers: true, following: true },
          },
        },
        orderBy: { username: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    let users;
    if (requesterId && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const follows = await prisma.follow.findMany({
        where: { followerId: requesterId, followingId: { in: ids } },
        select: { followingId: true },
      });
      const followed = new Set(follows.map((f) => f.followingId));
      users = rows.map((u) => ({
        ...u,
        isFollowedByMe: followed.has(u.id),
      }));
    } else {
      users = rows.map((u) => ({ ...u, isFollowedByMe: false }));
    }

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}
