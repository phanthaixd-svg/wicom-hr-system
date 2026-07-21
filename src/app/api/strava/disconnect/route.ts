import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getValidAccessToken } from "@/lib/strava";

export const dynamic = "force-dynamic";

// Ngừng kết nối Strava: thu hồi quyền phía Strava (best-effort) + đánh dấu revoked trong DB.
// Hoạt động đã đồng bộ vẫn giữ lại; hệ thống ngừng nhận hoạt động mới cho tới khi kết nối lại.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const acc = await prisma.stravaAccount.findUnique({ where: { employeeId: session.employeeId } });
  if (!acc || acc.revokedAt) return NextResponse.json({ ok: true, alreadyDisconnected: true });

  // Best-effort deauthorize phía Strava (không chặn nếu lỗi).
  try {
    const token = await getValidAccessToken(acc);
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.warn("[strava disconnect] deauthorize lỗi (bỏ qua):", e);
  }

  await prisma.stravaAccount.update({
    where: { employeeId: session.employeeId },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
