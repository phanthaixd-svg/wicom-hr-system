import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// ⚠️ DEV ONLY — đăng nhập nhanh bằng 1 nhân sự seed để test ở local, KHÔNG cần Lark.
// Tự chặn cứng trên production (Vercel NODE_ENV=production) → không tồn tại trên staging/prod.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.redirect(new URL("/dev", req.url));

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return new NextResponse("Không tìm thấy nhân sự", { status: 404 });

  await createSession({ employeeId: emp.id, name: emp.name, isAdmin: emp.isAdmin });
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
