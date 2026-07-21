import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getActiveKinds } from "@/lib/kinds";

export const dynamic = "force-dynamic";

// Danh mục hoạt động tự thêm đang bật — cho form gửi tay & chọn bộ môn khi đặt mục tiêu.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const kinds = await getActiveKinds();
  return NextResponse.json({
    kinds: kinds.map((k) => ({
      key: k.key,
      nameVi: k.nameVi,
      icon: k.icon,
      mode: k.mode,
      rateVnd: k.rateVnd,
      requireProof: k.requireProof,
    })),
  });
}
