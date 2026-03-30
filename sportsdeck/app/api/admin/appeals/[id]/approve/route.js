import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate, isAdmin } from "@/utils/auth";
// Prompt: Generate a POST endpoint that approves a ban appeal.
// Claude claude-4.6-opus-high-thinking
/**
 * POST /api/admin/appeals/[id]/approve
 * Approves a ban appeal: unbans the user and marks appeal as approved.
 */
export async function POST(request, { params }) {
  const { user, error } = await authenticate(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const appeal = await prisma.appeal.findUnique({
      where: { id: parseInt(id) },
    });

    if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    if (appeal.status !== "pending") {
      return NextResponse.json({ error: "Appeal already processed" }, { status: 400 });
    }

    // Unban the user and approve the appeal atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: appeal.userId },
        data: { isBanned: false },
      }),
      prisma.appeal.update({
        where: { id: parseInt(id) },
        data: { status: "approved" },
      }),
    ]);

    return NextResponse.json({ message: "Appeal approved, user unbanned" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to approve appeal" }, { status: 500 });
  }
}
