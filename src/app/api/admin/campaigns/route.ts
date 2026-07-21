import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";

export const dynamic = "force-dynamic";

const d = (x: Date) => x.toISOString().slice(0, 10);

function serialize(c: {
  id: string; name: string; description: string | null; goalVnd: bigint;
  startDate: Date; endDate: Date; active: boolean;
}) {
  return {
    id: c.id, name: c.name, description: c.description ?? "",
    goalVnd: Number(c.goalVnd), startDate: d(c.startDate), endDate: d(c.endDate), active: c.active,
  };
}

export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await prisma.campaign.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({ campaigns: rows.map(serialize) });
}

interface Body {
  id?: string;
  name?: string;
  description?: string;
  goalVnd?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

// Tạo chiến dịch mới
export async function POST(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json()) as Body;
  if (!b.name || !b.startDate || !b.endDate) {
    return NextResponse.json({ error: "Thiếu tên hoặc ngày" }, { status: 400 });
  }
  const created = await prisma.$transaction(async (tx) => {
    if (b.active) await tx.campaign.updateMany({ data: { active: false } });
    return tx.campaign.create({
      data: {
        name: b.name!,
        description: b.description || null,
        goalVnd: BigInt(Math.max(0, Math.round(b.goalVnd || 0))),
        startDate: new Date(b.startDate!),
        endDate: new Date(b.endDate!),
        active: Boolean(b.active),
      },
    });
  });
  return NextResponse.json({ ok: true, campaign: serialize(created) });
}

// Cập nhật chiến dịch (kể cả đặt làm chiến dịch đang chạy)
export async function PATCH(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json()) as Body;
  if (!b.id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    if (b.active) {
      await tx.campaign.updateMany({ where: { id: { not: b.id } }, data: { active: false } });
    }
    return tx.campaign.update({
      where: { id: b.id },
      data: {
        ...(b.name != null ? { name: b.name } : {}),
        ...(b.description != null ? { description: b.description || null } : {}),
        ...(b.goalVnd != null ? { goalVnd: BigInt(Math.max(0, Math.round(b.goalVnd))) } : {}),
        ...(b.startDate ? { startDate: new Date(b.startDate) } : {}),
        ...(b.endDate ? { endDate: new Date(b.endDate) } : {}),
        ...(b.active != null ? { active: b.active } : {}),
      },
    });
  });
  return NextResponse.json({ ok: true, campaign: serialize(updated) });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
