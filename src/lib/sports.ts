// Danh mục môn thể thao chuẩn hoá + map từ sport_type của Strava.

export type SportKey = "Run" | "Ride" | "Walk" | "Swim" | "Hike" | "Yoga" | "Other";

export interface SportMeta {
  key: SportKey;
  vi: string;
  icon: string;
  color: string;
  defaultMode: "km" | "activity";
  defaultRateVnd: number;
}

export const SPORTS: Record<SportKey, SportMeta> = {
  Run:   { key: "Run",   vi: "Chạy",      icon: "🏃", color: "#33A3DC", defaultMode: "km",       defaultRateVnd: 5000 },
  Ride:  { key: "Ride",  vi: "Đạp",       icon: "🚴", color: "#1A4565", defaultMode: "km",       defaultRateVnd: 2000 },
  Walk:  { key: "Walk",  vi: "Đi bộ",     icon: "🚶", color: "#3f8f8f", defaultMode: "km",       defaultRateVnd: 3000 },
  Swim:  { key: "Swim",  vi: "Bơi",       icon: "🏊", color: "#2f80c2", defaultMode: "km",       defaultRateVnd: 12000 },
  Hike:  { key: "Hike",  vi: "Leo núi",   icon: "🥾", color: "#7a6f52", defaultMode: "km",       defaultRateVnd: 5000 },
  Yoga:  { key: "Yoga",  vi: "Yoga",      icon: "🧘", color: "#b06fb0", defaultMode: "activity", defaultRateVnd: 20000 },
  Other: { key: "Other", vi: "Khác",      icon: "✨", color: "#83919b", defaultMode: "activity", defaultRateVnd: 0 },
};

export const SPORT_ORDER: SportKey[] = ["Run", "Ride", "Walk", "Swim", "Hike", "Yoga", "Other"];

// Ngưỡng tốc độ hợp lý (km/h) để phát hiện dữ liệu bất thường -> gắn cờ nghi vấn.
const MAX_SPEED_KMH: Partial<Record<SportKey, number>> = {
  Run: 25,   // chạy > 25 km/h là bất thường
  Walk: 12,
  Ride: 80,
  Swim: 10,
  Hike: 12,
};

// Map sport_type gốc của Strava -> môn chuẩn hoá.
// Danh sách sport_type của Strava rất dài; ta gom về các nhóm chính.
export function normalizeSportType(stravaType: string): SportKey {
  const t = (stravaType || "").toLowerCase();
  if (t.includes("run")) return "Run";
  if (t.includes("ride") || t.includes("cycl") || t.includes("bike") || t.includes("ebike")) return "Ride";
  if (t.includes("walk")) return "Walk";
  if (t.includes("swim")) return "Swim";
  if (t.includes("hike")) return "Hike";
  if (t.includes("yoga") || t.includes("weight") || t.includes("workout") || t.includes("crossfit") || t.includes("gym")) return "Yoga";
  return "Other";
}

// Kiểm tra bất thường tốc độ. Trả về lý do flag hoặc null.
export function detectSpeedAnomaly(
  sport: SportKey,
  distanceKm: number,
  movingTimeS: number,
): string | null {
  const max = MAX_SPEED_KMH[sport];
  if (!max || distanceKm <= 0 || movingTimeS <= 0) return null;
  const speed = distanceKm / (movingTimeS / 3600);
  if (speed > max) {
    return `Tốc độ ${speed.toFixed(1)} km/h vượt ngưỡng ${max} km/h của môn ${SPORTS[sport].vi}`;
  }
  return null;
}
