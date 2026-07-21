import { prisma } from "./db";

export type GoalMetric = "km" | "sessions" | "minutes" | "vnd";
export type GoalPeriod = "week" | "month" | "quarter";

export const METRIC_META: Record<GoalMetric, { label: string; unit: string; short: string }> = {
  km: { label: "Quãng đường", unit: "km", short: "km" },
  sessions: { label: "Số buổi", unit: "buổi", short: "buổi" },
  minutes: { label: "Thời gian", unit: "phút", short: "phút" },
  vnd: { label: "Quỹ đóng góp", unit: "₫", short: "₫" },
};
export const PERIOD_META: Record<GoalPeriod, { label: string }> = {
  week: { label: "tuần này" },
  month: { label: "tháng này" },
  quarter: { label: "quý này" },
};

// Mốc bắt đầu kỳ hiện tại (giờ máy chủ). Tuần bắt đầu Thứ 2.
export function periodStart(period: string, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  // week (mặc định) — về Thứ 2
  const dow = (d.getDay() + 6) % 7; // 0 = Thứ 2
  d.setDate(d.getDate() - dow);
  return d;
}

export interface GoalProgress {
  id: string;
  sport: string;
  metric: string;
  target: number;
  period: string;
  label: string | null;
  active: boolean;
  remindEveryDays: number | null;
  remindHour: number;
  current: number; // giá trị đã đạt trong kỳ
  pct: number; // 0..100 (đã kẹp)
}

// Tính giá trị metric đã đạt của 1 nhân sự trong kỳ hiện tại cho từng goal.
export async function computeGoalProgress(employeeId: string, now = new Date()): Promise<GoalProgress[]> {
  const goals = await prisma.goal.findMany({
    where: { employeeId, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (goals.length === 0) return [];

  // Lấy hoạt động từ mốc kỳ xa nhất trở lại đây (đủ cho mọi goal), rồi lọc theo từng goal.
  const earliest = goals.reduce<Date>((min, g) => {
    const s = periodStart(g.period, now);
    return s < min ? s : min;
  }, now);

  const acts = await prisma.activity.findMany({
    where: { employeeId, startDate: { gte: earliest } },
    select: { type: true, kindKey: true, distanceKm: true, movingTimeS: true, amountVnd: true, startDate: true },
  });

  return goals.map((g) => {
    const start = periodStart(g.period, now);
    let current = 0;
    for (const a of acts) {
      if (a.startDate < start) continue;
      // lọc theo môn: "all" = tất cả; SportKey khớp type; kindKey khớp hoạt động tay
      if (g.sport !== "all" && a.type !== g.sport && a.kindKey !== g.sport) continue;
      if (g.metric === "km") current += a.distanceKm;
      else if (g.metric === "sessions") current += 1;
      else if (g.metric === "minutes") current += a.movingTimeS / 60;
      else if (g.metric === "vnd") current += a.amountVnd;
    }
    current = Math.round(current * 10) / 10;
    const pct = g.target > 0 ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
    return {
      id: g.id,
      sport: g.sport,
      metric: g.metric,
      target: g.target,
      period: g.period,
      label: g.label,
      active: g.active,
      remindEveryDays: g.remindEveryDays,
      remindHour: g.remindHour,
      current,
      pct,
    };
  });
}
