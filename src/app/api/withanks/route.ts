import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  computeAllowance, countKindSince, tenureDays,
  VALUE_TAGS, SUPER_PER_MONTH, SPECIAL_PER_YEAR, SPECIAL_MIN_TENURE_DAYS, SPECIAL_KHOAI,
} from "@/lib/withanks";
import { monthStartVN, yearStartVN } from "@/lib/wicer";

export const dynamic = "force-dynamic";

// Ẩn danh: chỉ hiện 5 từ đầu của lời cảm ơn, phần sau che ****.
function maskMessage(msg: string): string {
  const words = msg.trim().split(/\s+/);
  if (words.length <= 5) return msg;
  return words.slice(0, 5).join(" ") + " ****";
}

// Đầu QUÝ hiện tại theo giờ VN (UTC+7) — mốc UTC tuyệt đối để lọc DB.
function quarterStartVN(now = new Date()): Date {
  const OFF = 7 * 60 * 60 * 1000;
  const vn = new Date(now.getTime() + OFF);
  const qMonth = Math.floor(vn.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(vn.getUTCFullYear(), qMonth, 1) - OFF);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const me = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { id: true, name: true, avatarUrl: true, team: true, isAdmin: true, wiRole: true, khoaiBalance: true, joinedAt: true, createdAt: true },
  });
  if (!me) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const allowance = await computeAllowance(me);

  // Đủ điều kiện các nấc (để FE khoá/mở đúng).
  const [superUsed, specialUsed] = await Promise.all([
    countKindSince(me.id, "super", monthStartVN()),
    countKindSince(me.id, "special", yearStartVN()),
  ]);
  const days = tenureDays(me);
  const eligibility = {
    canSuper: me.isAdmin ? true : superUsed < SUPER_PER_MONTH,
    superUsed,
    canSpecial: days >= SPECIAL_MIN_TENURE_DAYS && specialUsed < SPECIAL_PER_YEAR && me.khoaiBalance >= SPECIAL_KHOAI,
    specialUsed,
    tenureDays: days,
    specialCost: SPECIAL_KHOAI,
    specialTenureDays: SPECIAL_MIN_TENURE_DAYS,
  };

  // Lấy các lượt cảm ơn gần đây (kèm sender/receiver rút gọn).
  const rows = await prisma.thanksGift.findMany({
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true, isAdmin: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true, team: true } },
    },
  });

  // ❤️ của tôi trên các lời cảm ơn đang hiển thị.
  const myHearts = new Set(
    (await prisma.thanksHeart.findMany({ where: { employeeId: me.id, thanksId: { in: rows.map((r) => r.id) } }, select: { thanksId: true } })).map((h) => h.thanksId),
  );

  const shapeFeed = (t: (typeof rows)[number]) => ({
    id: t.id,
    khoai: t.khoai,
    kind: t.kind,
    valueTags: t.valueTags,
    heartCount: t.heartCount,
    hearted: myHearts.has(t.id),
    createdAt: t.createdAt.toISOString(),
    anonymous: t.anonymous,
    message: t.anonymous ? maskMessage(t.message) : t.message,
    sender: t.anonymous
      ? { id: null, name: "Ẩn danh", avatarUrl: null }
      : { id: t.sender.id, name: t.sender.name, avatarUrl: t.sender.avatarUrl },
    receiver: { id: t.receiver.id, name: t.receiver.name, avatarUrl: t.receiver.avatarUrl, team: t.receiver.team ?? "Wicom" },
  });

  // FEED (mới nhất) + "được yêu thích" (nhiều tim nhất).
  const feed = rows.slice(0, 60).map(shapeFeed);
  const lovedThanks = [...rows].filter((t) => t.heartCount > 0).sort((a, b) => b.heartCount - a.heartCount).slice(0, 20).map(shapeFeed);

  // BOARD (kudos) — gom theo người nhận, người mới được cảm ơn lên đầu (rows đã desc).
  const byReceiver = new Map<string, {
    id: string; name: string; avatarUrl: string | null; team: string;
    totalReceived: number; count: number; lastAt: string;
    thanks: { id: string; senderName: string; senderAvatar: string | null; khoai: number; kind: string; valueTags: string[]; heartCount: number; message: string; createdAt: string }[];
  }>();
  for (const t of rows) {
    let e = byReceiver.get(t.receiverId);
    if (!e) {
      e = { id: t.receiver.id, name: t.receiver.name, avatarUrl: t.receiver.avatarUrl, team: t.receiver.team ?? "Wicom", totalReceived: 0, count: 0, lastAt: t.createdAt.toISOString(), thanks: [] };
      byReceiver.set(t.receiverId, e);
    }
    if (t.kind !== "special") e.totalReceived += t.khoai; // special = quà thật, không cộng khoai nhận
    e.count += 1;
    e.thanks.push({
      id: t.id,
      senderName: t.anonymous ? "Ẩn danh" : t.sender.name,
      senderAvatar: t.anonymous ? null : t.sender.avatarUrl,
      khoai: t.khoai,
      kind: t.kind,
      valueTags: t.valueTags,
      heartCount: t.heartCount,
      message: t.anonymous ? maskMessage(t.message) : t.message,
      createdAt: t.createdAt.toISOString(),
    });
  }
  const board = [...byReceiver.values()]; // đã theo thứ tự lần nhận gần nhất (rows desc)

  // ── Quý này: số lời cảm ơn NHẬN / khoai CHO ĐI (loại khoai Admin & bonus) ──
  const qStart = quarterStartVN();
  const qRows = await prisma.thanksGift.findMany({
    where: { createdAt: { gte: qStart } },
    select: { senderId: true, receiverId: true, khoai: true, sender: { select: { isAdmin: true, name: true, avatarUrl: true } } },
  });
  const qCountByReceiver = new Map<string, number>();
  const giveBySender = new Map<string, { id: string; name: string; avatarUrl: string | null; given: number }>();
  for (const t of qRows) {
    qCountByReceiver.set(t.receiverId, (qCountByReceiver.get(t.receiverId) ?? 0) + 1);
    if (t.sender.isAdmin) continue; // khoai Admin tặng không tính "cho đi"
    const g = giveBySender.get(t.senderId) ?? { id: t.senderId, name: t.sender.name, avatarUrl: t.sender.avatarUrl, given: 0 };
    g.given += t.khoai;
    giveBySender.set(t.senderId, g);
  }
  // Gắn số lời cảm ơn trong quý vào từng người trên board.
  for (const p of board) (p as unknown as { quarterCount: number }).quarterCount = qCountByReceiver.get(p.id) ?? 0;
  // Bảng "Người gieo khoai" (cho đi nhiều nhất quý này).
  const givingBoard = [...giveBySender.values()]
    .sort((a, b) => b.given - a.given)
    .slice(0, 8)
    .map((g, i) => ({ ...g, rank: i + 1, isMe: g.id === me.id }));

  // RANKINGS — theo tổng khoai nhận (KHÔNG tính khoai do Admin tặng).
  const rankMap = new Map<string, { id: string; name: string; avatarUrl: string | null; team: string; total: number }>();
  for (const t of rows) {
    if (t.sender.isAdmin || t.kind === "special") continue; // khoai admin & special (quà thật) không tính khoai nhận
    let e = rankMap.get(t.receiverId);
    if (!e) e = { id: t.receiver.id, name: t.receiver.name, avatarUrl: t.receiver.avatarUrl, team: t.receiver.team ?? "Wicom", total: 0 };
    e.total += t.khoai;
    rankMap.set(t.receiverId, e);
  }
  const ranked = [...rankMap.values()].sort((a, b) => b.total - a.total);
  const rankings = ranked.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1, isMe: r.id === me.id }));
  const myRankIdx = ranked.findIndex((r) => r.id === me.id);
  const myRank = myRankIdx >= 0 ? { rank: myRankIdx + 1, total: ranked[myRankIdx].total } : { rank: null, total: 0 };

  return NextResponse.json({
    me: {
      id: me.id,
      name: me.name,
      avatarUrl: me.avatarUrl,
      balance: me.khoaiBalance,
      allowance,
      eligibility,
      myRank,
    },
    valueTags: VALUE_TAGS,
    board,
    givingBoard,
    feed,
    lovedThanks,
    rankings,
  });
}
