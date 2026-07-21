import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { debitKhoai } from "@/lib/khoai";
import { larkNotifyEnabled, sendLarkText } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

// Danh sách quà (3 loại) + tiến độ góp + số dư khoai + lịch sử đổi.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meId = session.employeeId;

  const me = await prisma.employee.findUnique({ where: { id: meId }, select: { khoaiBalance: true } });
  const rewards = await prisma.reward.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      contributions: { include: { employee: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { khoai: "desc" } },
    },
  });
  const myRedemptions = await prisma.redemption.findMany({
    where: { employeeId: meId }, orderBy: { createdAt: "desc" }, take: 20,
  });

  const shaped = rewards.map((r) => {
    const raised = r.contributions.reduce((s, c) => s + c.khoai, 0);
    const mine = r.contributions.find((c) => c.employeeId === meId) ?? null;
    const mainCount = r.contributions.filter((c) => c.isMain).length;
    return {
      id: r.id, name: r.name, description: r.description, emoji: r.emoji, imageUrl: r.imageUrl,
      kind: r.kind, costKhoai: r.costKhoai, goalKhoai: r.goalKhoai, maxMain: r.maxMain, status: r.status,
      raised, pct: r.goalKhoai ? Math.min(100, Math.round((raised / r.goalKhoai) * 100)) : 0,
      mainCount,
      myKhoai: mine?.khoai ?? 0, myIsMain: mine?.isMain ?? false,
      contributors: r.contributions.map((c) => ({ id: c.employee.id, name: c.employee.name, avatarUrl: c.employee.avatarUrl, khoai: c.khoai, isMain: c.isMain })),
    };
  });

  return NextResponse.json({
    balance: me?.khoaiBalance ?? 0,
    rewards: shaped,
    redemptions: myRedemptions.map((r) => ({ id: r.id, rewardName: r.rewardName, costKhoai: r.costKhoai, status: r.status, createdAt: r.createdAt.toISOString() })),
  });
}

// Đổi quà INDIVIDUAL bằng khoai (trừ ví nhận, tạo redemption + hàng đợi HR).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meId = session.employeeId;

  let rewardId = "";
  try {
    rewardId = String((await req.json()).rewardId ?? "");
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!rewardId) return NextResponse.json({ error: "missing-id" }, { status: 400 });

  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.active) return NextResponse.json({ error: "notfound" }, { status: 404 });
  if (reward.kind !== "individual") return NextResponse.json({ error: "wrong-kind", message: "Phần quà này góp chung, dùng nút Góp." }, { status: 400 });
  if (reward.costKhoai < 1) return NextResponse.json({ error: "bad-cost" }, { status: 400 });

  const me = await prisma.employee.findUnique({ where: { id: meId }, select: { larkOpenId: true } });
  if (!me) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const newBalance = await prisma.$transaction(async (tx) => {
    const redemption = await tx.redemption.create({
      data: { employeeId: meId, rewardId: reward.id, rewardName: reward.name, costKhoai: reward.costKhoai, status: "pending" },
    });
    const bal = await debitKhoai(tx, meId, reward.costKhoai, { reason: "redeem", refType: "Redemption", refId: redemption.id });
    if (bal === null) throw new Error("insufficient");
    await tx.fulfillment.create({
      data: { kind: "individual", title: reward.name, employeeId: meId, khoai: reward.costKhoai, refType: "Redemption", refId: redemption.id, status: "pending" },
    });
    return bal;
  }).catch((e) => { if (e.message === "insufficient") return null; throw e; });

  if (newBalance === null) {
    const cur = await prisma.employee.findUnique({ where: { id: meId }, select: { khoaiBalance: true } });
    return NextResponse.json({ error: "insufficient", message: `Không đủ khoai. Cần ${reward.costKhoai}, bạn có ${cur?.khoaiBalance ?? 0}.` }, { status: 400 });
  }

  if (larkNotifyEnabled() && me.larkOpenId) {
    void sendLarkText(me.larkOpenId, `🎁 Bạn vừa đổi "${reward.name}" với ${reward.costKhoai} 🥔.\nHR sẽ trao quà tới bạn sớm. Số khoai còn lại: ${newBalance} củ.`).catch(() => {});
  }

  return NextResponse.json({ ok: true, newBalance });
}
