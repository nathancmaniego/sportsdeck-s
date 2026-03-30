import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate, isAdmin } from "@/utils/auth";

//Prompt: Implement poll voting endpoint at POST /api/polls/[id]/vote. Authenticated users can cast or change their vote on a poll option. Validate that the poll exists, is not closed, and that the option belongs to the poll. Return updated vote counts for all options after voting. Use JWT for authentication and ensure banned users cannot vote.
//Claude 4.6 Sonnet
// ---------------------------------------------------------------------------
// Helper: fetch poll with vote counts
// ---------------------------------------------------------------------------
async function getPollWithResults(pollId: number) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
      },
      post: {
        select: {
          id: true,
          threadId: true,
          authorId: true,
          isHidden: true,
        },
      },
      _count: { select: { votes: true } },
    },
  });
  return poll;
}

function formatPoll(
  poll: NonNullable<Awaited<ReturnType<typeof getPollWithResults>>>,
  _requestingUserId: number | null = null
) {
  const totalVotes = poll._count.votes;
  return {
    id: poll.id,
    question: poll.question,
    deadline: poll.deadline,
    isClosed: new Date() > new Date(poll.deadline),
    totalVotes,
    options: poll.options.map((o: (typeof poll.options)[number]) => ({
      id: o.id,
      text: o.text,
      votes: o._count.votes,
      percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
    })),
    post: poll.post,
  };
}

// ---------------------------------------------------------------------------
// GET /api/polls/[id]
// Returns poll details with per-option vote counts.
// Public — no auth required.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pollId = parseInt(id);
  if (isNaN(pollId))
    return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

  const poll = await getPollWithResults(pollId);
  if (!poll || poll.post.isHidden)
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  // Optionally attach whether the requesting user has already voted
  let userVote = null;
  const authGet = await authenticate(req);
  if (authGet.ok) {
    const vote = await prisma.vote.findUnique({
      where: { userId_pollId: { userId: authGet.user.id, pollId } },
    });
    userVote = vote ? vote.pollOptionId : null;
  }

  return NextResponse.json({ poll: formatPoll(poll), userVote });
}

// ---------------------------------------------------------------------------
// PUT /api/polls/[id]
// Edit the poll's question, options, or deadline (owner only, before deadline).
//
// Body (all fields optional):
//   {
//     question : string?
//     deadline : string (ISO)?
//     options  : { id?: number, text: string }[]?
//       — omit `id` to add a new option
//       — include `id` to update an existing option
//       — options NOT in this list are deleted (only if they have 0 votes)
//   }
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { user } = auth;

  const { id } = await params;
  const pollId = parseInt(id);
  if (isNaN(pollId))
    return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { include: { _count: { select: { votes: true } } } }, post: true },
  });
  if (!poll || poll.post.isHidden)
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  // Only the post author can edit
  if (poll.post.authorId !== user.id && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (new Date() > new Date(poll.deadline))
    return NextResponse.json({ error: "Cannot edit a closed poll" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { question, deadline, options } = body as {
    question?: string;
    deadline?: string;
    options?: Array<{ id?: number; text: string }>;
  };

  // Validate deadline if provided
  let deadlineDate: Date | undefined;
  if (deadline !== undefined) {
    deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date())
      return NextResponse.json({ error: "deadline must be a valid future date" }, { status: 400 });
  }

  // Validate options if provided
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2)
      return NextResponse.json({ error: "At least 2 options are required" }, { status: 400 });
    if (options.some((o) => typeof o.text !== "string" || o.text.trim() === ""))
      return NextResponse.json({ error: "All options must have non-empty text" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.poll.update({
        where: { id: pollId },
        data: {
          ...(question !== undefined ? { question: question.trim() } : {}),
          ...(deadlineDate !== undefined ? { deadline: deadlineDate } : {}),
        },
      });

      if (options !== undefined) {
        const incomingIds = options.filter((o) => o.id).map((o) => o.id!);
        const existingIds = poll.options.map((o) => o.id);

        const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
        for (const id of toDelete) {
          const opt = poll.options.find((o) => o.id === id);
          if (!opt) continue;
          if (opt._count.votes > 0)
            throw new Error(`Cannot remove option "${opt.text}" because it already has votes`);
          await tx.pollOption.delete({ where: { id } });
        }

        for (const opt of options) {
          if (opt.id) {
            await tx.pollOption.update({ where: { id: opt.id }, data: { text: opt.text.trim() } });
          } else {
            await tx.pollOption.create({ data: { pollId, text: opt.text.trim() } });
          }
        }
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const updated = await getPollWithResults(pollId);
  if (!updated) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }
  return NextResponse.json({ message: "Poll updated", poll: formatPoll(updated) });
}

// ---------------------------------------------------------------------------
// DELETE /api/polls/[id]
// Deletes the poll and its parent post (owner or admin only).
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { user } = auth;

  const { id } = await params;
  const pollId = parseInt(id);
  if (isNaN(pollId))
    return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { post: true },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  if (poll.post.authorId !== user.id && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Cascade: delete votes → options → poll → post
  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { pollId } }),
    prisma.pollOption.deleteMany({ where: { pollId } }),
    prisma.poll.delete({ where: { id: pollId } }),
    prisma.post.delete({ where: { id: poll.postId } }),
  ]);

  return NextResponse.json({ message: "Poll deleted" });
}