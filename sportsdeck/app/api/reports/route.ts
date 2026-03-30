// app/api/reports/route.js
// POST endpoint to submit a report on a post, thread, or user.
// Claude Sonnet 4.6

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";
import { scoreToxicity } from "@/utils/huggingface";

/**
 * POST /api/reports
 *
 * Body:
 *   {
 *     reason         : string   // reporter's reason
 *     postId         : number?  // report a specific post
 *     threadId       : number?  // report a whole thread
 *     reportedUserId : number?  // report a user
 *   }
 *
 * Exactly one of postId, threadId, or reportedUserId must be provided.
 *
 * Response (201):
 *   { message, report: { id, reason, status, postId, threadId, reportedUserId, createdAt } }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const { user } = auth;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reason, postId, threadId, reportedUserId } = body;

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  if (!reason || typeof reason !== "string" || reason.trim() === "")
    return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const targets = [postId, threadId, reportedUserId].filter(Boolean);
  if (targets.length === 0)
    return NextResponse.json(
      { error: "One of postId, threadId, or reportedUserId must be provided" },
      { status: 400 }
    );
  if (targets.length > 1)
    return NextResponse.json(
      { error: "Provide only one of postId, threadId, or reportedUserId" },
      { status: 400 }
    );

  // Cannot report yourself
  if (reportedUserId && parseInt(reportedUserId) === user.id)
    return NextResponse.json({ error: "You cannot report yourself" }, { status: 400 });

  // -------------------------------------------------------------------------
  // Verify target exists
  // -------------------------------------------------------------------------
  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: parseInt(postId) } });
    if (!post || post.isHidden)
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (threadId) {
    const thread = await prisma.thread.findUnique({ where: { id: parseInt(threadId) } });
    if (!thread || thread.isHidden)
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (reportedUserId) {
    const target = await prisma.user.findUnique({ where: { id: parseInt(reportedUserId) } });
    if (!target)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // -------------------------------------------------------------------------
  // Create the report immediately (no AI score yet)
  // -------------------------------------------------------------------------
  const report = await prisma.report.create({
    data: {
      reporterId:     user.id,
      reason:         reason.trim(),
      status:         "pending",
      postId:         postId         ? parseInt(postId)         : null,
      threadId:       threadId       ? parseInt(threadId)       : null,
      reportedUserId: reportedUserId ? parseInt(reportedUserId) : null,
    },
  });

  // Fire-and-forget AI verdict
  generateAndStoreVerdict(
    report.id,
    postId         ? parseInt(postId)   : null,
    threadId       ? parseInt(threadId) : null,
    reportedUserId ? parseInt(reportedUserId) : null,
  );

  return NextResponse.json(
    {
      message: "Report submitted",
      report: {
        id:             report.id,
        reason:         report.reason,
        status:         report.status,
        postId:         report.postId,
        threadId:       report.threadId,
        reportedUserId: report.reportedUserId,
        createdAt:      report.createdAt,
      },
    },
    { status: 201 }
  );
}


// ---------------------------------------------------------------------------
// Background helper
// ---------------------------------------------------------------------------
async function generateAndStoreVerdict(
  reportId: number,
  postId: number | null,
  threadId: number | null,
  reportedUserId: number | null
) {
  try {
    let textToScore = "";

    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { content: true },
      });
      textToScore = post?.content ?? "";
    } else if (threadId) {
      const topPost = await prisma.post.findFirst({
        where: { threadId, parentId: null, isHidden: false },
        orderBy: { createdAt: "asc" },
        select: { content: true },
      });
      textToScore = topPost?.content ?? "";
    } else if (reportedUserId) {
      // Score the user's most recent post as a representative sample
      const recent = await prisma.post.findFirst({
        where: { authorId: reportedUserId, isHidden: false },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      });
      textToScore = recent?.content ?? "";
    }

    if (!textToScore) return;

    const { score, verdict } = await scoreToxicity(textToScore);

    await prisma.report.update({
      where: { id: reportId },
      data: { aiVerdict: verdict, aiScore: score },
    });
  } catch (err) {
    console.error(
      "[Reports] generateAndStoreVerdict failed:",
      err instanceof Error ? err.message : err
    );
  }
}


