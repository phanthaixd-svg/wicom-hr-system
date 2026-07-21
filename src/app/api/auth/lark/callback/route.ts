import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { larkExchangeCode, larkUserInfo, isAllowedTenant } from "@/lib/lark";
import { isBootstrapAdminEmail } from "@/lib/admin";

// Lark redirect về đây kèm ?code&state. Đổi code lấy hồ sơ -> tạo/đăng nhập nhân sự.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (await cookies()).get("wm_oauth_state")?.value;

  if (!code || !state || state !== saved) {
    return NextResponse.redirect(new URL("/?error=state", req.url));
  }

  try {
    const tokens = await larkExchangeCode(code);
    const user = await larkUserInfo(tokens.accessToken);

    if (!user.openId) {
      return NextResponse.redirect(new URL("/?error=nouser", req.url));
    }
    if (!isAllowedTenant(user)) {
      return NextResponse.redirect(new URL("/?error=tenant", req.url));
    }

    // Bootstrap admin qua env ADMIN_EMAILS: chỉ NÂNG lên admin, không tự hạ quyền (giữ admin cấp tay).
    const bootstrapAdmin = isBootstrapAdminEmail(user.email);

    const employee = await prisma.employee.upsert({
      where: { larkOpenId: user.openId },
      create: {
        larkOpenId: user.openId,
        larkUnionId: user.unionId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: bootstrapAdmin,
      },
      update: {
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        lastLogin: new Date(),
        ...(bootstrapAdmin ? { isAdmin: true } : {}),
      },
      include: { stravaAccount: true },
    });

    await createSession({
      employeeId: employee.id,
      name: employee.name,
      isAdmin: employee.isAdmin,
    });

    // Chưa kết nối Strava -> đưa qua trang cấp quyền; đã kết nối -> vào dashboard.
    const next = employee.stravaAccount && !employee.stravaAccount.revokedAt ? "/dashboard" : "/connect";
    return NextResponse.redirect(new URL(next, req.url));
  } catch (e) {
    console.error("Lark callback error", e);
    return NextResponse.redirect(new URL("/?error=lark", req.url));
  }
}
