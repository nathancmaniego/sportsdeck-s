import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { authenticateIncludingBanned } from "@/utils/auth";
// Used Claude AI to help implement this js file
// // Prompt: Okay next we have to do this part:
// 2. Moderation (Admin & User)
// These endpoints manage reports, bans, and appeals.
// • app/api/reports/route.js
// • POST: Submit a new report.
// • app/api/admin/reports/route.js
// • GET: View the queue of all reports.
// • app/api/admin/reports/[id]/approve/route.js & .../dismiss/route.js
// • POST: Process a report.
// • app/api/admin/users/[id]/ban/route.js & .../unban/route.js
// • POST: Manage user access.
// • app/api/appeals/route.js
// • POST: User submits an appeal.

/**
 * GET /api/appeals
 * Returns the current user's most recent appeal (for banned users to see status/denial message).
 */
export async function GET(request) {
    const { user, error } = await authenticateIncludingBanned(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    const appeal = await prisma.appeal.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, reason: true, adminMessage: true, createdAt: true },
    });

    return NextResponse.json({ appeal });
}

export async function POST(request) {
    const { user, error } = await authenticateIncludingBanned(request);
    if (error) return NextResponse.json({ error }, { status: 401 });

    try {
        const body = await request.json();
        const { reason } = body;

        if (!reason || reason.trim() === "") {
            return NextResponse.json({ error: "reason is required" }, { status: 400 });
        }

        // Check user actually has a pending or no appeal already
        const existingAppeal = await prisma.appeal.findFirst({
            where: { userId: user.id, status: "pending" }
        });

        if (existingAppeal) {
            return NextResponse.json({ error: "You already have a pending appeal" }, { status: 400 });
        }

        const appeal = await prisma.appeal.create({
            data: {
                userId: user.id,
                reason: reason.trim(),
                status: "pending"
            }
        });

        return NextResponse.json({ message: "Appeal submitted successfully", appeal }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 });
    }
}