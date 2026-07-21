import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { getKindMap, computeKindAmount } from "@/lib/kinds";
import { getConversionFromDate } from "@/lib/conversion";

export const dynamic = "force-dynamic";

// Danh sách hoạt động gửi tay chờ duyệt (mới nhất trước) + số đã xử lý gần đây.
export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const kindMap = await getKindMap();
  const pending = await prisma.activity.findMany({
    where: { source: "manual", reviewedAt: null },
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true, team: true, avatarUrl: true } } },
  });
  const recent = await prisma.activity.findMany({
    where: { source: "manual", reviewedAt: { not: null } },
    orderBy: { reviewedAt: "desc" },
    take: 12,
    include: { employee: { select: { name: true } } },
  });

  const shape = (a: (typeof pending)[number]) => {
    const k = a.kindKey ? kindMap[a.kindKey] : undefined;
    return {
      id: a.id,
      name: a.name,
      kindKey: a.kindKey,
      kindName: k?.nameVi ?? "Khác",
      icon: k?.icon ?? "✨",
      mode: k?.mode ?? "session",
      rateVnd: k?.rateVnd ?? 0,
      distanceKm: a.distanceKm,
      durationMin: Math.round(a.movingTimeS / 60),
      occurredAt: a.startDate.toISOString(),
      note: a.note,
      proofUrl: a.proofUrl,
      who: { name: a.employee.name, team: a.employee.team ?? "Wicom", avatarUrl: a.employee.avatarUrl },
      // tiền dự kiến nếu duyệt
      estimateVnd: computeKindAmount(k, a.distanceKm),
    };
  };

  return NextResponse.json({
    pending: pending.map(shape),
    recent: recent.map((a) => ({
      id: a.id,
      name: a.name,
      who: a.employee.name,
      rejected: Boolean(a.rejectedAt),
      amountVnd: a.amountVnd,
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
    })),
  });
}

// Duyệt / từ chối 1 hoạt động gửi tay.
export async function POST(req: NextRequest) {
  const admin = await requireHR();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let b: { id?: string; action?: string; reason?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!b.id || !["approve", "reject"].includes(b.action ?? ""))
    return NextResponse.json({ error: "bad-input" }, { status: 400 });

  const act = await prisma.activity.findUnique({ where: { id: b.id } });
  if (!act || act.source !== "manual") return NextResponse.json({ error: "notfound" }, { status: 404 });

  const now = new Date();

  if (b.action === "reject") {
    await prisma.activity.update({
      where: { id: act.id },
      data: {
        isFlagged: true, // vẫn ghi nhận hoạt động, không quy đổi
        amountVnd: 0,
        reviewedAt: now,
        reviewedById: admin.id,
        rejectedAt: now,
        rejectReason: (b.reason || "").slice(0, 300) || null,
        flagReason: "Đã từ chối quy đổi",
      },
    });
    return NextResponse.json({ ok: true, action: "reject" });
  }

  // approve -> tính tiền theo kind, tôn trọng mốc quy đổi chung.
  const kindMap = await getKindMap();
  const kind = act.kindKey ? kindMap[act.kindKey] : undefined;
  const cutoff = await getConversionFromDate();
  const beforeCutoff = cutoff ? act.startDate < cutoff : false;
  const amountVnd = beforeCutoff ? 0 : computeKindAmount(kind, act.distanceKm);

  await prisma.activity.update({
    where: { id: act.id },
    data: {
      isFlagged: false,
      amountVnd,
      reviewedAt: now,
      reviewedById: admin.id,
      rejectedAt: null,
      rejectReason: null,
      flagReason: null,
    },
  });
  return NextResponse.json({ ok: true, action: "approve", amountVnd });
}
