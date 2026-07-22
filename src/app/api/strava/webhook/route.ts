import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getValidAccessToken, fetchActivity } from "@/lib/strava";
import { upsertActivity, deleteActivity } from "@/lib/ingest";
import { larkNotifyEnabled, notifyNewActivity } from "@/lib/larkNotify";
import { revalidateBoards } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: Strava gọi để xác thực subscription -> echo lại hub.challenge trong <2 giây.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verify = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verify === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  updates?: Record<string, string>;
}

// POST: nhận event. Trả 200 NGAY, xử lý ở after() để không vượt 2 giây.
export async function POST(req: NextRequest) {
  let event: StravaEvent;
  try {
    event = (await req.json()) as StravaEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  after(() => processEvent(event));
  return NextResponse.json({ received: true });
}

async function processEvent(ev: StravaEvent): Promise<void> {
  try {
    const ownerId = String(ev.owner_id);

    // Nhân sự rút quyền -> đánh dấu revoked, dừng đọc dữ liệu.
    if (ev.object_type === "athlete") {
      if (ev.updates?.authorized === "false") {
        await prisma.stravaAccount.updateMany({
          where: { athleteId: ownerId },
          data: { revokedAt: new Date() },
        });
      }
      return;
    }

    if (ev.object_type !== "activity") return;

    const account = await prisma.stravaAccount.findUnique({ where: { athleteId: ownerId } });
    if (!account || account.revokedAt) return;

    if (ev.aspect_type === "delete") {
      // Chỉ xoá hoạt động THUỘC VỀ chủ tài khoản của owner_id này (chống payload giả mạo xoá dữ liệu người khác).
      await deleteActivity(String(ev.object_id), account.employeeId);
      revalidateBoards(); // hoạt động bị xoá → làm mới bảng tổng
      return;
    }

    // create hoặc update -> lấy chi tiết mới nhất rồi upsert.
    const token = await getValidAccessToken(account);
    const activity = await fetchActivity(token, ev.object_id);
    const result = await upsertActivity(account.employeeId, activity);
    revalidateBoards(); // hoạt động mới/cập nhật từ Strava → làm mới bảng tổng

    // B1 — chỉ bắn notify khi hoạt động THẬT SỰ MỚI (create + chưa từng có), không bắn khi update/backfill.
    if (ev.aspect_type === "create" && result.isNew && larkNotifyEnabled()) {
      const emp = await prisma.employee.findUnique({
        where: { id: account.employeeId },
        select: { larkOpenId: true, larkNotifyActivity: true },
      });
      if (emp?.larkOpenId && emp.larkNotifyActivity) {
        await notifyNewActivity(emp.larkOpenId, {
          activityName: result.name,
          distanceKm: result.distanceKm,
          amountVnd: result.amountVnd,
          activityId: result.id,
        });
      }
    }
  } catch (e) {
    console.error("Xử lý webhook lỗi", e);
  }
}
