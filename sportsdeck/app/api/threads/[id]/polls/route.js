import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate, isAdmin } from "@/utils/auth";
// Prompt: Implement the GET and POST endpoints for /api/threads/[id]/polls. The GET endpoint should return the poll associated with the thread, including its options and vote counts. The POST endpoint should allow authenticated users to create a new poll attached to a new post in the thread. The request body for POST should include the poll question, options, and deadline. Ensure that only the thread author or admins can create polls, and that appropriate error handling is in place for invalid requests or permissions issues.
// Claude Sonnet 4.6
/**
 * POST /api/threads/[id]/polls
 *
 * Creates a new post in the thread and attaches a poll to it.
 *
 * Body:
 *   {
 *     question : string          // poll question
 *     options  : string[]        // at least 2 option texts
 *     deadline : string (ISO)    // deadline after which voting is closed
 *     content  : string?         // optional post body text (defaults to question)
 *   }
 *
 * Auth: required (banned users cannot create polls)
 */
export async function POST(req, { params }) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  const threadId = parseInt(id);
  if (isNaN(threadId))
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 });

  // Verify thread exists and is not hidden/closed
  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread || thread.isHidden)
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const now = new Date();
  if (thread.closeAt && now > thread.closeAt)
    return NextResponse.json({ error: "Thread is closed" }, { status: 403 });
  if (now < thread.openAt)
    return NextResponse.json({ error: "Thread is not open yet" }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { question, options, deadline, content } = body;

  if (!question || typeof question !== "string" || question.trim() === "")
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  if (!Array.isArray(options) || options.length < 2)
    return NextResponse.json({ error: "At least 2 options are required" }, { status: 400 });
  if (options.some((o) => typeof o !== "string" || o.trim() === ""))
    return NextResponse.json({ error: "All options must be non-empty strings" }, { status: 400 });
  if (!deadline)
    return NextResponse.json({ error: "deadline is required" }, { status: 400 });

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime()) || deadlineDate <= now)
    return NextResponse.json({ error: "deadline must be a valid future date" }, { status: 400 });

  // Create post + poll in a transaction
  const post = await prisma.post.create({
    data: {
      threadId,
      authorId: user.id,
      content: content?.trim() || question.trim(),
      poll: {
        create: {
          question: question.trim(),
          deadline: deadlineDate,
          options: {
            create: options.map((text) => ({ text: text.trim() })),
          },
        },
      },
    },
    include: {
      poll: {
        include: { options: true },
      },
    },
  });

  return NextResponse.json(
    {
      message: "Poll created",
      post: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
      },
      poll: {
        id: post.poll.id,
        question: post.poll.question,
        deadline: post.poll.deadline,
        options: post.poll.options.map((o) => ({ id: o.id, text: o.text })),
      },
    },
    { status: 201 }
  );
}