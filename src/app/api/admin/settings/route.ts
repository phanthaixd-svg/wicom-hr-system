import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { recomputeAllAmounts } from "@/lib/recompute";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await prisma.setting.findUnique({ where: { key: "conversionFromDate" } });
  return NextResponse.json({ conversionFromDate: s?.value ?? "" });
}

// Lưu cài đặt chung. Đổi mốc quy đổi -> tính lại toàn bộ quỹ.
export async function POST(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json()) as { conversionFromDate?: string };
  const value = body.conversionFromDate || "";

  if (value) {
    await prisma.setting.upsert({
      where: { key: "conversionFromDate" },
      create: { key: "conversionFromDate", value },
      update: { value },
    });
  } else {
    await prisma.setting.deleteMany({ where: { key: "conversionFromDate" } });
  }

  const recomputed = await recomputeAllAmounts();
  return NextResponse.json({ ok: true, recomputed });
}
