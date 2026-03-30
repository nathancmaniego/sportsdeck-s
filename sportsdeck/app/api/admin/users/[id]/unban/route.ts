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

        const targetUser = await prisma.user.findUnique({
            where: { id: parseInt(id) }
        });

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!targetUser.isBanned) {
            return NextResponse.json({ error: "User is not banned" }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { isBanned: false },
            select: { id: true, username: true, email: true, isBanned: true }
        });

        return NextResponse.json({ message: "User unbanned successfully", user: updatedUser });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to unban user" }, { status: 500 });
    }
}