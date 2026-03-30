import { prisma } from "@/prisma/db";
import type { FeedEventType } from "@/types";

export async function getSystemActorForFeed(): Promise<{
  id: number;
  username: string;
  avatar: string | null;
} | null> {
  const byHandle = await prisma.user.findFirst({
    where: {
      OR: [{ username: "SportsDeck" }, { email: "system@sportsdeck.com" }],
    },
    select: { id: true, username: true, avatar: true },
  });
  if (byHandle) return byHandle;
  return prisma.user.findFirst({
    where: { role: "admin" },
    select: { id: true, username: true, avatar: true },
    orderBy: { id: "asc" },
  });
}

export interface FeedEventOptions {
  threadId?: number | null;
  postId?: number | null;
  matchId?: number | null;
  groupKey?: string | null;
}

export async function createFollowerFeedEvents(
  actorId: number,
  type: FeedEventType,
  options: FeedEventOptions = {}
): Promise<void> {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: actorId },
      select: { followerId: true },
    });

    if (followers.length === 0) return;

    const feedEvents = followers.map((follow) => ({
      userId: follow.followerId,
      actorId,
      type,
      threadId: options.threadId ?? null,
      postId: options.postId ?? null,
      matchId: options.matchId ?? null,
      groupKey: options.groupKey ?? null,
      isRead: false,
    }));

    await prisma.feedEvent.createMany({
      data: feedEvents,
    });
  } catch (error) {
    console.error("Error creating follower feed events:", error);
  }
}

export async function createTeamFavoriteFeedEvents(
  teamId: number,
  actorId: number,
  type: FeedEventType,
  matchId: number | null,
  groupKey: string
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { favoriteTeamId: teamId },
      select: { id: true },
    });

    if (users.length === 0) return;

    const recipients = users.filter((u) => u.id !== actorId);
    if (recipients.length === 0) return;

    const feedEvents = recipients.map((user) => ({
      userId: user.id,
      actorId,
      type,
      threadId: null,
      postId: null,
      matchId: matchId ?? null,
      groupKey,
      isRead: false,
    }));

    await prisma.feedEvent.createMany({
      data: feedEvents,
    });
  } catch (error) {
    console.error("Error creating team favorite feed events:", error);
  }
}

export async function createSelfActivityFeedEvent(
  userId: number,
  actorId: number,
  type: FeedEventType,
  options: FeedEventOptions = {}
): Promise<void> {
  try {
    await prisma.feedEvent.create({
      data: {
        userId,
        actorId,
        type,
        threadId: options.threadId ?? null,
        postId: options.postId ?? null,
        matchId: options.matchId ?? null,
        groupKey: options.groupKey ?? null,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("Error creating self activity feed event:", error);
  }
}

/** Pass `null` to mark all read for the user, a number for one id, or an array for many. */
export async function markFeedEventsAsRead(
  userId: number,
  eventIds: number[] | number | null = null
): Promise<void> {
  try {
    if (eventIds && Array.isArray(eventIds)) {
      await prisma.feedEvent.updateMany({
        where: {
          userId,
          id: { in: eventIds },
        },
        data: { isRead: true },
      });
    } else if (eventIds === null) {
      await prisma.feedEvent.updateMany({
        where: { userId },
        data: { isRead: true },
      });
    } else {
      await prisma.feedEvent.update({
        where: { id: eventIds },
        data: { isRead: true },
      });
    }
  } catch (error) {
    console.error("Error marking feed events as read:", error);
  }
}
