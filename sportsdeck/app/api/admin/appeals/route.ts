import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate, isAdmin } from "@/utils/auth";
// Prompt: Generate a GET endpoint that returns the appeals for the admin.
// Claude claude-4.6-opus-high-thinking
/**
 * GET /api/admin/appeals
 * Query params:
 *   status = "pending" | "approved" | "rejected"  (default: "pending")
 *   page   = number  (default: 1)
 *   limit  = number  (default: 20)
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const { user } = auth;
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip   = (page - 1) * limit;

  const [appeals, total] = await Promise.all([
    prisma.appeal.findMany({
      where: { status },
      include: {
        user: { select: { id: true, username: true, isBanned: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.appeal.count({ where: { status } }),
  ]);

  return NextResponse.json({
    appeals,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
