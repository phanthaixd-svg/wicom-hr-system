import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { computeAllowance } from "@/lib/withanks";
import { weekStartVN, monthStartVN } from "@/lib/wicer";

export const dynamic = "force-dynamic";

// Bảng "Kinh tế khoai" cho HR — thống kê khoai theo từng nhân sự. Read-only.
// ?period=all|week|month : lọc các CHỈ SỐ DÒNG CHẢY (cho/nhận/super/special/đổi quà);
// ví khoai + hạn mức + "cảm ơn gần nhất" luôn theo hiện tại/toàn thời gian.
export async function GET(req: NextRequest) {
  const hr = await requireHR();
  if (!hr) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const period = new URL(req.url).searchParams.get("period") || "all";
  const cutoff = period === "week" ? weekStartVN() : period === "month" ? monthStartVN() : null;
  const inPeriod = (d: Date) => !cutoff || d >= cutoff;

  const [employees, gifts, redemptions] = await Promise.all([
    prisma.employee.findMany({
      where: { leftAt: null },
      select: { id: true, name: true, avatarUrl: true, team: true, wiRole: true, isAdmin: true, khoaiBalance: true },
    }),
    prisma.thanksGift.findMany({ select: { senderId: true, receiverId: true, khoai: true, kind: true, createdAt: true } }),
    prisma.redemption.findMany({ select: { employeeId: true, costKhoai: true, createdAt: true } }),
  ]);

  interface Acc {
    id: string; name: string; avatarUrl: string | null; team: string; khoaiBalance: number;
    givenKhoai: number; receivedKhoai: number;
    superGiven: number; superReceived: number; specialGiven: number; specialReceived: number;
    redeemed: number; givenCount: number; receivedCount: number;
    weekRemaining: number | null; monthRemaining: number | null;
    lastGivenAt: Date | null; _recv: Set<string>;
  }
  const map = new Map<string, Acc>();
  for (const e of employees) {
    map.set(e.id, {
      id: e.id, name: e.name, avatarUrl: e.avatarUrl, team: e.team ?? "—", khoaiBalance: e.khoaiBalance,
      givenKhoai: 0, receivedKhoai: 0, superGiven: 0, superReceived: 0, specialGiven: 0, specialReceived: 0,
      redeemed: 0, givenCount: 0, receivedCount: 0, weekRemaining: null, monthRemaining: null,
      lastGivenAt: null, _recv: new Set(),
    });
  }

  for (const g of gifts) {
    const s = map.get(g.senderId);
    const r = map.get(g.receiverId);
    if (s && (!s.lastGivenAt || g.createdAt > s.lastGivenAt)) s.lastGivenAt = g.createdAt; // all-time
    if (!inPeriod(g.createdAt)) continue;
    if (s) {
      if (g.kind === "super") s.superGiven++;
      else if (g.kind === "special") s.specialGiven++;
      else { s.givenKhoai += g.khoai; s.givenCount++; s._recv.add(g.receiverId); }
    }
    if (r) {
      if (g.kind === "super") r.superReceived++;
      else if (g.kind === "special") r.specialReceived++;
      else { r.receivedKhoai += g.khoai; r.receivedCount++; }
    }
  }
  for (const rd of redemptions) {
    if (!inPeriod(rd.createdAt)) continue;
    const e = map.get(rd.employeeId);
    if (e) e.redeemed += rd.costKhoai;
  }

  // Hạn mức còn lại (hiện tại) — dùng lại đúng luật computeAllowance.
  await Promise.all(employees.map(async (e) => {
    const a = await computeAllowance({ id: e.id, wiRole: e.wiRole, isAdmin: e.isAdmin });
    const row = map.get(e.id)!;
    row.weekRemaining = a.weekRemaining;
    row.monthRemaining = a.monthRemaining;
  }));

  const rows = [...map.values()].map(({ _recv, lastGivenAt, ...r }) => ({
    ...r,
    distinctReceivers: _recv.size,
    lastGivenAt: lastGivenAt ? lastGivenAt.toISOString() : null,
  }));

  const totalCirculating = employees.reduce((n, e) => n + e.khoaiBalance, 0);
  const totalGiven = rows.reduce((n, r) => n + r.givenKhoai, 0);
  const totalRedeemed = rows.reduce((n, r) => n + r.redeemed, 0);
  const participants = rows.filter((r) => r.givenCount + r.receivedCount + r.superGiven + r.specialGiven > 0).length;
  const topGiver = [...rows].sort((a, b) => b.givenKhoai - a.givenKhoai)[0];
  const topReceiver = [...rows].sort((a, b) => b.receivedKhoai - a.receivedKhoai)[0];

  return NextResponse.json({
    period,
    rows,
    summary: {
      totalCirculating, totalGiven, totalRedeemed, participants, headcount: employees.length,
      topGiver: topGiver && topGiver.givenKhoai > 0 ? { name: topGiver.name, val: topGiver.givenKhoai } : null,
      topReceiver: topReceiver && topReceiver.receivedKhoai > 0 ? { name: topReceiver.name, val: topReceiver.receivedKhoai } : null,
    },
  });
}
