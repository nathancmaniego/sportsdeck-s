import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate, isAdmin } from "@/utils/auth";

/**
 * POST /api/admin/appeals/[id]/reject
 * Body: { message?: string }
 * Rejects a ban appeal and stores an optional admin message shown to the user.
 */
export async function POST(request, { params }) {
  const { user, error } = await authenticate(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const adminMessage = typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : null;

    const appeal = await prisma.appeal.findUnique({
      where: { id: parseInt(id) },
    });

    if (!appeal) return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    if (appeal.status !== "pending") {
      return NextResponse.json({ error: "Appeal already processed" }, { status: 400 });
    }

    await prisma.appeal.update({
      where: { id: parseInt(id) },
      data: { status: "rejected", adminMessage },
    });

    return NextResponse.json({ message: "Appeal rejected" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to reject appeal" }, { status: 500 });
  }
}
