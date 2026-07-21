import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

interface SubmitInput {
  kindKey?: string;
  name?: string;
  durationMin?: number;
  distanceKm?: number;
  occurredAt?: string; // ISO hoặc yyyy-mm-ddThh:mm
  note?: string;
  proofUrl?: string | null;
}

// Nhân sự gửi 1 hoạt động tay (môn Strava không có). Trạng thái: chờ duyệt (isFlagged=true, tiền=0).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let b: SubmitInput;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const kind = b.kindKey ? await prisma.activityKind.findUnique({ where: { key: b.kindKey } }) : null;
  if (!kind || !kind.active) return NextResponse.json({ error: "bad-kind" }, { status: 400 });

  // Chặn trên hợp lý (chống fat-finger / lạm dụng): ≤ 24h, ≤ 300km.
  const durationMin = Math.min(24 * 60, Math.max(0, Math.round(Number(b.durationMin) || 0)));
  const distanceKm = Math.min(300, Math.max(0, Number(b.distanceKm) || 0));
  if (durationMin <= 0 && distanceKm <= 0)
    return NextResponse.json({ error: "empty", message: "Cần nhập thời gian hoặc quãng đường" }, { status: 400 });

  // proofUrl CHỈ chấp nhận đường dẫn nội bộ /uploads/... (server sinh ra) — chặn "javascript:"/URL ngoài (stored XSS / SSRF).
  const proofUrl = typeof b.proofUrl === "string" && b.proofUrl.startsWith("/uploads/") ? b.proofUrl : null;
  if (kind.requireProof && !proofUrl)
    return NextResponse.json({ error: "proof-required", message: "Môn này cần tải bằng chứng hợp lệ" }, { status: 400 });

  // Thời điểm không có múi giờ (yyyy-mm-ddThh:mm) hiểu là giờ VN (+07:00), không phải giờ máy chủ.
  const occurredAt = b.occurredAt
    ? new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.occurredAt) ? `${b.occurredAt}:00+07:00` : b.occurredAt)
    : new Date();
  if (isNaN(occurredAt.getTime())) return NextResponse.json({ error: "bad-date" }, { status: 400 });
  if (occurredAt.getTime() > Date.now() + 60_000)
    return NextResponse.json({ error: "future-date", message: "Thời điểm không được ở tương lai" }, { status: 400 });

  const name = (b.name || "").trim().slice(0, 120) || kind.nameVi;
  const note = (b.note || "").trim().slice(0, 500) || null;

  const act = await prisma.activity.create({
    data: {
      employeeId: session.employeeId,
      source: "manual",
      kindKey: kind.key,
      type: "Other", // giữ enum môn Strava = Other; hiển thị theo kindKey
      name,
      distanceKm,
      movingTimeS: durationMin * 60,
      startDate: occurredAt,
      isManual: true,
      isFlagged: true, // chờ duyệt -> chưa quy đổi
      flagReason: "Chờ Admin duyệt (hoạt động gửi tay)",
      amountVnd: 0,
      proofUrl,
      note,
    },
  });

  return NextResponse.json({ ok: true, id: act.id });
}
