import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Thả / gỡ ❤️ cho một lời cảm ơn. Trả về trạng thái + số tim mới. Denormalize heartCount để xếp "được yêu thích".
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meId = session.employeeId;

  let thanksId = "";
  try { thanksId = String((await req.json()).thanksId ?? ""); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  if (!thanksId) return NextResponse.json({ error: "missing-id" }, { status: 400 });

  const gift = await prisma.thanksGift.findUnique({ where: { id: thanksId }, select: { id: true } });
  if (!gift) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.thanksHeart.findUnique({ where: { thanksId_employeeId: { thanksId, employeeId: meId } } });
    let hearted: boolean;
    if (existing) {
      await tx.thanksHeart.delete({ where: { id: existing.id } });
      hearted = false;
    } else {
      await tx.thanksHeart.create({ data: { thanksId, employeeId: meId } });
      hearted = true;
    }
    const count = await tx.thanksHeart.count({ where: { thanksId } });
    await tx.thanksGift.update({ where: { id: thanksId }, data: { heartCount: count } });
    return { hearted, count };
  });

  return NextResponse.json({ ok: true, ...result });
}
