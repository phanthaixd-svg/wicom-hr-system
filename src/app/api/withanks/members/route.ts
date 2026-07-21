import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Danh sách nhân sự để chọn người nhận khoai (trừ chính mình).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const members = await prisma.employee.findMany({
    where: { id: { not: session.employeeId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarUrl: true, team: true },
  });
  return NextResponse.json({ members });
}
