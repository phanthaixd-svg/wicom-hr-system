import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";

export const dynamic = "force-dynamic";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function computeStreak(days: Set<string>): number {
  const cur = new Date();
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  let s = 0;
  while (days.has(dayKey(cur))) { s++; cur.setDate(cur.getDate() - 1); }
  return s;
}

// Hồ sơ công khai (nội bộ) của một nhân sự bất kỳ — cho popup xem profile.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const activities = await prisma.activity.findMany({
    where: { employeeId: id },
    orderBy: { startDate: "desc" },
  });

  let totalVnd = 0;
  let totalKm = 0;
  const days = new Set<string>();
  for (const a of activities) {
    totalVnd += a.amountVnd;
    totalKm += a.distanceKm;
    days.add(dayKey(a.startDate));
  }

  const recent = activities.slice(0, 15).map((a) => {
    const sk: SportKey = SPORT_ORDER.includes(a.type as SportKey) ? (a.type as SportKey) : "Other";
    return {
      id: a.id,
      icon: SPORTS[sk].icon,
      name: a.name || SPORTS[sk].vi,
      km: a.distanceKm,
      timeS: a.movingTimeS,
      date: a.startDate.toISOString(),
      amountVnd: a.amountVnd,
      pending: a.isFlagged,
    };
  });

  const since = activities.length ? activities[activities.length - 1].startDate.toISOString() : null;

  return NextResponse.json({
    id: emp.id,
    name: emp.name,
    team: emp.team ?? "Wicom",
    avatarUrl: emp.avatarUrl,
    isMe: emp.id === session.employeeId,
    totalVnd,
    totalKm,
    count: activities.length,
    streak: computeStreak(days),
    since,
    recent,
  });
}
