import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { stravaAuthorizeUrl } from "@/lib/strava";

// Bắt đầu cấp quyền Strava. Bắt buộc đã đăng nhập Lark trước.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/", req.url));

  const state = crypto.randomUUID();
  (await cookies()).set("wm_strava_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(stravaAuthorizeUrl(state));
}
