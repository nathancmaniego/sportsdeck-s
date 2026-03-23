import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";

// Prompt: Implement the POST /api/users/[id]/follow endpoint to allow the authenticated user to follow another user specified by [id]. Ensure that banned users cannot follow others, and that users cannot follow themselves. The endpoint should return appropriate error messages and status codes for invalid requests, such as trying to follow a non-existent user or already following the target user. Also implement the DELETE /api/users/[id]/follow endpoint to unfollow a user, with similar validation and error handling.
// Claude Sonnet 4.6
// ---------------------------------------------------------------------------
// POST /api/users/[id]/follow
// Follow a user. Banned users cannot follow.
// ---------------------------------------------------------------------------
export async function POST(req, { params }) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (user.isBanned)
    return NextResponse.json({ error: "Banned users cannot follow others" }, { status: 403 });

  const { id } = await params;
  const followingId = parseInt(id);
  if (isNaN(followingId))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  if (user.id === followingId)
    return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });

  // Verify target user exists
  const target = await prisma.user.findUnique({ where: { id: followingId } });
  if (!target)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Upsert so duplicate follows are idempotent
  await prisma.follow.upsert({
    where: {
      followerId_followingId: { followerId: user.id, followingId },
    },
    update: {}, // already following — no-op
    create: { followerId: user.id, followingId },
  });

  return NextResponse.json({ message: "User followed" }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/users/[id]/follow
// Unfollow a user.
// ---------------------------------------------------------------------------
export async function DELETE(req, { params }) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  const followingId = parseInt(id);
  if (isNaN(followingId))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId: user.id, followingId },
    },
  });
  if (!existing)
    return NextResponse.json({ error: "You are not following this user" }, { status: 404 });

  await prisma.follow.delete({
    where: {
      followerId_followingId: { followerId: user.id, followingId },
    },
  });

  return NextResponse.json({ message: "User unfollowed" });
}