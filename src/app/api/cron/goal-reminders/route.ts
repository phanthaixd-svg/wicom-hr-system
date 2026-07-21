import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeGoalProgress, METRIC_META, PERIOD_META, type GoalMetric, type GoalPeriod } from "@/lib/goals";
import { sendLarkText, larkNotifyEnabled } from "@/lib/larkNotify";
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

  return NextResponse.json({ ok: true, sent, candidates: due.length });
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
