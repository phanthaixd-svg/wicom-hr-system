import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { larkNotifyEnabled } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { larkNotifyReaction: true },
  });
  return NextResponse.json({
    larkNotifyReaction: emp?.larkNotifyReaction ?? true,
    larkReady: larkNotifyEnabled(), // Lark app đã cấu hình chưa (để UI hiện gợi ý)
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { larkNotifyReaction?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (typeof body.larkNotifyReaction === "boolean") {
    await prisma.employee.update({
      where: { id: session.employeeId },
      data: { larkNotifyReaction: body.larkNotifyReaction },
    });
  }
  return NextResponse.json({ ok: true });
}
