// Hệ thống Huy hiệu có HẠNG (Đồng/Bạc/Vàng) + tiến độ tới mốc kế + độ hiếm toàn công ty.
// Mục tiêu tạo động lực: 1) goal-gradient (thanh tiến độ tới hạng kế), 2) tiered progression
// (leo hạng dài hạn), 3) scarcity ("Top X% đạt được" tạo cảm giác quý hiếm).

export interface BadgeMetrics {
  streak: number;
  early: number;
  km: number;
  hikes: number;
  vnd: number;
  count: number;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function computeStreak(days: Set<string>): number {
  const cur = new Date();
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export function badgeMetrics(
  acts: { distanceKm: number; startDate: Date; type: string; amountVnd: number }[],
): BadgeMetrics {
  let km = 0;
  let vnd = 0;
  let early = 0;
  let hikes = 0;
  const days = new Set<string>();
  for (const a of acts) {
    km += a.distanceKm;
    vnd += a.amountVnd;
    days.add(dayKey(a.startDate));
    if (a.startDate.getHours() < 7) early++;
    if (a.type === "Hike") hikes++;
  }
  return { streak: computeStreak(days), early, km, hikes, vnd, count: acts.length };
}

export const TIER_NAMES = ["Đồng", "Bạc", "Vàng"] as const;

interface BadgeDef {
  key: string;
  name: string;
  icon: string;
  unit: string;
  desc: string;
  metric: keyof BadgeMetrics;
  tiers: [number, number, number];
  money?: boolean;
}

export const BADGE_DEFS: BadgeDef[] = [
  { key: "streak", name: "Ngọn lửa bền bỉ", icon: "🔥", unit: "ngày", desc: "Chuỗi ngày vận động liên tiếp", metric: "streak", tiers: [7, 30, 100] },
  { key: "dawn", name: "Chiến binh bình minh", icon: "🌅", unit: "buổi", desc: "Buổi tập trước 7h sáng", metric: "early", tiers: [10, 30, 60] },
  { key: "iron_legs", name: "Đôi chân thép", icon: "⚡", unit: "km", desc: "Tổng quãng đường tích luỹ", metric: "km", tiers: [100, 500, 1000] },
  { key: "conqueror", name: "Kẻ chinh phục", icon: "🏔️", unit: "lần", desc: "Số lần chinh phục đỉnh núi", metric: "hikes", tiers: [1, 5, 15] },
  { key: "golden_heart", name: "Trái tim vàng", icon: "💛", unit: "đ", desc: "Quỹ thiện nguyện đã đóng góp", metric: "vnd", tiers: [1_000_000, 5_000_000, 10_000_000], money: true },
  { key: "relentless", name: "Không ngừng nghỉ", icon: "🏅", unit: "hoạt động", desc: "Tổng số hoạt động đã ghi nhận", metric: "count", tiers: [10, 50, 200] },
];

export interface BadgeState {
  key: string;
  name: string;
  icon: string;
  unit: string;
  desc: string;
  money: boolean;
  value: number;
  tier: number; // 0 = chưa mở, 1..3
  tierName: string | null;
  nextThreshold: number | null;
  prevThreshold: number;
  pct: number; // tiến độ trong đoạn hạng hiện tại (0..100)
  unlocked: boolean;
  rarityPct: number; // % nhân sự toàn công ty đã mở (đạt hạng Đồng trở lên)
  tiers: [number, number, number];
}

export function computeBadgeStates(my: BadgeMetrics, all: BadgeMetrics[], totalPeople: number): BadgeState[] {
  const denom = Math.max(1, totalPeople);
  return BADGE_DEFS.map((def) => {
    const value = my[def.metric];
    let tier = 0;
    for (const t of def.tiers) if (value >= t) tier++;
    const nextThreshold = tier < 3 ? def.tiers[tier] : null;
    const prevThreshold = tier > 0 ? def.tiers[tier - 1] : 0;
    const pct = nextThreshold
      ? Math.min(100, Math.max(0, Math.round(((value - prevThreshold) / (nextThreshold - prevThreshold)) * 100)))
      : 100;
    const unlockedCount = all.filter((m) => m[def.metric] >= def.tiers[0]).length;
    return {
      key: def.key,
      name: def.name,
      icon: def.icon,
      unit: def.unit,
      desc: def.desc,
      money: Boolean(def.money),
      value,
      tier,
      tierName: tier > 0 ? TIER_NAMES[tier - 1] : null,
      nextThreshold,
      prevThreshold,
      pct,
      unlocked: tier >= 1,
      rarityPct: Math.round((unlockedCount / denom) * 100),
      tiers: def.tiers,
    };
  });
}
