import { prisma } from "./db";
import { SPORTS, SportKey } from "./sports";

export interface RuleLite {
  activityType: string;
  mode: string;
  rateVnd: number;
  capPerDayVnd: number | null;
  active: boolean;
}

// Lấy bảng rule hiện hành (map theo activityType). Nếu DB chưa có, dùng mặc định của SPORTS.
export async function getRules(): Promise<Record<string, RuleLite>> {
  const rows = await prisma.conversionRule.findMany({ where: { active: true } });
  const map: Record<string, RuleLite> = {};
  for (const r of rows) {
    map[r.activityType] = {
      activityType: r.activityType,
      mode: r.mode,
      rateVnd: r.rateVnd,
      capPerDayVnd: r.capPerDayVnd,
      active: r.active,
    };
  }
  // fallback cho môn chưa có rule
  for (const key of Object.keys(SPORTS) as SportKey[]) {
    if (!map[key]) {
      map[key] = {
        activityType: key,
        mode: SPORTS[key].defaultMode,
        rateVnd: SPORTS[key].defaultRateVnd,
        capPerDayVnd: null,
        active: true,
      };
    }
  }
  return map;
}

export interface ConversionContext {
  rules: Record<string, RuleLite>;
  conversionFromDate: Date | null;
}

// Mốc bắt đầu quy đổi tiền của hệ thống (cài đặt chung).
// Ưu tiên Setting["conversionFromDate"], fallback biến môi trường CONVERSION_FROM_DATE.
export async function getConversionFromDate(): Promise<Date | null> {
  const s = await prisma.setting.findUnique({ where: { key: "conversionFromDate" } });
  if (s?.value) return new Date(s.value);
  if (process.env.CONVERSION_FROM_DATE) return new Date(process.env.CONVERSION_FROM_DATE);
  return null;
}

// Nạp toàn bộ ngữ cảnh quy đổi (rule + mốc bắt đầu tính tiền) một lần.
export async function getConversionContext(): Promise<ConversionContext> {
  const [rules, conversionFromDate] = await Promise.all([getRules(), getConversionFromDate()]);
  return { rules, conversionFromDate };
}

// Quy đổi 1 hoạt động ra tiền (chưa áp trần theo ngày — trần được tính khi tổng hợp).
export function computeAmount(
  rule: RuleLite | undefined,
  distanceKm: number,
  isFlagged: boolean,
): number {
  if (isFlagged || !rule) return 0;
  if (rule.mode === "km") return Math.round(distanceKm * rule.rateVnd);
  if (rule.mode === "activity") return rule.rateVnd;
  return 0;
}
