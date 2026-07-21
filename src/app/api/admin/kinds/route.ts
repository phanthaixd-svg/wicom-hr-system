import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { getAllKinds, slugifyKind } from "@/lib/kinds";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ kinds: await getAllKinds() });
}

interface KindInput {
  id?: string;
  key?: string;
  nameVi: string;
  icon?: string;
  mode: string;
  rateVnd: number;
  capPerDayVnd: number | null;
  requireProof?: boolean;
  active?: boolean;
  sortOrder?: number;
}

// Lưu (tạo/sửa) danh sách môn tự thêm.
export async function POST(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { kinds?: KindInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  let i = 0;
  for (const k of body.kinds ?? []) {
    const nameVi = (k.nameVi || "").trim();
    if (!nameVi) continue; // bỏ dòng trống
    if (!["km", "session"].includes(k.mode)) continue;
    const rate = Math.max(0, Math.round(Number(k.rateVnd) || 0));
    const cap = k.capPerDayVnd == null || k.capPerDayVnd === 0 ? null : Math.max(0, Math.round(k.capPerDayVnd));
    const icon = (k.icon || "✨").trim().slice(0, 8) || "✨";
    const active = k.active ?? true;
    const requireProof = k.requireProof ?? true;
    const sortOrder = Number.isFinite(k.sortOrder) ? Number(k.sortOrder) : i;

    if (k.id) {
      await prisma.activityKind.update({
        where: { id: k.id },
        data: { nameVi, icon, mode: k.mode, rateVnd: rate, capPerDayVnd: cap, requireProof, active, sortOrder },
      });
    } else {
      // Tạo mới: sinh key duy nhất từ tên.
      const base = slugifyKind(nameVi) || "mon";
      let key = base;
      let n = 2;
      while (await prisma.activityKind.findUnique({ where: { key } })) key = `${base}-${n++}`;
      await prisma.activityKind.create({
        data: { key, nameVi, icon, mode: k.mode, rateVnd: rate, capPerDayVnd: cap, requireProof, active, sortOrder },
      });
    }
    i++;
  }

  return NextResponse.json({ ok: true, kinds: await getAllKinds() });
}

// Xoá 1 môn (chỉ khi chưa có hoạt động gửi tay nào dùng nó — nếu có thì tắt thay vì xoá).
export async function DELETE(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing-id" }, { status: 400 });

  const kind = await prisma.activityKind.findUnique({ where: { id } });
  if (!kind) return NextResponse.json({ ok: true });

  const used = await prisma.activity.count({ where: { kindKey: kind.key } });
  if (used > 0) {
    // Đã có hoạt động dùng môn này -> tắt để giữ lịch sử, không xoá cứng.
    await prisma.activityKind.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, disabled: true, used });
  }
  await prisma.activityKind.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}
