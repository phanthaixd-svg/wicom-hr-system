import { NextRequest, NextResponse } from "next/server";
import { larkH5CodeToUser, isAllowedTenant, loginLarkUser } from "@/lib/lark";

export const dynamic = "force-dynamic";

// H5 免登: nhận login pre-auth code (từ tt.requestAuthCode khi app mở TRONG Lark),
// đổi lấy hồ sơ user, tạo session — không cần user bấm "Đăng nhập với Lark".
export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const code = body.code;
  if (!code) return NextResponse.json({ error: "no-code" }, { status: 400 });

  try {
    const user = await larkH5CodeToUser(code);
    if (!user.openId) return NextResponse.json({ error: "nouser" }, { status: 400 });
    if (!isAllowedTenant(user)) return NextResponse.json({ error: "tenant" }, { status: 403 });

    const next = await loginLarkUser(user);
    return NextResponse.json({ ok: true, next });
  } catch (e) {
    console.error("Lark silent login lỗi", e);
    return NextResponse.json({ error: "lark" }, { status: 500 });
  }
}
