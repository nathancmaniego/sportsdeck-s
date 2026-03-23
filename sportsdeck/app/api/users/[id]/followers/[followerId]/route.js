import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";

// Prompt: Implement unfollowing functionality for the DELETE /api/users/[id]/followers/[followerId] endpoint. This should allow the authenticated user to remove a follower from their followers list. Ensure that only the account owner can remove their followers, and that appropriate error messages and status codes are returned for invalid requests, such as trying to remove a non-existent follower or attempting to remove a follower from another user's account.
// Claude Sonnet 4.6

// ---------------------------------------------------------------------------
// DELETE /api/users/[id]/followers/[followerId]
//
// Removes [followerId] from the followers of [id].
// Only the account owner ([id]) can remove their own followers.
// ---------------------------------------------------------------------------
export async function DELETE(req, { params }) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id, followerId } = await params;
  const userId         = parseInt(id);
  const followerUserId = parseInt(followerId);

  if (isNaN(userId) || isNaN(followerUserId))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  // Only the account owner can remove their followers
  if (user.id !== userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId: followerUserId, followingId: userId },
    },
  });
  if (!existing)
    return NextResponse.json({ error: "This user is not your follower" }, { status: 404 });

  await prisma.follow.delete({
    where: {
      followerId_followingId: { followerId: followerUserId, followingId: userId },
    },
  });

  return NextResponse.json({ message: "Follower removed" });
}