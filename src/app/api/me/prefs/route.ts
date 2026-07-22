import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { larkNotifyEnabled } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

// Các công tắc thông báo Lark (mỗi loại 1 toggle). Key phải trùng cột trong Employee.
const NOTIFY_KEYS = ["larkNotifyThanks", "larkNotifyActivity", "larkNotifyComment", "larkNotifyReaction", "larkNotifyDigest"] as const;
type NotifyKey = (typeof NOTIFY_KEYS)[number];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { larkNotifyThanks: true, larkNotifyActivity: true, larkNotifyComment: true, larkNotifyReaction: true, larkNotifyDigest: true },
  });
  return NextResponse.json({
    larkNotifyThanks: emp?.larkNotifyThanks ?? true,
    larkNotifyActivity: emp?.larkNotifyActivity ?? true,
    larkNotifyComment: emp?.larkNotifyComment ?? true,
    larkNotifyReaction: emp?.larkNotifyReaction ?? true,
    larkNotifyDigest: emp?.larkNotifyDigest ?? true,
    larkReady: larkNotifyEnabled(), // Lark app đã cấu hình gửi tin chưa (để UI hiện gợi ý)
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const data: Partial<Record<NotifyKey, boolean>> = {};
  for (const k of NOTIFY_KEYS) {
    if (typeof body[k] === "boolean") data[k] = body[k] as boolean;
  }
  if (Object.keys(data).length > 0) {
    await prisma.employee.update({ where: { id: session.employeeId }, data });
  }
  return NextResponse.json({ ok: true });
}
