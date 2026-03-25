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
        const { searchParams } = new URL(request.url);
        const parentId = searchParams.get("parentId");

        const thread = await prisma.thread.findUnique({
            where: { id: parseInt(id) }
        });

        if (!thread || thread.isHidden) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        const posts = await prisma.post.findMany({
            where: {
                threadId: parseInt(id),
                isHidden: false,
                ...(parentId && parentId !== "null" 
                    ? { parentId: parseInt(parentId) } 
                    : { parentId: null }),
            },
            include: {
                author: { select: { username: true, avatar: true } },
                replies: {
                    where: { isHidden: false },
                    include: {
                        author: { select: { username: true, avatar: true } }
                    }
                },
                poll: {
                    include: {
                        options: {
                            include: { _count: { select: { votes: true } } }
                        }
                    }
                },
                _count: { select: { replies: true } }
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