import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Bảo vệ trang dashboard và API dashboard: chưa đăng nhập -> đẩy về trang login.
// (Các trang server cũng tự guard bằng getSession; đây là lớp chặn sớm ở edge.)
export async function middleware(req: NextRequest) {
  const token = req.cookies.get("wm_session")?.value;
  const secret = process.env.SESSION_SECRET;

  let valid = false;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (valid) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*", "/admin/:path*", "/api/admin/:path*"],
};
