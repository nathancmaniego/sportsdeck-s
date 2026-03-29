import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { authenticate, isAdmin } from "@/utils/auth";
//Used Claude AI to help implement this js file
//Prompt: okay ti works now lets work on creating the app/api/posts/[id]/route.js and the app/api/posts/[id]/history/route.js based on this new info 

// PUT: Edit a post (saves old version to history)
export async function PUT(request, { params }) {
    const { user, error } = await authenticate(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const { content } = body; // removed authorId, comes from token now

        if (!content) {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const post = await prisma.post.findUnique({
            where: { id: parseInt(id) }
        });

        if (!post || post.isHidden) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const thread = await prisma.thread.findUnique({ where: { id: post.threadId } });
        if (!thread || thread.isHidden) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }
        if (thread.openAt && new Date() < thread.openAt) {
            return NextResponse.json({ error: "Thread is not open yet" }, { status: 403 });
        }
        if (thread.closeAt && new Date() > thread.closeAt) {
            return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        }

        // Only the author can edit
        if (post.authorId !== user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Save current content to edit history before overwriting
        await prisma.postEdit.create({
            data: {
                postId: post.id,
                content: post.content, // save the OLD content
            }
        });

        const updatedPost = await prisma.post.update({
            where: { id: parseInt(id) },
            data: {
                content,
                version: { increment: 1 },
            },
            include: {
                author: { select: { username: true, avatar: true } }
            }
        });

        return NextResponse.json(updatedPost);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
    }
}

// DELETE: Hide a post (soft delete)
export async function DELETE(request, { params }) {
    const { user, error } = await authenticate(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    try {
        const { id } = await params;

        const post = await prisma.post.findUnique({
            where: { id: parseInt(id) }
        });

        if (!post || post.isHidden) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const thread = await prisma.thread.findUnique({ where: { id: post.threadId } });
        if (!thread || thread.isHidden) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }
        if (thread.openAt && new Date() < thread.openAt) {
            return NextResponse.json({ error: "Thread is not open yet" }, { status: 403 });
        }
        if (thread.closeAt && new Date() > thread.closeAt) {
            return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
        }

        // Only the author OR an admin can delete
        if (post.authorId !== user.id && !isAdmin(user)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await prisma.post.update({
            where: { id: parseInt(id) },
            data: { isHidden: true }
        });

        return NextResponse.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }
}