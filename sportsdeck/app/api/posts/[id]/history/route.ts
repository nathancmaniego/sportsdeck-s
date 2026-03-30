import { prisma } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
//Used Claude AI to help implement this js file
//Prompt: okay ti works now lets work on creating the app/api/posts/[id]/route.js and the app/api/posts/[id]/history/route.js based on this new info 


// GET: View version history of a post (public)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const post = await prisma.post.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: { select: { username: true, avatar: true } },
                editHistory: {
                    orderBy: { editedAt: "desc" } // most recent edit first
                }
            }
        });

        if (!post || post.isHidden) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        return NextResponse.json({
            currentVersion: {
                content: post.content,
                version: post.version,
                updatedAt: post.updatedAt,
                author: post.author
            },
            history: post.editHistory // all previous versions
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch post history" }, { status: 500 });
    }
}