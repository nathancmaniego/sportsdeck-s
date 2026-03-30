import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";

// prompt: Implement the GET /api/users/[id]/following endpoint to list all users that a given user is following. Include pagination support with query parameters for page and limit. Each followed user in the response should include their id, username, avatar URL, favorite team ID, and the timestamp of when they were followed.
// Claude Sonnet 4.6
// Shared helper to format a user stub
function formatUser(
  user: {
    id: number;
    username: string;
    avatar: string | null;
    favoriteTeamId: number | null;
  },
  createdAt: Date
) {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    favoriteTeamId: user.favoriteTeamId,
    followedAt: createdAt,
  };
}

// ---------------------------------------------------------------------------
// GET /api/users/[id]/following
// List all users that [id] is following, sorted by follow time (newest first).
//
// Query params:
//   page  (default 1)
//   limit (default 20, max 50)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const [follows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, username: true, avatar: true, favoriteTeamId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);

  return NextResponse.json({
    following: follows.map((f) => formatUser(f.following, f.createdAt)),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}