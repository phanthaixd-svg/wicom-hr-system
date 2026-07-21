import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { larkNotifyEnabled, sendLarkText } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

// GET — hàng đợi hoàn tất (pending trước, kèm 30 mục đã xử lý gần đây).
export async function GET() {
  if (!(await requireHR())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const pending = await prisma.fulfillment.findMany({
    where: { status: "pending" }, orderBy: { createdAt: "asc" },
    include: { employee: { select: { name: true, avatarUrl: true } } },
  });
  const recent = await prisma.fulfillment.findMany({
    where: { status: { in: ["fulfilled", "cancelled"] } }, orderBy: { fulfilledAt: "desc" }, take: 30,
    include: { employee: { select: { name: true, avatarUrl: true } } },
  });

  const shape = (f: (typeof pending)[number]) => ({
    id: f.id, kind: f.kind, title: f.title, khoai: f.khoai, status: f.status,
    counterpart: f.counterpart, hrNote: f.hrNote, createdAt: f.createdAt.toISOString(),
    fulfilledAt: f.fulfilledAt?.toISOString() ?? null,
    employee: { name: f.employee.name, avatarUrl: f.employee.avatarUrl },
  });

  return NextResponse.json({
    pending: pending.map(shape),
    recent: recent.map(shape),
    counts: { pending: pending.length },
  });
}

// PATCH — { id, action: "fulfill" | "cancel", hrNote? }
export async function PATCH(req: NextRequest) {
  const admin = await requireHR();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { id?: string; action?: string; hrNote?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }
  const id = String(body.id ?? "");
  const action = body.action;
  const hrNote = (body.hrNote ?? "").trim().slice(0, 500) || null;
  if (!id || (action !== "fulfill" && action !== "cancel")) return NextResponse.json({ error: "bad-args" }, { status: 400 });

  const f = await prisma.fulfillment.findUnique({ where: { id }, include: { employee: { select: { larkOpenId: true, larkNotifyReaction: true } } } });
  if (!f) return NextResponse.json({ error: "notfound" }, { status: 404 });
  if (f.status !== "pending") return NextResponse.json({ error: "already", message: "Mục này đã được xử lý." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.fulfillment.update({
      where: { id }, data: { status: action === "fulfill" ? "fulfilled" : "cancelled", hrNote, fulfilledById: admin.id, fulfilledAt: new Date() },
    });
    // Đồng bộ trạng thái Redemption gốc (nếu có) khi hoàn tất quà cá nhân.
    if (action === "fulfill" && f.refType === "Redemption" && f.refId) {
      await tx.redemption.update({ where: { id: f.refId }, data: { status: "fulfilled" } }).catch(() => {});
    }
    // Lưu ghi chú vào hồ sơ nhân sự (EmployeeNote) để tra cứu sau.
    if (hrNote) {
      await tx.employeeNote.create({ data: { employeeId: f.employeeId, authorId: admin.id, body: `[${f.kind}] ${f.title}: ${hrNote}` } });
    }
  });

  if (action === "fulfill" && larkNotifyEnabled() && f.employee.larkOpenId) {
    const msg = f.kind === "special"
      ? `🎁 Món quà Special Gift của bạn đã sẵn sàng! Liên hệ HR để nhận nhé. 💛`
      : f.kind === "individual"
        ? `🎁 Phần quà "${f.title}" bạn đổi đã được HR chuẩn bị xong!`
        : `🎉 Phần quà nhóm "${f.title}" đã được HR xử lý. Cảm ơn cả nhóm đã cùng góp!`;
    void sendLarkText(f.employee.larkOpenId, msg).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
