import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { badgeMetrics, computeBadgeStates, BadgeMetrics } from "@/lib/badges";
import { computeAllowance } from "@/lib/withanks";
import {
  computeXp, levelFromXp, computeRings, computeWeekStreak, titleStates,
  weekStart, weekKey, dateKeyVN, isThisWeekAnnual, isSameMonthDay, yearsSince,
} from "@/lib/wicer";

export const dynamic = "force-dynamic";

const dayStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Phần dữ liệu TOÀN CÔNG TY của Wicer Home (phân bố huy hiệu + nhịp công ty + vinh danh tuần):
// giống hệt nhau cho mọi người, nhưng trước đây tính lại cho TỪNG lượt vào của TỪNG user
// (nạp toàn bộ hoạt động của mọi người mỗi lần → rất nặng). Nay cache 60s, dùng chung.
type OrgHome = {
  distribution: BadgeMetrics[];
  totalPeople: number;
  pulse: {
    birthdaysWeek: { id: string; name: string; avatarUrl: string | null }[];
    annivWeek: { id: string; name: string; avatarUrl: string | null; years: number }[];
    newMembers: { id: string; name: string; avatarUrl: string | null; team: string }[];
    activeToday: { id: string; name: string; avatarUrl: string | null }[];
  };
  honor: {
    topThanks: { name: string; total: number } | null;
    topMove: { name: string; km: number } | null;
  };
};

const getOrgHome = unstable_cache(async (): Promise<OrgHome> => {
  const now = new Date();
  const ws = weekStart(now);
  const today0 = dayStart(now);

  // Phân bố huy hiệu toàn công ty (để tính thứ hạng phần trăm của tôi).
  const allActs = await prisma.activity.findMany({ select: { employeeId: true, distanceKm: true, startDate: true, type: true, amountVnd: true } });
  const byEmp = new Map<string, { distanceKm: number; startDate: Date; type: string; amountVnd: number }[]>();
  for (const a of allActs) {
    const arr = byEmp.get(a.employeeId) ?? [];
    arr.push(a);
    byEmp.set(a.employeeId, arr);
  }
  const distribution = [...byEmp.values()].map(badgeMetrics);
  const totalPeople = await prisma.employee.count();

  // Nhịp công ty.
  const everyone = await prisma.employee.findMany({
    select: { id: true, name: true, avatarUrl: true, team: true, birthday: true, joinedAt: true, createdAt: true },
  });
  const birthdaysWeek = everyone.filter((e) => e.birthday && isThisWeekAnnual(e.birthday, now))
    .map((e) => ({ id: e.id, name: e.name, avatarUrl: e.avatarUrl }));
  const annivWeek = everyone.filter((e) => isThisWeekAnnual(e.joinedAt ?? e.createdAt, now) && yearsSince(e.joinedAt ?? e.createdAt, now) >= 1)
    .map((e) => ({ id: e.id, name: e.name, avatarUrl: e.avatarUrl, years: yearsSince(e.joinedAt ?? e.createdAt, now) }));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const newMembers = everyone.filter((e) => (e.joinedAt ?? e.createdAt) >= thirtyDaysAgo)
    .map((e) => ({ id: e.id, name: e.name, avatarUrl: e.avatarUrl, team: e.team ?? "Wicom" }));

  const movedTodayRows = await prisma.activity.findMany({ where: { startDate: { gte: today0 } }, select: { employeeId: true } });
  const movedTodayIds = new Set(movedTodayRows.map((r) => r.employeeId));
  const activeToday = everyone.filter((e) => movedTodayIds.has(e.id)).map((e) => ({ id: e.id, name: e.name, avatarUrl: e.avatarUrl }));

  // Vinh danh tuần: được cảm ơn nhất (loại khoai admin tặng) + quán quân Move tuần.
  const thanksWeek = await prisma.thanksGift.findMany({
    where: { createdAt: { gte: ws } },
    include: { sender: { select: { isAdmin: true } }, receiver: { select: { name: true } } },
  });
  const recvMap = new Map<string, { name: string; total: number }>();
  for (const t of thanksWeek) {
    if (t.sender.isAdmin) continue;
    const cur = recvMap.get(t.receiverId) ?? { name: t.receiver.name, total: 0 };
    cur.total += t.khoai;
    recvMap.set(t.receiverId, cur);
  }
  const topThanks = [...recvMap.values()].sort((a, b) => b.total - a.total)[0] ?? null;

  const moveWeekRows = await prisma.activity.findMany({ where: { startDate: { gte: ws } }, select: { employeeId: true, distanceKm: true } });
  const moveMap = new Map<string, number>();
  for (const r of moveWeekRows) moveMap.set(r.employeeId, (moveMap.get(r.employeeId) ?? 0) + r.distanceKm);
  const topMoveId = [...moveMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMove = topMoveId ? { name: everyone.find((e) => e.id === topMoveId)?.name ?? "—", km: Math.round(moveMap.get(topMoveId) ?? 0) } : null;

  return {
    distribution,
    totalPeople,
    pulse: { birthdaysWeek, annivWeek, newMembers, activeToday },
    honor: { topThanks: topThanks ? { name: topThanks.name, total: topThanks.total } : null, topMove },
  };
}, ["wicer-home-org-v1"], { revalidate: 60, tags: ["home"] });

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const emp = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  if (!emp) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const now = new Date();
  const ws = weekStart(now);
  const today0 = dayStart(now);

  // ── Hoạt động của tôi ──
  const myActs = await prisma.activity.findMany({
    where: { employeeId: emp.id },
    select: { distanceKm: true, startDate: true, type: true, amountVnd: true },
    orderBy: { startDate: "desc" },
  });
  let totalVnd = 0, totalKm = 0, kmThisWeek = 0, kmSeason = 0;
  let movedToday = false;
  const activeWeeks = new Set<string>();
  const seasonStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); // đầu quý
  for (const a of myActs) {
    totalVnd += a.amountVnd;
    totalKm += a.distanceKm;
    activeWeeks.add(weekKey(a.startDate));
    if (a.startDate >= ws) kmThisWeek += a.distanceKm;
    if (a.startDate >= seasonStart) kmSeason += a.distanceKm;
    if (a.startDate >= today0) movedToday = true;
  }

  // ── Khoai (tặng/nhận) ──
  const [sentAgg, recvAgg, sentWeek, sentToday, thanksReceived] = await Promise.all([
    prisma.thanksGift.aggregate({ _sum: { khoai: true }, _count: true, where: { senderId: emp.id } }),
    prisma.thanksGift.aggregate({ _sum: { khoai: true }, where: { receiverId: emp.id } }),
    prisma.thanksGift.count({ where: { senderId: emp.id, createdAt: { gte: ws } } }),
    prisma.thanksGift.count({ where: { senderId: emp.id, createdAt: { gte: today0 } } }),
    prisma.thanksGift.findMany({
      where: { receiverId: emp.id, createdAt: { gte: today0 } },
      orderBy: { createdAt: "desc" },
      include: { sender: { select: { name: true, avatarUrl: true } } },
    }),
  ]);
  const khoaiSent = sentAgg._sum.khoai ?? 0;
  const khoaiReceived = recvAgg._sum.khoai ?? 0;
  // tuần có tặng khoai cũng tính là "năng động"
  const myThanksWeeks = await prisma.thanksGift.findMany({ where: { senderId: emp.id }, select: { createdAt: true } });
  for (const t of myThanksWeeks) activeWeeks.add(weekKey(t.createdAt));

  const streakWeeks = computeWeekStreak(activeWeeks);
  const gaveThisWeek = sentWeek > 0;
  const rings = computeRings({ kmThisWeek, gaveThisWeek });

  // ── Huy hiệu — phân bố toàn công ty lấy từ cache dùng chung (60s) ──
  const org = await getOrgHome();
  const myMetrics = badgeMetrics(myActs);
  const badges = computeBadgeStates(myMetrics, org.distribution, org.totalPeople);
  const badgeTiers = badges.reduce((n, b) => n + b.tier, 0);

  // ── Level / XP ──
  const xp = computeXp({ activityCount: myActs.length, khoaiSent, khoaiReceived, badgeTiers, ringWeeks: streakWeeks });
  const level = levelFromXp(xp);

  // ── Wicer Card: bộ sưu tập + lá hôm nay ──
  const todayKey = dateKeyVN(now);
  const [deckCount, myDraws, todayDraw] = await Promise.all([
    prisma.wicerCard.count({ where: { active: true } }),
    prisma.cardDraw.findMany({ where: { employeeId: emp.id }, orderBy: { drawnAt: "desc" }, take: 6 }),
    prisma.cardDraw.findUnique({ where: { employeeId_dateKey: { employeeId: emp.id, dateKey: todayKey } } }),
  ]);
  const distinctCards = new Set((await prisma.cardDraw.findMany({ where: { employeeId: emp.id }, select: { cardId: true } })).map((d) => d.cardId)).size;

  // ── Kỷ niệm / sinh nhật của tôi hôm nay ──
  const joined = emp.joinedAt ?? emp.createdAt;
  const anniversaryToday = isSameMonthDay(joined, now) && yearsSince(joined, now) >= 1;
  const birthdayToday = emp.birthday ? isSameMonthDay(emp.birthday, now) : false;

  // ── Nudges ──
  const [allowance, pendingRedemptions, activeGoals] = await Promise.all([
    computeAllowance({ id: emp.id, wiRole: emp.wiRole, isAdmin: emp.isAdmin }),
    prisma.redemption.count({ where: { employeeId: emp.id, status: "pending" } }),
    prisma.goal.count({ where: { employeeId: emp.id, active: true } }),
  ]);

  // Nhịp công ty + vinh danh tuần lấy từ org (cache dùng chung).
  return NextResponse.json({
    me: {
      name: emp.name,
      team: emp.team ?? "Wicom",
      avatarUrl: emp.avatarUrl,
      level: { key: level.current.key, name: level.current.name, icon: level.current.icon, color: level.current.color,
        xp: level.xp, pct: level.pct, next: level.next ? { name: level.next.name, icon: level.next.icon, minXp: level.next.minXp } : null },
      rings,
      streakWeeks,
      totalVnd,
      totalKm: Math.round(totalKm),
      kmSeason: Math.round(kmSeason),
      khoaiBalance: emp.khoaiBalance,
      titles: titleStates(emp.athleticTitles),
      badges,
      collection: { count: distinctCards, total: deckCount, recent: myDraws.map((d) => ({ emoji: d.emoji, rarity: d.rarity, category: d.category })) },
    },
    today: {
      newThanks: thanksReceived.map((t) => ({
        id: t.id, khoai: t.khoai, message: t.message,
        giver: t.anonymous ? "Ẩn danh" : t.sender.name,
        avatarUrl: t.anonymous ? null : t.sender.avatarUrl,
      })),
      celebrate: {
        anniversary: anniversaryToday ? yearsSince(joined, now) : null,
        birthday: birthdayToday,
      },
      card: todayDraw
        ? { drawn: true, emoji: todayDraw.emoji, message: todayDraw.message, category: todayDraw.category, rarity: todayDraw.rarity, rewardKhoai: todayDraw.rewardKhoai }
        : { drawn: false },
    },
    ritual: { thankedToday: sentToday > 0, movedToday, ideaToday: false },
    nudges: {
      givingRemaining: allowance.unlimited ? null : allowance.canGiveNow,
      givingResetsWeekly: !allowance.unlimited && allowance.weekLimit != null,
      pendingRedemptions,
      activeGoals,
    },
    pulse: {
      birthdaysWeek: org.pulse.birthdaysWeek,
      annivWeek: org.pulse.annivWeek,
      newMembers: org.pulse.newMembers,
      activeToday: org.pulse.activeToday,
      honor: {
        topThanks: org.honor.topThanks,
        topMove: org.honor.topMove,
        idea: null, // WiGrow — sắp ra mắt
      },
    },
  });
}
