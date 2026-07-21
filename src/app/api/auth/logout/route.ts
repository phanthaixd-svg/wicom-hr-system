import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

// Chỉ nhận POST — tránh bị đăng xuất ép qua <img src>/điều hướng cross-site (CSRF logout).
export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
