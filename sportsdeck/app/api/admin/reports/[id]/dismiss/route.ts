import { prisma } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await authenticate(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const { user } = auth;
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

        const updatedReport = await prisma.report.update({
            where: { id: parseInt(id) },
            data: { status: "dismissed" }
        });

        return NextResponse.json({ message: "Report dismissed", report: updatedReport });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to dismiss report" }, { status: 500 });
    }
}