import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { stravaExchangeCode } from "@/lib/strava";
import { backfillAccount } from "@/lib/backfill";

// Strava redirect về đây kèm ?code&state&scope. Lưu liên kết + nạp lịch sử 90 ngày.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope") ?? "";
  const saved = (await cookies()).get("wm_strava_state")?.value;

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/connect?error=denied", req.url));
  }
  if (!code || !state || state !== saved) {
    return NextResponse.redirect(new URL("/connect?error=state", req.url));
  }
  // Cần ít nhất quyền đọc hoạt động.
  if (!scope.includes("activity:read")) {
    return NextResponse.redirect(new URL("/connect?error=scope", req.url));
  }

  try {
    const t = await stravaExchangeCode(code);
    const athleteId = String(t.athlete?.id ?? "");
    if (!athleteId) return NextResponse.redirect(new URL("/connect?error=noathlete", req.url));

    const account = await prisma.stravaAccount.upsert({
      where: { employeeId: session.employeeId },
      create: {
        employeeId: session.employeeId,
        athleteId,
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        expiresAt: t.expires_at,
        scope,
      },
      update: {
        athleteId,
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        expiresAt: t.expires_at,
        scope,
        revokedAt: null,
      },
    });

    // Nạp TOÀN BỘ lịch sử (lifetime) sau khi đã trả redirect (không bắt user chờ).
    // afterEpoch = 1 => lấy từ hoạt động đầu tiên. Tiền chỉ quy đổi từ mốc conversionFromDate.
    after(async () => {
      try {
        await backfillAccount(account, 1);
      } catch (e) {
        console.error("Backfill lần đầu lỗi", e);
      }
    });

    return NextResponse.redirect(new URL("/dashboard?connected=1", req.url));
  } catch (e) {
    console.error("Strava callback error", e);
    return NextResponse.redirect(new URL("/connect?error=strava", req.url));
  }
}
