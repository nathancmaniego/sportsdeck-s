import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";

// GET /api/teams — return all teams sorted by name
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        tla: true,
        crestUrl: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ teams });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}
