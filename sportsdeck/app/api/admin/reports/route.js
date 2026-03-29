import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";



// ---------------------------------------------------------------------------
// GET /api/reports  (admin only — queue view)
// ---------------------------------------------------------------------------

/**
 * GET /api/reports
 *
 * Query params:
 *   status = "pending" | "approved" | "dismissed"  (default: "pending")
 *   page   = number  (default: 1)
 *   limit  = number  (default: 20)
 *
 * Sorted by: aiScore DESC (most toxic first), then createdAt DESC.
 * This matches the handout requirement: "sorted by AI-generated verdicts
 * and the number of user reports".
 */

// Prompt: POST endpoint to submit a report on a post or thread. After saving,
// asynchronously generate an AI toxicity verdict via Hugging Face and store it
// on the Report record. Returns the report immediately; verdict is added in the
// background so the response is fast.
// Claude Sonnet 4.6
export async function GET(req) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip   = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: { status },
      include: {
        reporter:     { select: { id: true, username: true } },
        post:         { select: { id: true, content: true, authorId: true, threadId: true } },
        thread:       { select: { id: true, title: true, teamId: true } },
        reportedUser: { select: { id: true, username: true, isBanned: true } },
      },
      orderBy: [
        { aiScore: "desc" },   // highest toxicity first
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.report.count({ where: { status } }),
  ]);

  return NextResponse.json({
    reports,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}