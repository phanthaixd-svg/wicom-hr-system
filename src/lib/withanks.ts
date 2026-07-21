import { prisma } from "./db";
import { weekStartVN, monthStartVN, dayStartVN } from "./wicer";

// WiThanks — hệ "khoai" 🥔. Model 2 hai ví:
//  • Ví TẶNG (giving): hạn mức theo vai trò, reset theo tuần/tháng — tính từ ledger ThanksGift đã gửi.
//  • Ví NHẬN (balance): Employee.khoaiBalance — số dư tích luỹ để đổi quà.

export const KHOAI = "🥔";

// ───────────────────────── Giá trị cốt lõi (value tags gắn vào lời cảm ơn) ─────────────────────────
export interface ValueTag { key: string; label: string; emoji: string }
export const VALUE_TAGS: ValueTag[] = [
  { key: "tan-tam", label: "Tận tâm", emoji: "💛" },
  { key: "chinh-truc", label: "Chính trực", emoji: "🧭" },
  { key: "dong-doi", label: "Đồng đội", emoji: "🤝" },
  { key: "sang-tao", label: "Sáng tạo", emoji: "💡" },
];
export const VALUE_TAG_MAP: Record<string, ValueTag> = Object.fromEntries(VALUE_TAGS.map((v) => [v.key, v]));

// ───────────────────────── 3 nấc gửi cảm ơn ─────────────────────────
//  • thanks : hằng ngày, ≤ perPersonDay/người/ngày, tính vào hạn mức ví tặng.
//  • super  : 1 lần/tháng, tôn vinh 1 người, 30🥔 (không tính hạn mức thường), ≥ MIN_SUPER_MSG.
//  • special: 1 lần/năm, TRỪ 100🥔 ví nhận của người tặng (cam kết cá nhân) → HR trao quà thật <500k.
export const SUPER_KHOAI = 30;
export const SUPER_PER_MONTH = 1; // mỗi người gửi tối đa 1 Super/tháng
export const MIN_SUPER_MSG = 80; // ký tự tối thiểu cho Super
export const SPECIAL_KHOAI = 100; // trừ ví nhận người tặng
export const SPECIAL_PER_YEAR = 1;
export const SPECIAL_MIN_TENURE_DAYS = 180; // ≥ ~6 tháng thâm niên
export const SPECIAL_BUDGET_VND = 500_000; // ngân sách quà công ty hoàn
export const MIN_SPECIAL_MSG = 80;

export interface RoleLimit {
  week: number | null; // null = không giới hạn theo tuần
  month: number;
  perPersonDay: number; // tối đa 1 người nhận/1 ngày
}

export const ROLE_LIMITS: Record<string, RoleLimit> = {
  staff: { week: 35, month: 100, perPersonDay: 5 },
  leader: { week: null, month: 150, perPersonDay: 10 },
};

// Ranh giới tuần/tháng/ngày theo giờ VN (UTC+7) — nhất quán dù máy chủ chạy UTC.
const weekStart = weekStartVN;
const monthStart = monthStartVN;
const dayStart = dayStartVN;

// Chấp nhận cả prisma lẫn transaction client để tính hạn mức ngay trong transaction (chống race).
type Db = Pick<typeof prisma, "thanksGift">;

// Chỉ tính "thanks" thường vào hạn mức ví tặng — Super/Special là token riêng, không ăn vào hạn mức.
async function sumSent(senderId: string, since: Date, db: Db = prisma): Promise<number> {
  const agg = await db.thanksGift.aggregate({
    _sum: { khoai: true },
    where: { senderId, kind: "thanks", createdAt: { gte: since } },
  });
  return agg._sum.khoai ?? 0;
}

export interface Allowance {
  unlimited: boolean; // admin
  role: string;
  weekLimit: number | null;
  monthLimit: number | null;
  weekRemaining: number | null;
  monthRemaining: number | null;
  canGiveNow: number | null; // số khoai tối đa còn có thể tặng lúc này (null = không giới hạn)
  perPersonDay: number | null;
}

// Hạn mức tặng hiện tại của 1 nhân sự.
export async function computeAllowance(emp: { id: string; wiRole: string; isAdmin: boolean }, db: Db = prisma): Promise<Allowance> {
  if (emp.isAdmin) {
    return { unlimited: true, role: "admin", weekLimit: null, monthLimit: null, weekRemaining: null, monthRemaining: null, canGiveNow: null, perPersonDay: null };
  }
  const lim = ROLE_LIMITS[emp.wiRole] ?? ROLE_LIMITS.staff;
  const [givenWeek, givenMonth] = await Promise.all([
    lim.week != null ? sumSent(emp.id, weekStart(), db) : Promise.resolve(0),
    sumSent(emp.id, monthStart(), db),
  ]);
  const weekRemaining = lim.week != null ? Math.max(0, lim.week - givenWeek) : null;
  const monthRemaining = Math.max(0, lim.month - givenMonth);
  const canGiveNow = weekRemaining != null ? Math.min(weekRemaining, monthRemaining) : monthRemaining;
  return {
    unlimited: false,
    role: emp.wiRole,
    weekLimit: lim.week,
    monthLimit: lim.month,
    weekRemaining,
    monthRemaining,
    canGiveNow,
    perPersonDay: lim.perPersonDay,
  };
}

// Đã tặng cho 1 người trong hôm nay (để chặn trần perPersonDay). Chỉ tính "thanks" thường.
export async function givenToPersonToday(senderId: string, receiverId: string, db: Db = prisma): Promise<number> {
  const agg = await db.thanksGift.aggregate({
    _sum: { khoai: true },
    where: { senderId, receiverId, kind: "thanks", createdAt: { gte: dayStart() } },
  });
  return agg._sum.khoai ?? 0;
}

// Số lượt gửi theo nấc (super/special) kể từ mốc thời gian (chặn 1/tháng, 1/năm).
export async function countKindSince(senderId: string, kind: string, since: Date, db: Db = prisma): Promise<number> {
  return db.thanksGift.count({ where: { senderId, kind, createdAt: { gte: since } } });
}

// Thâm niên (ngày) — dùng joinedAt, fallback createdAt.
export function tenureDays(emp: { joinedAt: Date | null; createdAt: Date }, now = new Date()): number {
  const start = emp.joinedAt ?? emp.createdAt;
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}
