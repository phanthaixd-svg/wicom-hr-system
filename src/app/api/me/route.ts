import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getRules } from "@/lib/conversion";
import { getKindMap } from "@/lib/kinds";
import { badgeMetrics, computeBadgeStates } from "@/lib/badges";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";

export const dynamic = "force-dynamic";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function computeStreak(days: Set<string>): number {
  const cur = new Date();
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1); // chưa tập hôm nay -> tính từ hôm qua
  let streak = 0;
  while (days.has(dayKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { stravaAccount: true },
  });
  if (!emp) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const stravaConnected = Boolean(emp.stravaAccount && !emp.stravaAccount.revokedAt);
  const stravaConnectedAt = stravaConnected ? emp.stravaAccount!.connectedAt.toISOString() : null;

  const activities = await prisma.activity.findMany({
    where: { employeeId: emp.id },
    orderBy: { startDate: "desc" },
  });
  const rules = await getRules();
  const kindMap = await getKindMap();

  let totalVnd = 0;
  let totalKm = 0;
  let earlyCount = 0;
  let hikeCount = 0;
  const days = new Set<string>();
  for (const a of activities) {
    totalVnd += a.amountVnd;
    totalKm += a.distanceKm;
    days.add(dayKey(a.startDate));
    if (a.startDate.getHours() < 7) earlyCount++;
    if (a.type === "Hike") hikeCount++;
  }
  const streak = computeStreak(days);

  // Xếp hạng theo quỹ trong toàn công ty -> phần trăm top.
  const grouped = await prisma.activity.groupBy({ by: ["employeeId"], _sum: { amountVnd: true } });
  const totalPeople = await prisma.employee.count();
  const rank = grouped.filter((g) => (g._sum.amountVnd ?? 0) > totalVnd).length + 1;
  const percentile = Math.max(1, Math.round((rank / Math.max(1, totalPeople)) * 100));

  // Huy hiệu có hạng + tiến độ + độ hiếm toàn công ty.
  const myMetrics = { streak, early: earlyCount, km: totalKm, hikes: hikeCount, vnd: totalVnd, count: activities.length };
  const allActs = await prisma.activity.findMany({
    select: { employeeId: true, distanceKm: true, startDate: true, type: true, amountVnd: true },
  });
  const actsByEmp = new Map<string, { distanceKm: number; startDate: Date; type: string; amountVnd: number }[]>();
  for (const a of allActs) {
    const arr = actsByEmp.get(a.employeeId) ?? [];
    arr.push(a);
    actsByEmp.set(a.employeeId, arr);
  }
  const allMetrics = [...actsByEmp.values()].map(badgeMetrics);
  const totalPeople2 = await prisma.employee.count();
  const badges = computeBadgeStates(myMetrics, allMetrics, totalPeople2);

  const recent = activities.slice(0, 20).map((a) => {
    const sk: SportKey = SPORT_ORDER.includes(a.type as SportKey) ? (a.type as SportKey) : "Other";
    const manualKind = a.source === "manual" && a.kindKey ? kindMap[a.kindKey] : undefined;
    const rejected = Boolean(a.rejectedAt);
    // môn để lọc: hoạt động tay dùng kindKey, còn lại dùng SportKey
    const sportFilter = manualKind ? a.kindKey! : sk;
    const rateLabel = manualKind
      ? manualKind.mode === "km"
        ? `${manualKind.rateVnd.toLocaleString("vi-VN")}đ/km`
        : `${manualKind.rateVnd.toLocaleString("vi-VN")}đ/buổi`
      : rules[a.type]
        ? rules[a.type].mode === "km"
          ? `${rules[a.type].rateVnd.toLocaleString("vi-VN")}đ/km`
          : `${rules[a.type].rateVnd.toLocaleString("vi-VN")}đ/buổi`
        : "";
    return {
      id: a.id,
      sport: sportFilter,
      icon: manualKind?.icon ?? SPORTS[sk].icon,
      name: a.name || manualKind?.nameVi || SPORTS[sk].vi,
      km: a.distanceKm,
      timeS: a.movingTimeS,
      date: a.startDate.toISOString(),
      amountVnd: a.amountVnd,
      pending: a.isFlagged && !rejected,
      rejected,
      manual: a.source === "manual",
      rateLabel,
    };
  });

  return NextResponse.json({
    name: emp.name,
    team: emp.team ?? "Wicom",
    avatarUrl: emp.avatarUrl,
    stravaConnected,
    stravaConnectedAt,
    totalVnd,
    totalKm,
    count: activities.length,
    streak,
    rank,
    percentile,
    totalPeople,
    badges,
    unlockedBadges: badges.filter((b) => b.unlocked).length,
    totalTiers: badges.reduce((n, b) => n + b.tier, 0),
    pendingCount: activities.filter((a) => a.isFlagged).length,
    recent,
    sports: [
      ...SPORT_ORDER.filter((k) => activities.some((a) => a.type === k && a.source !== "manual")).map((k) => ({
        key: k,
        vi: SPORTS[k].vi,
        icon: SPORTS[k].icon,
      })),
      ...[...new Set(activities.filter((a) => a.source === "manual" && a.kindKey).map((a) => a.kindKey!))]
        .filter((k) => kindMap[k])
        .map((k) => ({ key: k, vi: kindMap[k].nameVi, icon: kindMap[k].icon })),
    ],
  });
}
