import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";
import { groupReactions } from "@/lib/reactions";
import { getKindMap } from "@/lib/kinds";
import { weekStartVN, computeRings } from "@/lib/wicer";
import { encodedToSvgPath } from "@/lib/polyline";

export const dynamic = "force-dynamic";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// Feed hoạt động mới nhất + nhịp 7 ngày qua (cố định, không theo filter ngày).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = startOfDay(new Date());
  const day7 = new Date(today);
  day7.setDate(day7.getDate() - 6); // 7 ngày gồm hôm nay
  const prev7 = new Date(day7);
  prev7.setDate(prev7.getDate() - 7); // 7 ngày liền trước
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Feed: 18 hoạt động mới nhất toàn công ty.
  const feedRows = await prisma.activity.findMany({
    orderBy: { startDate: "desc" },
    take: 18,
    include: {
      employee: { select: { id: true, name: true, team: true, avatarUrl: true } },
      reactions: { include: { employee: { select: { name: true } } } },
    },
  });
  const kindMap = await getKindMap();

  // Bình luận cho các hoạt động trong feed (đếm + bình luận mới nhất).
  const feedIds = feedRows.map((a) => a.id);
  const cmtRows = feedIds.length
    ? await prisma.comment.findMany({
        where: { activityId: { in: feedIds } },
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { name: true } } },
      })
    : [];
  const cmtMap = new Map<string, { count: number; top: { name: string; body: string } | null }>();
  for (const c of cmtRows) {
    const e = cmtMap.get(c.activityId) ?? { count: 0, top: null };
    e.count++;
    if (!e.top) e.top = { name: c.employee.name, body: c.body }; // desc → phần tử đầu là mới nhất
    cmtMap.set(c.activityId, e);
  }

  const feed = feedRows.map((a) => {
    const sk: SportKey = SPORT_ORDER.includes(a.type as SportKey) ? (a.type as SportKey) : "Other";
    const manualKind = a.source === "manual" && a.kindKey ? kindMap[a.kindKey] : undefined;
    return {
      id: a.id,
      sport: sk,
      kindKey: a.source === "manual" ? a.kindKey : null,
      icon: manualKind?.icon ?? SPORTS[sk].icon,
      kindName: manualKind?.nameVi ?? null,
      name: a.name || manualKind?.nameVi || SPORTS[sk].vi,
      km: a.distanceKm,
      timeS: a.movingTimeS,
      dateISO: a.startDate.toISOString(),
      amountVnd: a.amountVnd,
      pending: a.isFlagged,
      who: { id: a.employee.id, name: a.employee.name, team: a.employee.team ?? "Wicom", avatarUrl: a.employee.avatarUrl },
      routePath: encodedToSvgPath(a.mapPolyline, 96, 64),
      reactions: groupReactions(a.reactions.map((r) => ({ emoji: r.emoji, employeeId: r.employeeId, name: r.employee.name, count: r.count })), session.employeeId),
      commentCount: cmtMap.get(a.id)?.count ?? 0,
      topComment: cmtMap.get(a.id)?.top ?? null,
    };
  });

  // "Của tôi tuần này" (thẻ profile kiểu Strava) — cột phải feed. Tuần theo giờ VN (Thứ Hai 00:00).
  const ws = weekStartVN(new Date());
  const [meEmp, myWeekActs, myGaveWeek, myRecentRows, finRows] = await Promise.all([
    prisma.employee.findUnique({ where: { id: session.employeeId }, select: { name: true, avatarUrl: true } }),
    prisma.activity.findMany({ where: { employeeId: session.employeeId, startDate: { gte: ws } }, select: { distanceKm: true, amountVnd: true } }),
    prisma.thanksGift.count({ where: { senderId: session.employeeId, createdAt: { gte: ws } } }),
    prisma.activity.findMany({ where: { employeeId: session.employeeId }, orderBy: { startDate: "desc" }, take: 3, select: { id: true, name: true, type: true, kindKey: true, source: true, distanceKm: true, startDate: true } }),
    prisma.activity.findMany({ where: { startDate: { gte: today }, employeeId: { not: session.employeeId } }, orderBy: { startDate: "desc" }, select: { employeeId: true, employee: { select: { name: true, avatarUrl: true } } } }),
  ]);
  let myKm = 0, myVnd = 0;
  for (const a of myWeekActs) { myKm += a.distanceKm; myVnd += a.amountVnd; }
  const myRings = computeRings({ kmThisWeek: myKm, gaveThisWeek: myGaveWeek > 0 });
  const myRecent = myRecentRows.map((a) => {
    const sk: SportKey = SPORT_ORDER.includes(a.type as SportKey) ? (a.type as SportKey) : "Other";
    const mk = a.source === "manual" && a.kindKey ? kindMap[a.kindKey] : undefined;
    return { id: a.id, name: a.name || mk?.nameVi || SPORTS[sk].vi, icon: mk?.icon ?? SPORTS[sk].icon, km: a.distanceKm, dateISO: a.startDate.toISOString() };
  });
  const mine = {
    name: meEmp?.name ?? "Tôi", avatarUrl: meEmp?.avatarUrl ?? null,
    weekKm: Math.round(myKm * 10) / 10, weekVnd: myVnd, weekCount: myWeekActs.length,
    movePct: myRings.move.pct, moveKmLeft: myRings.move.kmLeft, recent: myRecent,
  };
  // Đồng đội "vừa xong" hôm nay (trừ mình) — cho dòng cổ vũ dưới thẻ.
  const cheerMap = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  for (const f of finRows) if (!cheerMap.has(f.employeeId)) cheerMap.set(f.employeeId, { id: f.employeeId, name: f.employee.name, avatarUrl: f.employee.avatarUrl });
  const cheer = { count: cheerMap.size, people: [...cheerMap.values()].slice(0, 4) };

  // 7 ngày qua.
  const weekActs = await prisma.activity.findMany({
    where: { startDate: { gte: day7, lt: tomorrow } },
    select: { amountVnd: true, distanceKm: true, employeeId: true, startDate: true, type: true },
  });
  const daily = new Array(7).fill(0);
  const dayLabels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(day7);
    d.setDate(d.getDate() + i);
    dayLabels.push(WD[d.getDay()]);
  }
  let fundVnd = 0;
  let km = 0;
  const people = new Set<string>();
  const sportFund: Record<string, number> = {};
  for (const a of weekActs) {
    const idx = Math.floor((startOfDay(a.startDate).getTime() - day7.getTime()) / 86400000);
    if (idx >= 0 && idx < 7) daily[idx] += a.amountVnd;
    fundVnd += a.amountVnd;
    km += a.distanceKm;
    people.add(a.employeeId);
    const k = SPORT_ORDER.includes(a.type as SportKey) ? a.type : "Other";
    sportFund[k] = (sportFund[k] ?? 0) + a.amountVnd;
  }

  const prevAgg = await prisma.activity.aggregate({
    _sum: { amountVnd: true },
    where: { startDate: { gte: prev7, lt: day7 } },
  });
  const prevFund = prevAgg._sum.amountVnd ?? 0;
  const trendPct = prevFund > 0 ? Math.round(((fundVnd - prevFund) / prevFund) * 100) : fundVnd > 0 ? 100 : 0;

  const totalPeople = await prisma.employee.count();
  const topKey = Object.keys(sportFund).sort((a, b) => sportFund[b] - sportFund[a])[0] as SportKey | undefined;
  const topSport = topKey ? { vi: SPORTS[topKey].vi, icon: SPORTS[topKey].icon } : null;

  return NextResponse.json({
    feed,
    mine,
    cheer,
    week: {
      fundVnd,
      trendPct,
      daily,
      dayLabels,
      activities: weekActs.length,
      km,
      peopleMoved: people.size,
      totalPeople,
      topSport,
    },
  });
}
