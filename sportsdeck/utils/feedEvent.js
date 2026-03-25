import { prisma } from "@/prisma/db";
// Prompt: Implement utility functions to create feed events when users create threads, posts, or when matches update. These functions should create appropriate feed events for followers and users with favorite teams. Use these utilities in the relevant API routes to trigger feed events on content creation and match updates.
// Claude Sonnet 4.6
/**
 * Create feed events for all followers of an actor when content is created.
 * 
 * @param {number} actorId - The user who created the content
 * @param {string} type - Event type (e.g., "new_thread", "new_post", "new_reply")
 * @param {Object} options - Additional options
 * @param {number} options.threadId - Optional thread ID
 * @param {number} options.postId - Optional post ID
 * @param {number} options.matchId - Optional match ID
 * @param {string} options.groupKey - Optional group key for collapsing similar events
 */
export async function createFollowerFeedEvents(actorId, type, options = {}) {
  try {
    // Get all users following this actor
    const followers = await prisma.follow.findMany({
      where: { followingId: actorId },
      select: { followerId: true },
    });

    if (followers.length === 0) return;

    // Create feed events for each follower
    const feedEvents = followers.map((follow) => ({
      userId: follow.followerId,
      actorId,
      type,
      threadId: options.threadId || null,
      postId: options.postId || null,
      matchId: options.matchId || null,
      groupKey: options.groupKey || null,
      isRead: false,
    }));

    await prisma.feedEvent.createMany({
      data: feedEvents,
    });
  } catch (error) {
    console.error("Error creating follower feed events:", error);
  }
}

/**
 * Create feed events for all users who have a specific team as their favorite.
 * Used for match-related events.
 * 
 * @param {number} teamId - The team ID
 * @param {number} actorId - The user triggering the event (usually system/bot)
 * @param {string} type - Event type (e.g., "match_score", "match_status")
 * @param {number} matchId - The match ID
 * @param {string} groupKey - Group key for collapsing match events
 */
export async function createTeamFavoriteFeedEvents(teamId, actorId, type, matchId, groupKey) {
  try {
    // Get all users who have this team as favorite
    const users = await prisma.user.findMany({
      where: { favoriteTeamId: teamId },
      select: { id: true },
    });

    if (users.length === 0) return;

    const feedEvents = users.map((user) => ({
      userId: user.id,
      actorId, // could be a system user or the user updating the match
      type,
      threadId: null,
      postId: null,
      matchId,
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

/**
 * Create feed events for a user's own activity (e.g., when their favorite team plays).
 * 
 * @param {number} userId - The user to create event for
 * @param {number} actorId - The actor (could be system or same as userId)
 * @param {string} type - Event type
 * @param {Object} options - Additional options (threadId, postId, matchId, groupKey)
 */
export async function createSelfActivityFeedEvent(userId, actorId, type, options = {}) {
  try {
    await prisma.feedEvent.create({
      data: {
        userId,
        actorId,
        type,
        threadId: options.threadId || null,
        postId: options.postId || null,
        matchId: options.matchId || null,
        groupKey: options.groupKey || null,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("Error creating self activity feed event:", error);
  }
}

/**
 * Mark feed events as read for specific users or events.
 * 
 * @param {number} userId - User ID
 * @param {number|Array<number>} eventIds - Event ID(s) to mark as read, or null to mark all as read
 */
export async function markFeedEventsAsRead(userId, eventIds = null) {
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
      // Mark all as read
      await prisma.feedEvent.updateMany({
        where: { userId },
        data: { isRead: true },
      });
    } else {
      // Single event ID
      await prisma.feedEvent.update({
        where: { id: eventIds },
        data: { isRead: true },
      });
    }
  } catch (error) {
    console.error("Error marking feed events as read:", error);
  }
}
