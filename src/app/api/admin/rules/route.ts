import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { recomputeAllAmounts } from "@/lib/recompute";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rules = await prisma.conversionRule.findMany();
  return NextResponse.json({ rules });
}

interface RuleInput {
  activityType: string;
  mode: string;
  rateVnd: number;
  capPerDayVnd: number | null;
  active: boolean;
}

// Lưu bảng tỷ lệ -> tính lại toàn bộ quỹ.
export async function POST(req: NextRequest) {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { rules?: RuleInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  for (const r of body.rules ?? []) {
    if (!["km", "activity"].includes(r.mode)) continue;
    const rate = Math.max(0, Math.round(Number(r.rateVnd) || 0));
    const cap = r.capPerDayVnd == null || r.capPerDayVnd === 0 ? null : Math.max(0, Math.round(r.capPerDayVnd));
    await prisma.conversionRule.upsert({
      where: { activityType: r.activityType },
      create: { activityType: r.activityType, mode: r.mode, rateVnd: rate, capPerDayVnd: cap, active: Boolean(r.active) },
      update: { mode: r.mode, rateVnd: rate, capPerDayVnd: cap, active: Boolean(r.active) },
    });
  }

  const updated = await recomputeAllAmounts();
  return NextResponse.json({ ok: true, recomputed: updated });
}
