import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { authenticate, isAdmin } from "@/utils/auth";
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

export async function POST(request, { params }) {
    const { user, error } = await authenticate(request);
    if (error) return NextResponse.json({ error }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { id } = await params;

        const report = await prisma.report.findUnique({
            where: { id: parseInt(id) }
        });

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        if (report.status !== "pending") {
            return NextResponse.json({ error: "Report already processed" }, { status: 400 });
        }

        // Approve the report and hide the reported content
        const updatedReport = await prisma.report.update({
            where: { id: parseInt(id) },
            data: { status: "approved" }
        });

        // Hide the post or thread that was reported
        if (report.postId) {
            await prisma.post.update({
                where: { id: report.postId },
                data: { isHidden: true }
            });
        }

        if (report.threadId) {
            await prisma.thread.update({
                where: { id: report.threadId },
                data: { isHidden: true }
            });
        }

        return NextResponse.json({ message: "Report approved, content hidden", report: updatedReport });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to approve report" }, { status: 500 });
    }
}