import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { larkAuthorizeUrl } from "@/lib/lark";

// Bắt đầu đăng nhập Lark: sinh state chống CSRF, lưu cookie, chuyển hướng tới Lark.
export async function GET() {
  const state = crypto.randomUUID();
  (await cookies()).set("wm_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(larkAuthorizeUrl(state));
}
