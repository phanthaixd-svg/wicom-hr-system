// Wicer Experience — lõi tính toán cho Wicer Home:
// Level (trục A, XP) · Danh hiệu thể lực (trục B) · Vòng tròn tuần · Streak tuần.
// Toàn bộ hệ số/ngưỡng để ở đây để sau đưa lên Console quản trị chỉnh (bước 6).

// ───────────────────────── Level (Trục A — XP, ai cũng leo được) ─────────────────────────
export interface LevelDef {
  key: string;
  name: string;
  icon: string; // icon tượng trưng (tạm — hoàn thiện sau)
  color: string; // màu vòng cấp
  minXp: number;
}

export const LEVELS: LevelDef[] = [
  { key: "tanbinh", name: "Tân binh", icon: "🥚", color: "#9FB4C4", minXp: 0 },
  { key: "wicer", name: "Wicer", icon: "🌱", color: "#18E4A2", minXp: 150 },
  { key: "daisu", name: "Đại sứ Văn Hoá", icon: "🏛️", color: "#E0A915", minXp: 2500 },
];

// Hệ số XP (đề xuất — chỉnh được sau ở Console)
export const XP_RATE = {
  perActivity: 10,
  perKhoaiSent: 2,
  perKhoaiReceived: 1,
  perBadgeTier: 25,
  perRingWeek: 15,
};

export function computeXp(s: {
  activityCount: number;
  khoaiSent: number;
  khoaiReceived: number;
  badgeTiers: number;
  ringWeeks: number;
}): number {
  return (
    s.activityCount * XP_RATE.perActivity +
    s.khoaiSent * XP_RATE.perKhoaiSent +
    s.khoaiReceived * XP_RATE.perKhoaiReceived +
    s.badgeTiers * XP_RATE.perBadgeTier +
    s.ringWeeks * XP_RATE.perRingWeek
  );
}

export interface LevelState {
  current: LevelDef;
  next: LevelDef | null;
  pct: number; // tiến độ trong đoạn hiện tại (0..100)
  xp: number;
}

export function levelFromXp(xp: number): LevelState {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].minXp) idx = i;
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const pct = next ? Math.min(100, Math.max(0, Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100))) : 100;
  return { current, next, pct, xp };
}

// ───────────────────────── Danh hiệu thể lực (Trục B — thành tích thật, admin set) ─────────────────────────
export interface TitleDef {
  key: string;
  name: string;
  icon: string;
  desc: string;
}

export const ATHLETIC_TITLES: TitleDef[] = [
  { key: "half", name: "Wicer Half Marathon", icon: "🏅", desc: "Chạy 21km trong một giải" },
  { key: "aqua", name: "Wicer Aqua", icon: "🏊", desc: "Bơi 1.000m + chạy 10km" },
  { key: "marathon", name: "Wicer Marathon", icon: "🥇", desc: "Chạy 42km" },
  { key: "triathlon", name: "Olympic Triathlon", icon: "🔱", desc: "Bơi 1.5km + đạp 40km + chạy 10km" },
  { key: "ironman", name: "Wicer IronMan", icon: "🦾", desc: "Cao nhất — verify qua giải đấu (admin set thủ công)" },
];

export function titleStates(earnedKeys: string[]): { key: string; name: string; icon: string; desc: string; earned: boolean }[] {
  const set = new Set(earnedKeys);
  return ATHLETIC_TITLES.map((t) => ({ ...t, earned: set.has(t.key) }));
}

// ───────────────────────── Vòng tròn tuần (Rings) ─────────────────────────
export interface Rings {
  move: { pct: number; done: boolean; kmLeft: number; target: number };
  thanks: { done: boolean };
  grow: { done: boolean; hidden: boolean };
}

export const MOVE_WEEK_TARGET_KM = 10; // mặc định 10km/tuần để khép vòng Move

export function computeRings(o: { kmThisWeek: number; gaveThisWeek: boolean; moveTargetKm?: number }): Rings {
  const target = o.moveTargetKm ?? MOVE_WEEK_TARGET_KM;
  const pct = Math.min(100, Math.round((o.kmThisWeek / target) * 100));
  return {
    move: { pct, done: o.kmThisWeek >= target, kmLeft: Math.max(0, +(target - o.kmThisWeek).toFixed(1)), target },
    thanks: { done: o.gaveThisWeek },
    grow: { done: false, hidden: true }, // WiGrow chưa ra mắt
  };
}

// ───────────────────────── Ngày / tuần helpers (giờ local = VN) ─────────────────────────
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Đầu tuần = Thứ Hai 00:00 local
export function weekStart(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - dow);
  return x;
}

export function weekKey(d = new Date()): string {
  const w = weekStart(d);
  return `${w.getFullYear()}-${w.getMonth()}-${w.getDate()}`;
}

// Đầu tuần = Thứ Hai 00:00 giờ VN (UTC+7). Trả về mốc tuyệt đối (UTC Date) để lọc DB,
// đúng bất kể múi giờ máy chủ. Tuần: Thứ Hai 00:00 VN → Chủ Nhật 24:00 VN.
export function weekStartVN(now = new Date()): Date {
  const OFF = 7 * 60 * 60 * 1000; // +7h
  const vn = new Date(now.getTime() + OFF); // các trường UTC của vn = giờ treo tường VN
  const dow = (vn.getUTCDay() + 6) % 7; // Thứ Hai = 0
  const mondayMidnightVN = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - dow * 86400000;
  return new Date(mondayMidnightVN - OFF); // quy về mốc UTC thật
}

// Đầu NGÀY / đầu THÁNG theo giờ VN (UTC+7) — trả về mốc UTC tuyệt đối để lọc DB đúng bất kể múi giờ máy chủ.
export function dayStartVN(now = new Date()): Date {
  const OFF = 7 * 60 * 60 * 1000;
  const vn = new Date(now.getTime() + OFF);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - OFF);
}
export function monthStartVN(now = new Date()): Date {
  const OFF = 7 * 60 * 60 * 1000;
  const vn = new Date(now.getTime() + OFF);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - OFF);
}
export function yearStartVN(now = new Date()): Date {
  const OFF = 7 * 60 * 60 * 1000;
  const vn = new Date(now.getTime() + OFF);
  return new Date(Date.UTC(vn.getUTCFullYear(), 0, 1) - OFF);
}

export function dateKeyVN(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Streak tuần = số TUẦN liên tiếp "năng động" (có ≥1 hoạt động HOẶC tặng ≥1 khoai).
export function computeWeekStreak(activeWeekKeys: Set<string>): number {
  let cur = weekStart();
  if (!activeWeekKeys.has(weekKey(cur))) cur = addDays(cur, -7); // tuần này chưa năng động → tính từ tuần trước
  let n = 0;
  while (activeWeekKeys.has(weekKey(cur))) {
    n++;
    cur = addDays(cur, -7);
  }
  return n;
}

// Ngày kỷ niệm/sinh nhật rơi vào TUẦN NÀY (Thứ Hai..Chủ Nhật)?
export function isThisWeekAnnual(d: Date, ref = new Date()): boolean {
  const ws = weekStart(ref);
  const we = addDays(ws, 7);
  const occ = new Date(ref.getFullYear(), d.getMonth(), d.getDate());
  return occ >= ws && occ < we;
}

export function isSameMonthDay(d: Date, ref = new Date()): boolean {
  return d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

export function yearsSince(d: Date, ref = new Date()): number {
  let y = ref.getFullYear() - d.getFullYear();
  const before = ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate());
  if (before) y -= 1;
  return Math.max(0, y);
}
