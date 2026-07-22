import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { larkExchangeCode, larkUserInfo, isAllowedTenant, loginLarkUser } from "@/lib/lark";

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

    const next = await loginLarkUser(user);
    return NextResponse.redirect(new URL(next, req.url));
  } catch (e) {
    console.error("Lark callback error", e);
    return NextResponse.redirect(new URL("/?error=lark", req.url));
  }
}
