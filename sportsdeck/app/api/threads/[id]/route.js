import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { authenticate, isAdmin } from "@/utils/auth";
// Used Artificial intelligence for this using GEMINI
// Prompt: Can you help me create the route.js file's PUT, GET and DELETE functions for threads/[id] please

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const thread = await prisma.thread.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: { select: { username: true, avatar: true } },
        tags: { include: { tag: true } },
        match: {
          include: {
            homeTeam: true,
            awayTeam: true
          }
        },
        posts: {
          where: { isHidden: false },
          include: { 
            author: { select: { username: true, avatar: true } } 
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!thread || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json(thread);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  // Must be logged in
  const { user, error } = await authenticate(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, tags } = body;

    const thread = await prisma.thread.findUnique({
      where: { id: parseInt(id) }
    });

    if (!thread || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Only the author can edit their thread
    if (thread.authorId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedThread = await prisma.thread.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(tags && {
          tags: {
            deleteMany: {},
            create: tags.map((tagName) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName },
                },
              },
            })),
          },
        }),
      },
      include: {
        tags: { include: { tag: true } }
      }
    });

    return NextResponse.json(updatedThread);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  // Must be logged in
  const { user, error } = await authenticate(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  try {
    const { id } = await params;

    const thread = await prisma.thread.findUnique({
      where: { id: parseInt(id) }
    });

    if (!thread || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Only the author OR an admin can delete
    if (thread.authorId !== user.id && !isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.thread.update({
      where: { id: parseInt(id) },
      data: { isHidden: true }
    });

    return NextResponse.json({ message: "Thread hidden successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}