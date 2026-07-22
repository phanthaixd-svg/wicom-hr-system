import { prisma } from "./db";
import { computeAmount, getConversionContext, type ConversionContext } from "./conversion";
import { detectSpeedAnomaly, normalizeSportType } from "./sports";
import type { StravaActivity } from "./strava";

// Chuẩn hoá 1 StravaActivity -> lưu/ cập nhật vào DB kèm quy đổi tiền.
// Dùng chung cho webhook (create/update) và cron backfill.
// ctx (rule + mốc quy đổi) có thể truyền vào để tránh truy vấn lặp khi backfill hàng loạt.
export interface UpsertResult {
  id: string;
  name: string;
  type: string;
  distanceKm: number;
  amountVnd: number;
  isNew: boolean; // true nếu đây là hoạt động lần đầu ghi nhận (không phải update) → dùng để bắn notify.
}

export async function upsertActivity(
  employeeId: string,
  a: StravaActivity,
  ctx?: ConversionContext,
): Promise<UpsertResult> {
  const { rules, conversionFromDate } = ctx ?? (await getConversionContext());

  const sport = normalizeSportType(a.sport_type || a.type || "");
  const distanceKm = (a.distance || 0) / 1000;
  const movingTimeS = a.moving_time || 0;
  const startDate = new Date(a.start_date);

  const speedFlag = detectSpeedAnomaly(sport, distanceKm, movingTimeS);
  const isFlagged = Boolean(a.manual) || Boolean(speedFlag);
  const flagReason = a.manual ? "Hoạt động nhập tay" : speedFlag ?? null;

  // Trước mốc quy đổi -> tiền = 0 (nhưng vẫn lưu km/thời gian để hiện leaderboard).
  const beforeCutoff = conversionFromDate ? startDate < conversionFromDate : false;
  const amountVnd = beforeCutoff ? 0 : computeAmount(rules[sport], distanceKm, isFlagged);

  const data = {
    employeeId,
    name: a.name || null,
    type: sport,
    rawType: a.sport_type || a.type || null,
    distanceKm,
    movingTimeS,
    startDate,
    isManual: Boolean(a.manual),
    isFlagged,
    flagReason,
    amountVnd,
    mapPolyline: a.map?.summary_polyline || a.map?.polyline || null,
  };

  const existing = await prisma.activity.findUnique({
    where: { stravaId: String(a.id) },
    select: { id: true },
  });
  const saved = await prisma.activity.upsert({
    where: { stravaId: String(a.id) },
    create: { stravaId: String(a.id), ...data },
    update: data,
  });
  return {
    id: saved.id,
    name: saved.name ?? "",
    type: saved.type,
    distanceKm: saved.distanceKm,
    amountVnd: saved.amountVnd,
    isNew: !existing,
  };
}

// Xoá hoạt động khi Strava gửi event delete -> quỹ tự giảm theo.
// PHẢI truyền employeeId của chủ tài khoản để chỉ xoá đúng hoạt động của người đó
// (chặn webhook giả mạo xoá hoạt động của người khác).
export async function deleteActivity(stravaId: string, employeeId: string): Promise<void> {
  await prisma.activity.deleteMany({ where: { stravaId, employeeId } });
}
