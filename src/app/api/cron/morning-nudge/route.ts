import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { larkNotifyEnabled, sendLarkText } from "@/lib/larkNotify";
import { weekStart, MOVE_WEEK_TARGET_KM } from "@/lib/wicer";

export const dynamic = "force-dynamic";

// Trigger buổi sáng: bắn Lark kéo nhân sự về Wicer Home.
// Gọi bởi cron/scheduler bên ngoài (vd system cron 08:00 mỗi ngày):
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/morning-nudge
// Chỉ gửi khi có điều đáng nói (lời cảm ơn mới / vòng chưa khép) để tránh spam.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET chưa cấu hình" }, { status: 503 });
  // Chỉ nhận secret qua header (không nhận qua query string để tránh lộ vào log/referer).
  const provided = req.headers.get("x-cron-secret");
  if (provided !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!larkNotifyEnabled()) return NextResponse.json({ ok: true, sent: 0, note: "Lark notify đang tắt" });

  const now = new Date();
  const ws = weekStart(now);
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

  const employees = await prisma.employee.findMany({ select: { id: true, name: true, larkOpenId: true } });

  const [recv24, moveWeek, gaveWeek] = await Promise.all([
    prisma.thanksGift.groupBy({ by: ["receiverId"], _count: true, where: { createdAt: { gte: yesterday } } }),
    prisma.activity.groupBy({ by: ["employeeId"], _sum: { distanceKm: true }, where: { startDate: { gte: ws } } }),
    prisma.thanksGift.groupBy({ by: ["senderId"], _count: true, where: { createdAt: { gte: ws } } }),
  ]);
  const recvMap = new Map(recv24.map((r) => [r.receiverId, r._count]));
  const kmMap = new Map(moveWeek.map((r) => [r.employeeId, r._sum.distanceKm ?? 0]));
  const gaveSet = new Set(gaveWeek.map((r) => r.senderId));

  const base = process.env.APP_BASE_URL || "";
  let sent = 0;
  for (const e of employees) {
    if (!e.larkOpenId) continue;
    const newThanks = recvMap.get(e.id) ?? 0;
    const km = kmMap.get(e.id) ?? 0;
    const kmLeft = Math.max(0, +(MOVE_WEEK_TARGET_KM - km).toFixed(1));
    const gave = gaveSet.has(e.id);
    if (newThanks === 0 && kmLeft === 0 && gave) continue; // không có gì để nhắc

    const lines: string[] = [`☀️ Chào buổi sáng, ${e.name.split(" ").slice(-1)[0]}!`];
    if (newThanks > 0) lines.push(`🥔 Bạn có ${newThanks} lời cảm ơn mới đang chờ mở.`);
    if (kmLeft > 0) lines.push(`🔵 Còn ${kmLeft}km nữa là khép vòng Move tuần này.`);
    if (!gave) lines.push(`💚 Hôm nay hãy cảm ơn một đồng đội nhé.`);
    lines.push(`👉 Mở Wicer Home: ${base}/me`);

    if (await sendLarkText(e.larkOpenId, lines.join("\n"))) sent++;
  }

  return NextResponse.json({ ok: true, total: employees.length, sent });
}
