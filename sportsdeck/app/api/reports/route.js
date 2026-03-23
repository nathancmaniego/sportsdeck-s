// app/api/reports/route.js
// Prompt: POST endpoint to submit a report on a post or thread. After saving,
// asynchronously generate an AI toxicity verdict via Hugging Face and store it
// on the Report record. Returns the report immediately; verdict is added in the
// background so the response is fast.
// Claude Sonnet 4.6

import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { authenticate } from "@/utils/auth";
import { scoreToxicity } from "@/utils/huggingface";

/**
 * POST /api/reports
 *
 * Body:
 *   {
 *     reason   : string          // reporter's reason
 *     postId   : number?         // report a specific post
 *     threadId : number?         // report a whole thread
 *   }
 *
 * One of postId or threadId must be provided (not both).
 *
 * Response (201):
 *   { message, report: { id, reason, status, postId, threadId, createdAt } }
 *
 * AI verdict is written to the report asynchronously — it will appear on the
 * record within a few seconds and is visible when admins fetch the report.
 */
export async function POST(req) {
  const { user, error } = await authenticate(req);
  if (error) return NextResponse.json({ error }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reason, postId, threadId } = body;

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  if (!reason || typeof reason !== "string" || reason.trim() === "")
    return NextResponse.json({ error: "reason is required" }, { status: 400 });

  if (!postId && !threadId)
    return NextResponse.json(
      { error: "Either postId or threadId must be provided" },
      { status: 400 }
    );

  if (postId && threadId)
    return NextResponse.json(
      { error: "Provide either postId or threadId, not both" },
      { status: 400 }
    );

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

  // -------------------------------------------------------------------------
  // Create the report immediately (no AI score yet)
  // -------------------------------------------------------------------------
  const report = await prisma.report.create({
    data: {
      reporterId: user.id,
      reason:     reason.trim(),
      status:     "pending",
      postId:     postId   ? parseInt(postId)   : null,
      threadId:   threadId ? parseInt(threadId) : null,
    },
  });

  // -------------------------------------------------------------------------
  // Fire-and-forget: generate AI verdict asynchronously
  // The response is returned immediately; the DB record is updated in the bg.
  // -------------------------------------------------------------------------
  generateAndStoreVerdict(report.id, postId ? parseInt(postId) : null, threadId ? parseInt(threadId) : null);

  return NextResponse.json(
    {
      message: "Report submitted",
      report: {
        id:        report.id,
        reason:    report.reason,
        status:    report.status,
        postId:    report.postId,
        threadId:  report.threadId,
        createdAt: report.createdAt,
      },
    },
    { status: 201 }
  );
}


// ---------------------------------------------------------------------------
// Background helper — runs after response is sent
// ---------------------------------------------------------------------------

/**
 * Fetches the reported content, scores it for toxicity, and writes the
 * aiVerdict + aiScore back onto the Report row.
 */
async function generateAndStoreVerdict(reportId, postId, threadId) {
  try {
    let textToScore = "";

    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { content: true },
      });
      textToScore = post?.content ?? "";
    } else if (threadId) {
      // Score the first (top-level) post of the thread as a representative sample
      const topPost = await prisma.post.findFirst({
        where: { threadId, parentId: null, isHidden: false },
        orderBy: { createdAt: "asc" },
        select: { content: true },
      });
      textToScore = topPost?.content ?? "";
    }

    if (!textToScore) return;

    const { score, verdict } = await scoreToxicity(textToScore);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        aiVerdict: verdict,
        aiScore:   score,
      },
    });
  } catch (err) {
    // Non-fatal — admins just won't see a verdict for this report
    console.error("[Reports] generateAndStoreVerdict failed:", err.message);
  }
}

