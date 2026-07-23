import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";

export const dynamic = "force-dynamic";

// Bảng tin hoạt động TOÀN CÔNG TY gần đây, trong khoảng ngày filter của Dashboard.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromDate = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const toDate = to ? new Date(`${to}T23:59:59`) : new Date();

  const me = await prisma.employee.findUnique({ where: { id: session.employeeId } });

  const rows = await prisma.activity.findMany({
    where: { startDate: { gte: fromDate, lte: toDate } },
    orderBy: { startDate: "desc" },
    take: 48,
    include: { employee: { select: { id: true, name: true, team: true, avatarUrl: true } } },
  });

  const items = rows.map((a) => {
    const sk: SportKey = SPORT_ORDER.includes(a.type as SportKey) ? (a.type as SportKey) : "Other";
    return {
      id: a.id,
      sport: sk,
      icon: SPORTS[sk].icon,
      name: a.name || SPORTS[sk].vi,
      dateISO: a.startDate.toISOString(),
      distanceKm: a.distanceKm,
      timeS: a.movingTimeS,
      amountVnd: a.amountVnd,
      pending: a.isFlagged,
      // Nguồn Strava -> để hiển thị link "View on Strava" (bắt buộc theo brand guidelines).
      stravaId: a.source === "strava" ? a.stravaId : null,
      who: { id: a.employee.id, name: a.employee.name, team: a.employee.team ?? "Wicom", avatarUrl: a.employee.avatarUrl },
    };
  });

  return NextResponse.json({
    myTeam: me?.team ?? null,
    sports: SPORT_ORDER.filter((k) => rows.some((a) => a.type === k)).map((k) => ({
      key: k,
      vi: SPORTS[k].vi,
      icon: SPORTS[k].icon,
    })),
    items,
  });
}
