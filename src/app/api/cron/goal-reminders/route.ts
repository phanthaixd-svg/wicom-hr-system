import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeGoalProgress, METRIC_META, PERIOD_META, type GoalMetric, type GoalPeriod } from "@/lib/goals";
import { sendLarkText, larkNotifyEnabled, notifyWeeklyDigest } from "@/lib/larkNotify";
import { computeAllowance } from "@/lib/withanks";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Gửi nhắc mục tiêu qua Lark cho các goal đã tới hạn nhắc.
// Bảo vệ: Authorization: Bearer <CRON_SECRET>. Chạy định kỳ (khuyến nghị mỗi giờ hoặc mỗi sáng).
// Với ?force=1 sẽ bỏ qua điều kiện thời gian (dùng để test thủ công).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!larkNotifyEnabled()) {
    return NextResponse.json({ ok: true, skipped: "lark-not-configured", sent: 0 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();
  const nowHour = now.getHours();

  // Chỉ xét goal có bật nhắc.
  const due = await prisma.goal.findMany({
    where: { active: true, remindEveryDays: { not: null } },
    include: { employee: { select: { larkOpenId: true, name: true } } },
  });

  // Gom theo nhân sự để tính tiến độ 1 lần / người.
  const byEmp = new Map<string, typeof due>();
  for (const g of due) {
    if (!g.employee.larkOpenId) continue;
    const arr = byEmp.get(g.employeeId) ?? [];
    arr.push(g);
    byEmp.set(g.employeeId, arr);
  }

  let sent = 0;
  const remindedIds: string[] = [];
  for (const [employeeId, goals] of byEmp) {
    const progress = await computeGoalProgress(employeeId, now);
    const progMap = new Map(progress.map((p) => [p.id, p]));

    for (const g of goals) {
      const everyDays = g.remindEveryDays ?? 0;
      if (everyDays <= 0) continue;
      // Đủ khoảng cách kể từ lần nhắc trước?
      const daysSince = g.lastRemindedAt ? (now.getTime() - g.lastRemindedAt.getTime()) / 86400000 : Infinity;
      const dueByInterval = daysSince >= everyDays - 0.01;
      // Đúng khung giờ nhắc? (nới ±1h để không lỡ nếu cron chạy thưa; force bỏ qua)
      const hourOk = force || Math.abs(nowHour - g.remindHour) <= 1 || nowHour >= g.remindHour;
      if (!force && (!dueByInterval || !hourOk)) continue;
      if (force && !dueByInterval && g.lastRemindedAt) {
        /* khi force vẫn cho gửi lại */
      }

      const p = progMap.get(g.id);
      if (!p) continue;
      const text = buildReminderText(g.employee.name, p);
      const ok = await sendLarkText(g.employee.larkOpenId!, text);
      if (ok) {
        sent++;
        remindedIds.push(g.id);
      }
    }
  }

  if (remindedIds.length > 0) {
    await prisma.goal.updateMany({ where: { id: { in: remindedIds } }, data: { lastRemindedAt: now } });
  }

  // E1+C2 — Tổng kết tuần (chỉ sáng thứ 2 VN; ?force=1 để test bất kỳ lúc nào).
  const digestSent = await maybeSendWeeklyDigests(now, force);

  return NextResponse.json({ ok: true, sent, candidates: due.length, digestSent });
}

// Gửi card tổng kết tuần cho mọi nhân sự đang làm (có open_id + bật digest).
async function maybeSendWeeklyDigests(now: Date, force: boolean): Promise<number> {
  const vnDay = new Date(now.getTime() + 7 * 3600 * 1000).getUTCDay(); // 1 = thứ 2 (VN = UTC+7)
  if (!force && vnDay !== 1) return 0;

  const from = new Date(now.getTime() - 7 * 86400 * 1000);
  const employees = await prisma.employee.findMany({
    where: { leftAt: null, larkNotifyDigest: true },
    select: { id: true, name: true, larkOpenId: true, wiRole: true, isAdmin: true },
  });
  if (employees.length === 0) return 0;

  const [acts, recv, gave] = await Promise.all([
    prisma.activity.groupBy({ by: ["employeeId"], _sum: { distanceKm: true, amountVnd: true }, where: { startDate: { gte: from } } }),
    prisma.thanksGift.groupBy({ by: ["receiverId"], _sum: { khoai: true }, where: { createdAt: { gte: from }, kind: { not: "special" } } }),
    prisma.thanksGift.groupBy({ by: ["senderId"], _count: true, where: { createdAt: { gte: from } } }),
  ]);
  const actMap = new Map(acts.map((a) => [a.employeeId, { km: a._sum.distanceKm ?? 0, fund: a._sum.amountVnd ?? 0 }]));
  const recvMap = new Map(recv.map((r) => [r.receiverId, r._sum.khoai ?? 0]));
  const gaveMap = new Map(gave.map((g) => [g.senderId, g._count]));

  let n = 0;
  for (const e of employees) {
    const s = actMap.get(e.id) ?? { km: 0, fund: 0 };
    const al = await computeAllowance(e);
    const weekAllowance = al.unlimited ? null : (al.weekLimit ?? al.monthLimit ?? null);
    const ok = await notifyWeeklyDigest(e.larkOpenId, {
      name: e.name,
      km: s.km,
      fundVnd: s.fund,
      khoaiReceived: recvMap.get(e.id) ?? 0,
      gaveCount: gaveMap.get(e.id) ?? 0,
      weekAllowance,
    });
    if (ok) n++;
  }
  return n;
}

function sportLabel(sport: string): string {
  if (sport === "all") return "tất cả bộ môn";
  const sk = SPORT_ORDER.includes(sport as SportKey) ? (sport as SportKey) : null;
  if (sk) return SPORTS[sk].vi;
  return "môn đã chọn";
}

function fmt(metric: string, v: number): string {
  if (metric === "vnd") return `${Math.round(v).toLocaleString("vi-VN")}₫`;
  return `${Math.round(v * 10) / 10}`.replace(/\.0$/, "");
}

function buildReminderText(name: string, p: { metric: string; current: number; target: number; pct: number; period: string; sport: string; label: string | null }): string {
  const mm = METRIC_META[p.metric as GoalMetric];
  const pm = PERIOD_META[p.period as GoalPeriod];
  const unit = p.metric === "vnd" ? "" : ` ${mm.short}`;
  const goalName = p.label ? `“${p.label}”` : `mục tiêu ${mm.label.toLowerCase()} ${sportLabel(p.sport)}`;
  const first = name.split(" ").slice(-1)[0] || name;
  const remain = Math.max(0, p.target - p.current);

  if (p.pct >= 100) {
    return `🎉 ${first} ơi! Bạn đã HOÀN THÀNH ${goalName} ${pm.label}: ${fmt(p.metric, p.current)}${unit}/${fmt(p.metric, p.target)}${unit}. Quá đỉnh! 💪 #WicomMove`;
  }
  return `⏰ Nhắc nhẹ ${goalName} ${pm.label}: mới đạt ${fmt(p.metric, p.current)}${unit}/${fmt(p.metric, p.target)}${unit} (${p.pct}%). Còn ${fmt(p.metric, remain)}${unit} nữa thôi — cố lên ${first}! 🏃 Mở Move for Wishare để ghi nhận nhé.`;
}
