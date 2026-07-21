import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getValidAccessToken } from "@/lib/strava";
import { getRules } from "@/lib/conversion";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";
import { groupReactions } from "@/lib/reactions";
import { getKindMap } from "@/lib/kinds";

export const dynamic = "force-dynamic";

// Giải mã Google encoded polyline -> mảng [lat, lng].
function decodePolyline(str: string): number[][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coords: number[][] = [];
  while (index < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

// Giảm mẫu chuỗi số về ~n điểm bằng trung bình từng khối (cho biểu đồ mượt, payload nhỏ).
function downsample(arr: number[] | null | undefined, n = 120): number[] | null {
  if (!arr || arr.length === 0) return null;
  if (arr.length <= n) return arr.map((x) => Math.round(x * 10) / 10);
  const out: number[] = [];
  const size = arr.length / n;
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i * size);
    const e = Math.floor((i + 1) * size);
    let sum = 0;
    for (let j = s; j < e; j++) sum += arr[j];
    out.push(Math.round((sum / (e - s)) * 10) / 10);
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const act = await prisma.activity.findUnique({
    where: { id },
    include: { employee: { include: { stravaAccount: true } } },
  });
  if (!act) return NextResponse.json({ error: "notfound" }, { status: 404 });
  // Nội bộ minh bạch: mọi nhân sự đã đăng nhập đều xem được chi tiết đầy đủ.

  // Helper gom reaction (dùng chung cho cả nhánh manual lẫn strava).
  const loadReactions = async () => {
    const rows = await prisma.reaction.findMany({
      where: { activityId: id },
      include: { employee: { select: { name: true } } },
    });
    return groupReactions(
      rows.map((r) => ({ emoji: r.emoji, employeeId: r.employeeId, name: r.employee.name, count: r.count })),
      session.employeeId,
    );
  };

  // Hoạt động gửi tay: không có dữ liệu Strava -> dựng chi tiết từ DB + kind.
  if (act.source === "manual") {
    const kindMap = await getKindMap();
    const kind = act.kindKey ? kindMap[act.kindKey] : undefined;
    const rejected = Boolean(act.rejectedAt);
    return NextResponse.json({
      name: act.name || kind?.nameVi || "Hoạt động",
      sportKey: "Other" as SportKey,
      icon: kind?.icon ?? "✨",
      sportVi: kind?.nameVi ?? "Khác",
      dateISO: act.startDate.toISOString(),
      pending: act.isFlagged && !rejected,
      rejected,
      rejectReason: act.rejectReason,
      manual: true,
      proofUrl: act.proofUrl,
      note: act.note,
      distanceKm: act.distanceKm,
      movingTimeS: act.movingTimeS,
      elapsedTimeS: act.movingTimeS,
      elevationGain: 0,
      hasHr: false,
      avgHr: null,
      maxHr: null,
      cadence: null,
      calories: null,
      avgWatts: null,
      kudos: 0,
      achievements: 0,
      amountVnd: act.amountVnd,
      rateLabel: kind ? (kind.mode === "km" ? `${kind.rateVnd.toLocaleString("vi-VN")}đ/km` : `${kind.rateVnd.toLocaleString("vi-VN")}đ/buổi`) : "",
      reactions: await loadReactions(),
      polyline: null,
      hrSeries: null,
      elevSeries: null,
      splits: [],
    });
  }

  const acc = act.employee.stravaAccount;
  if (!acc || acc.revokedAt) return NextResponse.json({ error: "no-strava" }, { status: 400 });

  let d: Record<string, unknown> = {};
  let hrSeries: number[] | null = null;
  let elevSeries: number[] | null = null;
  try {
    const token = await getValidAccessToken(acc);
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch(`https://www.strava.com/api/v3/activities/${act.stravaId}`, { headers });
    if (res.ok) d = await res.json();

    // Streams: nhịp tim + cao độ theo thời gian (để vẽ biểu đồ).
    const sres = await fetch(
      `https://www.strava.com/api/v3/activities/${act.stravaId}/streams?keys=heartrate,altitude&key_by_type=true`,
      { headers },
    );
    if (sres.ok) {
      const st = (await sres.json()) as Record<string, { data?: number[] }>;
      hrSeries = downsample(st.heartrate?.data);
      elevSeries = downsample(st.altitude?.data);
    }
  } catch {
    /* vẫn trả về dữ liệu cơ bản từ DB nếu Strava lỗi */
  }

  const reactions = await loadReactions();

  const sk: SportKey = SPORT_ORDER.includes(act.type as SportKey) ? (act.type as SportKey) : "Other";
  const rules = await getRules();
  const rule = rules[act.type];
  const map = d.map as { summary_polyline?: string } | undefined;
  const splitsRaw = d.splits_metric as
    | { distance: number; moving_time: number; elapsed_time: number; elevation_difference?: number }[]
    | undefined;

  return NextResponse.json({
    name: act.name || (d.name as string) || SPORTS[sk].vi,
    sportKey: sk,
    icon: SPORTS[sk].icon,
    sportVi: SPORTS[sk].vi,
    dateISO: act.startDate.toISOString(),
    pending: act.isFlagged,
    rejected: false,
    manual: false,
    proofUrl: null,
    note: null,
    distanceKm: act.distanceKm,
    movingTimeS: act.movingTimeS,
    elapsedTimeS: (d.elapsed_time as number) ?? act.movingTimeS,
    elevationGain: (d.total_elevation_gain as number) ?? 0,
    hasHr: Boolean(d.has_heartrate),
    avgHr: (d.average_heartrate as number) ?? null,
    maxHr: (d.max_heartrate as number) ?? null,
    cadence: (d.average_cadence as number) ?? null,
    calories: (d.calories as number) ?? null,
    avgWatts: (d.average_watts as number) ?? null,
    kudos: (d.kudos_count as number) ?? 0,
    achievements: (d.achievement_count as number) ?? 0,
    amountVnd: act.amountVnd,
    rateLabel: rule
      ? rule.mode === "km"
        ? `${rule.rateVnd.toLocaleString("vi-VN")}đ/km`
        : `${rule.rateVnd.toLocaleString("vi-VN")}đ/buổi`
      : "",
    reactions,
    polyline: map?.summary_polyline ? decodePolyline(map.summary_polyline) : null,
    hrSeries,
    elevSeries,
    splits: splitsRaw
      ? splitsRaw.map((s, i) => ({
          km: i + 1,
          meters: s.distance,
          timeS: s.moving_time || s.elapsed_time,
          elevDiff: s.elevation_difference ?? 0,
        }))
      : [],
  });
}
