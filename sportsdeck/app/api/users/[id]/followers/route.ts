import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";

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
// Prompt: Implement the GET /api/users/[id]/followers endpoint to list all users following a given user. Include pagination support with query parameters for page and limit. Each follower in the response should include their id, username, avatar URL, favorite team ID, and the timestamp of when they followed the target user.
// Claude Sonnet 4.6

// ---------------------------------------------------------------------------
// GET /api/users/[id]/followers
// List all users following [id], sorted by follow time (newest first).
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
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, username: true, avatar: true, favoriteTeamId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.follow.count({ where: { followingId: userId } }),
  ]);

  return NextResponse.json({
    followers: follows.map((f) => formatUser(f.follower, f.createdAt)),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}