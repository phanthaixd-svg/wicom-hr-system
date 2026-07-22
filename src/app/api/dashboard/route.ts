import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SPORT_ORDER, SPORTS, SportKey } from "@/lib/sports";
import { getKindMap } from "@/lib/kinds";
import { dayStartVN } from "@/lib/wicer";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const dynamic = "force-dynamic";

interface SportAgg {
  km: number;
  count: number;
  vnd: number;
}
interface EmpAgg {
  id: string;
  name: string;
  team: string | null;
  avatarUrl: string | null;
  isMe: boolean;
  totalVnd: number;
  totalKm: number;
  activities: number;
  bySport: Record<string, SportAgg>;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const meOnly = url.searchParams.get("me") === "1"; // lọc "Chỉ tôi"

  // Bảng tổng (mọi người) giống hệt nhau cho tất cả user trong cùng khoảng ngày → cache 60s,
  // 25 người vào cùng lúc chỉ tính 1 lần thay vì 25 lần. Chế độ "Chỉ tôi" là dữ liệu riêng nên không cache.
  const data = meOnly
    ? await computeDashboard(from, to, session.employeeId)
    : await computeDashboardCached(from, to);

  // Gắn phần "của tôi" (rẻ, theo phiên) sau khi lấy phần tổng.
  for (const e of data.byEmployee) e.isMe = e.id === session.employeeId;
  const meEmp = await prisma.employee.findUnique({ where: { id: session.employeeId }, select: { name: true, avatarUrl: true } });

  return NextResponse.json({
    ...data,
    meOnly,
    me: { id: session.employeeId, name: meEmp?.name ?? "Tôi", avatarUrl: meEmp?.avatarUrl ?? null },
    meId: session.employeeId,
  });
}

// Bản cache cho chế độ "mọi người" (không phụ thuộc phiên), khoá theo khoảng ngày.
const computeDashboardCached = unstable_cache(
  (from: string, to: string) => computeDashboard(from, to, null),
  ["dashboard-org-v1"],
  { revalidate: 60, tags: ["dashboard"] }
);

// Tính toàn bộ số liệu bảng tổng. meId != null → chỉ tính cho 1 người ("Chỉ tôi"). Trả về JSON-safe.
async function computeDashboard(from: string, to: string, meId: string | null) {
  const meFilter = meId ? { employeeId: meId } : {};
  const fromDate = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const toDate = to ? new Date(`${to}T23:59:59`) : new Date();

  // Kỳ TRƯỚC (cùng độ dài, ngay liền trước) -> để tính thay đổi thứ hạng ▲/▼.
  const rangeMs = Math.max(0, toDate.getTime() - fromDate.getTime());
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - rangeMs);
  const now = new Date();
  const today0 = dayStartVN(now);

  // Tất cả truy vấn độc lập chạy SONG SONG (giảm số vòng round-trip tới DB trên serverless).
  const [activities, prevActivities, campaign, running, todayActs, totalPeopleCount, kindMap] = await Promise.all([
    prisma.activity.findMany({
      where: { startDate: { gte: fromDate, lte: toDate }, ...meFilter },
      include: { employee: { select: { id: true, name: true, team: true, avatarUrl: true } } },
    }),
    prisma.activity.findMany({
      where: { startDate: { gte: prevFrom, lte: prevTo }, ...meFilter },
      include: { employee: { select: { team: true } } },
    }),
    prisma.campaign.findFirst({ where: { active: true }, orderBy: { startDate: "desc" } }),
    prisma.campaign.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } }, orderBy: { startDate: "desc" } }),
    prisma.activity.findMany({ where: { startDate: { gte: today0 } }, select: { amountVnd: true, employeeId: true } }),
    prisma.employee.count({ where: { leftAt: null } }),
    getKindMap(),
  ]);
  interface PrevAgg { id: string; team: string | null; totalVnd: number; totalKm: number; activities: number; bySport: Record<string, SportAgg>; }
  const prevMap = new Map<string, PrevAgg>();
  for (const a of prevActivities) {
    const key = SPORT_ORDER.includes(a.type as SportKey) ? a.type : "Other";
    let e = prevMap.get(a.employeeId);
    if (!e) {
      e = { id: a.employeeId, team: a.employee.team, totalVnd: 0, totalKm: 0, activities: 0, bySport: {} };
      for (const k of SPORT_ORDER) e.bySport[k] = { km: 0, count: 0, vnd: 0 };
      prevMap.set(a.employeeId, e);
    }
    e.totalVnd += a.amountVnd;
    e.totalKm += a.distanceKm;
    e.activities += 1;
    e.bySport[key].km += a.distanceKm;
    e.bySport[key].count += 1;
    e.bySport[key].vnd += a.amountVnd;
  }
  const prevByEmployee = [...prevMap.values()];

  const byEmp = new Map<string, EmpAgg>();
  let totalVnd = 0;
  let totalKm = 0;
  const sportTotals: Record<string, SportAgg> = {};
  for (const k of SPORT_ORDER) sportTotals[k] = { km: 0, count: 0, vnd: 0 };

  for (const a of activities) {
    const key = SPORT_ORDER.includes(a.type as SportKey) ? a.type : "Other";
    let e = byEmp.get(a.employeeId);
    if (!e) {
      e = {
        id: a.employeeId,
        name: a.employee.name,
        team: a.employee.team,
        avatarUrl: a.employee.avatarUrl,
        isMe: false, // gắn theo phiên ở GET (sau khi lấy từ cache)
        totalVnd: 0,
        totalKm: 0,
        activities: 0,
        bySport: {},
      };
      for (const k of SPORT_ORDER) e.bySport[k] = { km: 0, count: 0, vnd: 0 };
      byEmp.set(a.employeeId, e);
    }
    e.totalVnd += a.amountVnd;
    e.totalKm += a.distanceKm;
    e.activities += 1;
    e.bySport[key].km += a.distanceKm;
    e.bySport[key].count += 1;
    e.bySport[key].vnd += a.amountVnd;

    totalVnd += a.amountVnd;
    totalKm += a.distanceKm;
    sportTotals[key].km += a.distanceKm;
    sportTotals[key].count += 1;
    sportTotals[key].vnd += a.amountVnd;
  }

  // Quỹ của CẢ KỲ chiến dịch đang chạy (dùng cho % tiến trình — ổn định, KHÔNG theo filter).
  let campaignFundVnd = 0;
  if (running) {
    const agg = await prisma.activity.aggregate({
      _sum: { amountVnd: true },
      where: { startDate: { gte: running.startDate, lte: running.endDate } },
    });
    campaignFundVnd = agg._sum.amountVnd ?? 0;
  }

  // Quỹ HÔM NAY + số người góp hôm nay (cho nhiệt kế "hôm nay +X").
  let todayVnd = 0;
  const todayPeople = new Set<string>();
  for (const a of todayActs) { todayVnd += a.amountVnd; todayPeople.add(a.employeeId); }

  // Biểu đồ quỹ theo thời gian (bucket ~10 mốc, tự co theo khoảng lọc).
  const sodMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const f0 = sodMs(fromDate), t0 = sodMs(toDate);
  const totalDays = Math.max(1, Math.round((t0 - f0) / 86400000) + 1);
  const nBuckets = totalDays <= 12 ? totalDays : 10;
  const bucketDays = Math.ceil(totalDays / nBuckets);
  const dailyFund: { label: string; vnd: number }[] = [];
  for (let i = 0; i < nBuckets; i++) {
    const s = new Date(f0 + i * bucketDays * 86400000);
    if (sodMs(s) > t0) break;
    dailyFund.push({ label: `${s.getDate()}/${s.getMonth() + 1}`, vnd: 0 });
  }
  for (const a of activities) {
    const idx = Math.floor((sodMs(a.startDate) - f0) / 86400000 / bucketDays);
    if (idx >= 0 && idx < dailyFund.length) dailyFund[idx].vnd += a.amountVnd;
  }

  // KPI theo môn cho cột phải: Bơi km · Đạp km · Chạy km · Buổi Cầu lông · Buổi Khác. (kindMap đã nạp song song ở trên)
  const isCauLong = (kindKey: string | null, source: string) =>
    source === "manual" && !!kindKey && (kindKey === "cau-long" || norm(kindMap[kindKey]?.nameVi ?? "").includes("cau long"));
  let sessCauLong = 0, sessOther = 0;
  for (const a of activities) {
    const t = SPORT_ORDER.includes(a.type as SportKey) ? a.type : "Other";
    if (isCauLong(a.kindKey, a.source)) sessCauLong++;
    else if (t !== "Run" && t !== "Ride" && t !== "Swim") sessOther++;
  }
  const kpi = {
    swimKm: sportTotals.Swim.km, rideKm: sportTotals.Ride.km, runKm: sportTotals.Run.km,
    cauLong: sessCauLong, other: sessOther,
  };

  return {
    today: { vnd: todayVnd, people: todayPeople.size, totalPeople: totalPeopleCount },
    dailyFund,
    kpi,
    goalVnd: campaign ? Number(campaign.goalVnd) : 0,
    campaignName: campaign?.name ?? "Chiến dịch gây quỹ",
    campaignDesc: campaign?.description ?? "",
    campaignStart: campaign ? campaign.startDate.toISOString().slice(0, 10) : "",
    campaignEnd: campaign ? campaign.endDate.toISOString().slice(0, 10) : "",
    runningCampaign: running
      ? {
          name: running.name,
          description: running.description ?? "",
          goalVnd: Number(running.goalVnd),
          fundVnd: campaignFundVnd, // quỹ cả kỳ, cho % tiến trình
        }
      : null,
    totals: {
      vnd: totalVnd,
      km: totalKm,
      activities: activities.length,
      participants: byEmp.size,
    },
    sportTotals,
    sports: SPORT_ORDER.map((k) => ({ key: k, vi: SPORTS[k].vi, icon: SPORTS[k].icon, color: SPORTS[k].color })),
    byEmployee: Array.from(byEmp.values()),
    prevByEmployee,
  };
}
