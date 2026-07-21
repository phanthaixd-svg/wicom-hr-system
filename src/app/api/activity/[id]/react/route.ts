import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { REACT_EMOJIS, groupReactions } from "@/lib/reactions";
import { notifyReaction, larkNotifyEnabled } from "@/lib/larkNotify";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";

export const dynamic = "force-dynamic";

// Toggle 1 reaction của người đang đăng nhập cho 1 hoạt động; trả về reaction đã gom nhóm.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let emoji = "";
  try {
    emoji = (await req.json()).emoji;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!REACT_EMOJIS.includes(emoji)) return NextResponse.json({ error: "bad-emoji" }, { status: 400 });

  // Hoạt động phải tồn tại (tránh tạo reaction mồ côi / lỗi FK khi id giả).
  const activity = await prisma.activity.findUnique({ where: { id }, select: { id: true } });
  if (!activity) return NextResponse.json({ error: "notfound" }, { status: 404 });

  // Mỗi lần bấm +1 vào count (được bấm nhiều lần). Lần đầu (count===1) -> báo Lark cho chủ.
  const REACT_CAP = 50; // trần mỗi người/loại để tránh lạm dụng
  const row = await prisma.reaction.upsert({
    where: { activityId_employeeId_emoji: { activityId: id, employeeId: session.employeeId, emoji } },
    create: { activityId: id, employeeId: session.employeeId, emoji, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (row.count === 1) {
    void maybeNotifyOwner(id, session.employeeId, session.name, emoji);
  }
  if (row.count > REACT_CAP) {
    await prisma.reaction.update({ where: { id: row.id }, data: { count: REACT_CAP } });
  }

  const rows = await prisma.reaction.findMany({
    where: { activityId: id },
    include: { employee: { select: { name: true } } },
  });
  const reactions = groupReactions(
    rows.map((r) => ({ emoji: r.emoji, employeeId: r.employeeId, name: r.employee.name, count: r.count })),
    session.employeeId,
  );
  return NextResponse.json({ reactions });
}

// Bắn DM Lark cho chủ hoạt động khi có người thả cảm xúc. An toàn: mọi lỗi đều nuốt.
async function maybeNotifyOwner(activityId: string, reactorId: string, reactorName: string, emoji: string) {
  try {
    if (!larkNotifyEnabled()) return;
    const act = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        name: true,
        type: true,
        employeeId: true,
        employee: { select: { larkOpenId: true, larkNotifyReaction: true } },
      },
    });
    if (!act) return;
    if (act.employeeId === reactorId) return; // tự thả cho mình -> không báo
    if (!act.employee.larkNotifyReaction) return; // người dùng đã tắt nhận thông báo
    if (!act.employee.larkOpenId) return;

    const sk: SportKey = SPORT_ORDER.includes(act.type as SportKey) ? (act.type as SportKey) : "Other";
    const activityName = act.name || SPORTS[sk].vi;
    await notifyReaction({
      ownerOpenId: act.employee.larkOpenId,
      reactorName,
      emoji,
      activityName,
      activityId,
    });
  } catch (e) {
    console.warn("[react] notify owner lỗi:", e);
  }
}
