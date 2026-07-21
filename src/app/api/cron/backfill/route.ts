import { NextRequest, NextResponse } from "next/server";
import { backfillAll } from "@/lib/backfill";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // giây (điều chỉnh theo giới hạn hosting)

// Cron đối soát dự phòng: gọi định kỳ (vd. mỗi đêm) để bù các event webhook bị lỡ.
// Bảo vệ bằng header: Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") ?? "3");
  const result = await backfillAll(days);
  return NextResponse.json({ ok: true, ...result });
}
