import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHR } from "@/lib/admin";
import { ATHLETIC_TITLES } from "@/lib/wicer";
import { adminSetBalance } from "@/lib/khoai";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null); // YYYY-MM-DD

// GET — danh sách toàn bộ nhân sự (bảng nhân viên gốc). Kèm cờ viewerIsAdmin để FE ẩn/hiện ô cấp quyền.
export async function GET() {
  const viewer = await requireHR();
  if (!viewer) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const emps = await prisma.employee.findMany({ orderBy: [{ leftAt: "asc" }, { name: "asc" }] });
  return NextResponse.json({
    viewerIsAdmin: viewer.isAdmin,
    titles: ATHLETIC_TITLES.map((t) => ({ key: t.key, name: t.name, icon: t.icon })),
    employees: emps.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      avatarUrl: e.avatarUrl,
      title: e.title ?? "",
      team: e.team ?? "",
      wiRole: e.wiRole,
      isAdmin: e.isAdmin,
      isHR: e.isHR,
      khoaiBalance: e.khoaiBalance,
      birthday: iso(e.birthday),
      joinedAt: iso(e.joinedAt ?? e.createdAt),
      leftAt: iso(e.leftAt),
      athleticTitles: e.athleticTitles,
    })),
  });
}

// PATCH — cập nhật 1 nhân sự. Body: { id, patch: {...} }
export async function PATCH(req: NextRequest) {
  const actor = await requireHR();
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { id?: string; patch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const { id, patch } = body;
  if (!id || !patch) return NextResponse.json({ error: "missing" }, { status: 400 });

  // Chỉ ADMIN thật mới được cấp/thu quyền (isAdmin/isHR) — HR không tự nâng quyền cho người khác.
  if (!actor.isAdmin && ("isAdmin" in patch || "isHR" in patch)) {
    return NextResponse.json({ error: "forbidden-role", message: "Chỉ Admin mới cấp được quyền Admin/HR." }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (typeof patch.name === "string" && patch.name.trim()) data.name = patch.name.trim();
  if (typeof patch.title === "string") data.title = patch.title.trim() || null;
  if (typeof patch.team === "string") data.team = patch.team.trim() || null;
  if (patch.wiRole === "staff" || patch.wiRole === "leader") data.wiRole = patch.wiRole;
  if (actor.isAdmin && typeof patch.isAdmin === "boolean") data.isAdmin = patch.isAdmin;
  if (actor.isAdmin && typeof patch.isHR === "boolean") data.isHR = patch.isHR;
  // Số dư khoai đi qua ledger (adminSetBalance) — KHÔNG set trực tiếp để giữ audit trail.
  const khoaiTarget = typeof patch.khoaiBalance === "number" && patch.khoaiBalance >= 0 ? Math.round(patch.khoaiBalance) : null;
  for (const f of ["birthday", "joinedAt", "leftAt"] as const) {
    if (f in patch) {
      const v = patch[f];
      // Lưu mốc 00:00 UTC để round-trip đúng ngày (đọc lại bằng toISOString) và không lệch múi giờ VN.
      data[f] = v ? new Date(String(v) + "T00:00:00.000Z") : null;
    }
  }
  if (Array.isArray(patch.athleticTitles)) {
    const valid = new Set(ATHLETIC_TITLES.map((t) => t.key));
    data.athleticTitles = (patch.athleticTitles as unknown[]).map(String).filter((k) => valid.has(k));
  }

  if (Object.keys(data).length === 0 && khoaiTarget === null) return NextResponse.json({ error: "no-fields" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) await tx.employee.update({ where: { id }, data });
    if (khoaiTarget !== null) await adminSetBalance(tx, id, khoaiTarget, actor.id, "HR chỉnh số dư");
  });
  return NextResponse.json({ ok: true });
}
