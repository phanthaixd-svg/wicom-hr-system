import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

interface CardOut {
  cardId: string; emoji: string; message: string; category: string; background: string | null;
  rarity: string; rewardKhoai: number; owned: boolean; copies: number; favorite: boolean; firstISO: string | null;
}

// GET: bộ sưu tập của user — thẻ đang sở hữu + thẻ chưa mở (khoá) + thùng rác (đã ẩn).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meId = session.employeeId;

  const [deck, draws] = await Promise.all([
    prisma.wicerCard.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.cardDraw.findMany({ where: { employeeId: meId }, orderBy: { drawnAt: "asc" } }),
  ]);

  // Gom draws theo cardId (tách bản còn giữ vs đã ẩn), giữ snapshot của lá gần nhất.
  interface Agg { copies: number; removedCount: number; favorite: boolean; firstISO: string | null; snap: (typeof draws)[number] }
  const byCard = new Map<string, Agg>();
  let khoaiFromCards = 0;
  for (const d of draws) {
    khoaiFromCards += d.rewardKhoai;
    let e = byCard.get(d.cardId);
    if (!e) { e = { copies: 0, removedCount: 0, favorite: false, firstISO: null, snap: d }; byCard.set(d.cardId, e); }
    e.snap = d; // draws đã sort asc → cuối cùng là mới nhất
    if (d.removed) e.removedCount++;
    else {
      e.copies++;
      if (d.favorite) e.favorite = true;
      if (!e.firstISO) e.firstISO = d.drawnAt.toISOString();
    }
  }

  const deckById = new Map(deck.map((c) => [c.id, c]));
  const gallery: CardOut[] = [];
  const bin: CardOut[] = [];

  const outFromDeck = (c: (typeof deck)[number], a: Agg | undefined): CardOut => ({
    cardId: c.id, emoji: c.emoji, message: c.message, category: c.category, background: c.background,
    rarity: c.rarity, rewardKhoai: c.rewardKhoai, owned: !!a && a.copies > 0, copies: a?.copies ?? 0, favorite: a?.favorite ?? false, firstISO: a?.firstISO ?? null,
  });
  const outFromSnap = (a: Agg): CardOut => {
    const s = a.snap;
    return { cardId: s.cardId, emoji: s.emoji, message: s.message, category: s.category, background: s.background,
      rarity: s.rarity, rewardKhoai: s.rewardKhoai, owned: a.copies > 0, copies: a.copies, favorite: a.favorite, firstISO: a.firstISO };
  };

  // 1) Thẻ trong bộ bài đang hoạt động: owned (còn giữ) hoặc locked (chưa mở). Nếu đã ẩn hết → vào bin.
  for (const c of deck) {
    const a = byCard.get(c.id);
    if (a && a.copies === 0 && a.removedCount > 0) bin.push(outFromDeck(c, a));
    else gallery.push(outFromDeck(c, a)); // owned (copies>0) hoặc locked (không có draw)
  }
  // 2) Thẻ user từng có nhưng nguồn đã bị admin ẩn/xoá (không còn trong deck) — vẫn giữ trong bộ sưu tập.
  for (const [cardId, a] of byCard) {
    if (deckById.has(cardId)) continue;
    if (a.copies > 0) gallery.push(outFromSnap(a));
    else if (a.removedCount > 0) bin.push(outFromSnap(a));
  }

  const stat = (r: string) => ({ c: gallery.filter((x) => x.rarity === r && x.owned).length, t: gallery.filter((x) => x.rarity === r).length });
  return NextResponse.json({
    stats: {
      collected: gallery.filter((x) => x.owned).length,
      total: gallery.length,
      legendary: stat("legendary"), rare: stat("rare"), common: stat("common"),
      khoaiFromCards, favorites: gallery.filter((x) => x.favorite).length, removed: bin.length,
    },
    cards: gallery,
    bin,
  });
}

// POST: thao tác trên 1 lá của user. action: "fav" (mặc định) | "remove" | "restore".
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meId = session.employeeId;

  let body: { cardId?: string; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  const cardId = String(body.cardId ?? "");
  const action = body.action === "remove" || body.action === "restore" ? body.action : "fav";
  if (!cardId) return NextResponse.json({ error: "missing-cardId" }, { status: 400 });

  const owns = await prisma.cardDraw.findFirst({ where: { employeeId: meId, cardId } });
  if (!owns) return NextResponse.json({ error: "not-owned" }, { status: 400 });

  if (action === "remove") {
    // Ẩn tất cả bản của lá này khỏi bộ sưu tập (giữ lịch sử + khoai đã thưởng).
    await prisma.cardDraw.updateMany({ where: { employeeId: meId, cardId }, data: { removed: true, favorite: false } });
    return NextResponse.json({ ok: true, cardId, removed: true });
  }
  if (action === "restore") {
    await prisma.cardDraw.updateMany({ where: { employeeId: meId, cardId }, data: { removed: false } });
    return NextResponse.json({ ok: true, cardId, removed: false });
  }
  // fav: chỉ ghim khi đang sở hữu (không ghim thẻ đã ẩn).
  const activeOwned = await prisma.cardDraw.findFirst({ where: { employeeId: meId, cardId, removed: false } });
  if (!activeOwned) return NextResponse.json({ error: "not-owned" }, { status: 400 });
  const alreadyFav = await prisma.cardDraw.findFirst({ where: { employeeId: meId, cardId, favorite: true } });
  const favorite = !alreadyFav;
  await prisma.cardDraw.updateMany({ where: { employeeId: meId, cardId, removed: false }, data: { favorite } });
  return NextResponse.json({ ok: true, cardId, favorite });
}
