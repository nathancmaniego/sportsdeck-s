import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";

//Prompt: Implement poll voting endpoint at POST /api/polls/[id]/vote. Authenticated users can cast or change their vote on a poll option. Validate that the poll exists, is not closed, and that the option belongs to the poll. Return updated vote counts for all options after voting. Use JWT for authentication and ensure banned users cannot vote.
//Claude 4.6 Sonnet
/**
 * POST /api/polls/[id]/vote
 *
 * Cast a vote on a poll option. If the user already voted on this poll,
 * their vote is updated (they can change their selection).
 *
 * Body:
 *   { optionId: number }
 *
 * Rules:
 *   - User must be authenticated and not banned
 *   - Poll must not be past its deadline
 *   - optionId must belong to this poll
 */
export async function POST(req, { params }) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  const pollId = parseInt(id);
  if (isNaN(pollId))
    return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { optionId } = body;
  if (!optionId || isNaN(parseInt(optionId)))
    return NextResponse.json({ error: "optionId is required" }, { status: 400 });

  const parsedOptionId = parseInt(optionId);

  // Fetch poll with the target option
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: true,
      post: { select: { isHidden: true } },
    },
  });

  if (!poll || poll.post.isHidden)
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  if (new Date() > new Date(poll.deadline))
    return NextResponse.json({ error: "This poll is closed" }, { status: 400 });

  const option = poll.options.find((o) => o.id === parsedOptionId);
  if (!option)
    return NextResponse.json({ error: "Option does not belong to this poll" }, { status: 400 });

  // Upsert the vote (one per user per poll, enforced by @@unique([userId, pollId]))
  const vote = await prisma.vote.upsert({
    where: {
      userId_pollId: { userId: user.id, pollId },
    },
    update: {
      pollOptionId: parsedOptionId,
    },
    create: {
      userId: user.id,
      pollId,
      pollOptionId: parsedOptionId,
    },
  });

  // Return updated results
  const updatedOptions = await prisma.pollOption.findMany({
    where: { pollId },
    include: { _count: { select: { votes: true } } },
  });
  const totalVotes = updatedOptions.reduce((sum, o) => sum + o._count.votes, 0);

  return NextResponse.json({
    message: "Vote recorded",
    selectedOptionId: vote.pollOptionId,
    results: updatedOptions.map((o) => ({
      id: o.id,
      text: o.text,
      votes: o._count.votes,
      percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
    })),
    totalVotes,
  });
}