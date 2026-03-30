import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
// Prompt: Implement GET /api/users/[id]/activity. Return daily post+reply counts for
// a user over a given date range, using the @@index([authorId, createdAt]) on Post.
// Default to last 90 days. Return an array of { date, count } objects.
// Claude Sonnet 4.6

/**
 * GET /api/users/[id]/activity
 *
 * Public endpoint — visible on any user's profile page.
 *
 * Returns daily post and comment counts for the given user,
 * suitable for rendering an activity/contribution chart.
 *
 * Query params:
 *   days  — number of days to look back (default 90, max 365)
 *
 * Response:
 *   {
 *     userId   : number
 *     days     : number
 *     total    : number          // total posts in period
 *     activity : { date: "YYYY-MM-DD", count: number }[]
 *                // one entry per day that has activity; days with 0 posts are omitted
 *   }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? "90")));

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  // Leverage the @@index([authorId, createdAt]) — Prisma will use it automatically
  // when filtering on both authorId and createdAt together.
  const posts = await prisma.post.findMany({
    where: {
      authorId:  userId,
      createdAt: { gte: since },
      isHidden:  false,
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by YYYY-MM-DD in UTC
  const countByDate: Record<string, number> = {};
  for (const { createdAt } of posts) {
    const date = createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
    countByDate[date] = (countByDate[date] ?? 0) + 1;
  }

  const activity = Object.entries(countByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    userId,
    days,
    total: posts.length,
    activity,
  });
}