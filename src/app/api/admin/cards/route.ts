import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";

export const dynamic = "force-dynamic";

const RARITIES = ["common", "rare", "legendary"];

// Chuẩn hoá payload card từ body.
function cleanCard(patch: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (typeof patch.message === "string" && patch.message.trim()) data.message = patch.message.trim().slice(0, 400);
  if (typeof patch.emoji === "string") data.emoji = (patch.emoji.trim() || "🌿").slice(0, 12);
  if (typeof patch.category === "string" && patch.category.trim()) data.category = patch.category.trim().slice(0, 40);
  if ("background" in patch) {
    const bg = typeof patch.background === "string" ? patch.background.trim() : "";
    data.background = bg ? bg.slice(0, 600) : null;
  }
  if (typeof patch.rarity === "string" && RARITIES.includes(patch.rarity)) data.rarity = patch.rarity;
  if (typeof patch.rewardKhoai === "number" && patch.rewardKhoai >= 0) data.rewardKhoai = Math.min(1000, Math.round(patch.rewardKhoai));
  if (typeof patch.active === "boolean") data.active = patch.active;
  if (typeof patch.sortOrder === "number") data.sortOrder = Math.round(patch.sortOrder);
  return data;
}

// GET — toàn bộ card (kể cả inactive) + số người đã sưu tầm mỗi lá.
export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cards = await prisma.wicerCard.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const counts = await prisma.cardDraw.groupBy({ by: ["cardId"], _count: { _all: true } });
  const ownersByCard = new Map(counts.map((c) => [c.cardId, c._count._all]));
  return NextResponse.json({
    rarities: RARITIES,
    categories: [...new Set(cards.map((c) => c.category))],
    cards: cards.map((c) => ({
      id: c.id, message: c.message, emoji: c.emoji, background: c.background, category: c.category,
      rarity: c.rarity, rewardKhoai: c.rewardKhoai, active: c.active, sortOrder: c.sortOrder,
      draws: ownersByCard.get(c.id) ?? 0,
    })),
  });
}

// POST — tạo card mới.
export async function POST(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  const data = cleanCard(body);
  if (!data.message) return NextResponse.json({ error: "no-message", message: "Cần nội dung thẻ." }, { status: 400 });
  const card = await prisma.wicerCard.create({ data: data as { message: string } });
  return NextResponse.json({ ok: true, id: card.id });
}

// PATCH — sửa card. Body: { id, patch }
export async function PATCH(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { id?: string; patch?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  const id = String(body.id ?? "");
  if (!id || !body.patch) return NextResponse.json({ error: "missing" }, { status: 400 });
  const data = cleanCard(body.patch);
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "no-fields" }, { status: 400 });
  await prisma.wicerCard.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE — xoá card. Nếu đã có người sưu tầm → ẩn (active=false) để giữ bộ sưu tập của họ; nếu chưa ai lật → xoá hẳn.
export async function DELETE(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let id = "";
  try { id = String((await req.json()).id ?? ""); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  if (!id) return NextResponse.json({ error: "missing" }, { status: 400 });

  const draws = await prisma.cardDraw.count({ where: { cardId: id } });
  if (draws > 0) {
    await prisma.wicerCard.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, softDeleted: true, message: `Đã ẩn thẻ (còn ${draws} bản trong bộ sưu tập của thành viên nên không xoá hẳn).` });
  }
  await prisma.wicerCard.delete({ where: { id } });
  return NextResponse.json({ ok: true, softDeleted: false });
}
