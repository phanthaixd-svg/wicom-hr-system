import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { dateKeyVN } from "@/lib/wicer";
import { larkNotifyEnabled, sendLarkText } from "@/lib/larkNotify";
import { creditKhoai } from "@/lib/khoai";

export const dynamic = "force-dynamic";

const RARITY_WEIGHT: Record<string, number> = { common: 70, rare: 25, legendary: 5 };

// Lật thẻ Wicer Card của hôm nay (1 lá/ngày/người). Trả về lá đã lật (mới hoặc lá đã lật trước đó).
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const emp = await prisma.employee.findUnique({ where: { id: session.employeeId }, select: { id: true, khoaiBalance: true, larkOpenId: true } });
  if (!emp) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const dateKey = dateKeyVN(new Date());

  // Đã lật hôm nay chưa?
  const existing = await prisma.cardDraw.findUnique({ where: { employeeId_dateKey: { employeeId: emp.id, dateKey } } });
  if (existing) {
    return NextResponse.json({
      already: true,
      card: { emoji: existing.emoji, message: existing.message, category: existing.category, background: existing.background, rarity: existing.rarity, rewardKhoai: existing.rewardKhoai },
    });
  }

  const deck = await prisma.wicerCard.findMany({ where: { active: true } });
  if (deck.length === 0) return NextResponse.json({ error: "empty-deck" }, { status: 404 });

  // Chọn ngẫu nhiên có trọng số theo độ hiếm.
  const weighted = deck.map((c) => ({ c, w: RARITY_WEIGHT[c.rarity] ?? 50 }));
  const totalW = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * totalW;
  let picked = weighted[0].c;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) { picked = x.c; break; }
  }

  // Tạo lượt lật (unique employeeId+dateKey chống lật 2 lần/ngày kể cả race).
  let draw;
  try {
    draw = await prisma.$transaction(async (tx) => {
      const d = await tx.cardDraw.create({
        data: {
          employeeId: emp.id, cardId: picked.id, dateKey,
          emoji: picked.emoji, message: picked.message, category: picked.category, background: picked.background, rarity: picked.rarity, rewardKhoai: picked.rewardKhoai,
        },
      });
      if (picked.rewardKhoai > 0) {
        await creditKhoai(tx, emp.id, picked.rewardKhoai, { reason: "card", refType: "CardDraw", refId: d.id });
      }
      return d;
    });
  } catch {
    // Nếu vướng unique (đã lật ở request song song) → trả lá đã có.
    const again = await prisma.cardDraw.findUnique({ where: { employeeId_dateKey: { employeeId: emp.id, dateKey } } });
    if (again) return NextResponse.json({ already: true, card: { emoji: again.emoji, message: again.message, category: again.category, background: again.background, rarity: again.rarity, rewardKhoai: again.rewardKhoai } });
    return NextResponse.json({ error: "draw-failed" }, { status: 500 });
  }

  if (picked.rewardKhoai > 0 && larkNotifyEnabled() && emp.larkOpenId) {
    void sendLarkText(emp.larkOpenId, `🎴 Bạn vừa lật trúng thẻ Wicer Card ${picked.rarity === "legendary" ? "Huyền thoại 🌟" : "Hiếm ✦"} và nhận +${picked.rewardKhoai} 🥔!`).catch(() => {});
  }

  return NextResponse.json({
    already: false,
    card: { emoji: draw.emoji, message: draw.message, category: draw.category, background: draw.background, rarity: draw.rarity, rewardKhoai: draw.rewardKhoai },
  });
}
