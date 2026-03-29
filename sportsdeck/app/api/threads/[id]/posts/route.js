import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { authenticate } from "@/utils/auth";
import { scoreToxicity } from "@/utils/huggingface";
import { createFollowerFeedEvents, createTeamFavoriteFeedEvents } from "@/utils/feedEvent";
// Used Artificial intelligence for this using Claude AI
// Prompt: can u help me implement threads/[id]/posts/route.js.

// GET all posts for a specific thread

export async function GET(request, { params }) {
    try {
        const { id } = await params;

        const thread = await prisma.thread.findUnique({
            where: { id: parseInt(id) }
        });

        if (!thread || thread.isHidden) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        // Return a flat list of all posts in the thread (including replies).
        // The client will build a nested tree using parentId for infinite-depth threads.
        const posts = await prisma.post.findMany({
            where: {
                threadId: parseInt(id),
                isHidden: false,
            },
            include: {
                author: { select: { username: true, avatar: true } },
                poll: { select: { id: true } },
            },
            orderBy: { createdAt: "asc" }
        });

        return NextResponse.json(posts);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    // Must be logged in to post
    const { user, error } = await authenticate(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const { content, parentId } = body;

        if (!content) {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const thread = await prisma.thread.findUnique({
            where: { id: parseInt(id) }
        });

        if (!thread || thread.isHidden) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        if (thread.openAt && new Date() < thread.openAt) {
            return NextResponse.json({ error: "Thread is not open yet" }, { status: 403 });
        }

        if (thread.closeAt && new Date() > thread.closeAt) {
            return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        }

        if (parentId) {
            const parentPost = await prisma.post.findUnique({
                where: { id: parseInt(parentId) }
            });

            if (!parentPost || parentPost.threadId !== parseInt(id)) {
                return NextResponse.json({ error: "Parent post not found in this thread" }, { status: 404 });
            }
        }

        const newPost = await prisma.post.create({
            data: {
                threadId: parseInt(id),
                authorId: user.id,
                content,
                parentId: parentId ? parseInt(parentId) : null,
            },
            include: {
                author: { select: { username: true, avatar: true } }
            }
        });

        // Determine event type
        const isReply = !!parentId;
        const eventType = isReply ? "new_reply" : "new_post";

        // Create feed events for followers
        await createFollowerFeedEvents(user.id, eventType, {
            threadId: thread.id,
            postId: newPost.id,
            groupKey: `thread_${thread.id}`,
        });

        // If thread is for a team, also create events for users with that team as favorite
        if (thread.teamId) {
            await createTeamFavoriteFeedEvents(thread.teamId, user.id, eventType, null, `thread_${thread.id}`);
        }

        // Notify users about activity on their content (replies to your post / posts in your thread)
        if (parentId) {
            const parent = await prisma.post.findUnique({
                where: { id: parseInt(parentId, 10) },
                select: { authorId: true },
            });
            if (parent && parent.authorId !== user.id) {
                await prisma.feedEvent.create({
                    data: {
                        userId: parent.authorId,
                        actorId: user.id,
                        type: "new_reply",
                        threadId: thread.id,
                        postId: newPost.id,
                        groupKey: `reply_to_post_${parentId}`,
                        isRead: false,
                    },
                });
            }
        } else if (thread.authorId !== user.id) {
            await prisma.feedEvent.create({
                data: {
                    userId: thread.authorId,
                    actorId: user.id,
                    type: "new_post",
                    threadId: thread.id,
                    postId: newPost.id,
                    groupKey: `thread_owner_${thread.id}`,
                    isRead: false,
                },
            });
        }

        // Auto-flag potentially inappropriate content (fire-and-forget)
        autoFlagPost(newPost.id, content);

        return NextResponse.json(newPost, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// Background helper — scores post for toxicity and flags if needed.
// If toxic, sets isFlagged on the Post AND creates a Report row so it
// appears in the admin queue alongside user-submitted reports.
// Runs after response is sent so it never slows down the POST.
// ---------------------------------------------------------------------------
async function autoFlagPost(postId, content) {
    try {
        const { score, label, verdict } = await scoreToxicity(content);

        if (label === "toxic") {
            // Mark the post as flagged
            await prisma.post.update({
                where: { id: postId },
                data: {
                    isFlagged:  true,
                    flagReason: verdict,
                },
            });

            // Create a system Report row so it shows up in GET /api/reports
            const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { authorId: true },
            });

            await prisma.report.create({
                data: {
                    reporterId: post.authorId,
                    reason:     "Automatically flagged by AI toxicity filter",
                    status:     "pending",
                    postId,
                    aiVerdict:  verdict,
                    aiScore:    score,
                },
            });
        }
    } catch (err) {
        // Non-fatal — post stays unflagged if HF is down
        console.error("[AutoFlag] failed for post", postId, err.message);
    }
}