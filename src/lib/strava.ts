import { prisma } from "./db";
import type { StravaAccount } from "@prisma/client";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";
const SCOPE = "activity:read_all,profile:read_all";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Thiếu biến môi trường ${key}`);
  return v;
}

// Bước 1: URL đưa nhân sự tới trang cấp quyền Strava. state = định danh phiên (đã ký).
export function stravaAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env("STRAVA_CLIENT_ID"),
    redirect_uri: `${env("APP_BASE_URL")}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number; firstname?: string; lastname?: string; profile?: string };
}

// Bước 4: đổi code lấy token.
export async function stravaExchangeCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange lỗi ${res.status}: ${await res.text()}`);
  return res.json();
}

async function refresh(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Strava refresh lỗi ${res.status}: ${await res.text()}`);
  return res.json();
}

// Trả về access_token còn hạn cho account; tự refresh + cập nhật DB nếu sắp hết (còn < 5 phút).
export async function getValidAccessToken(account: StravaAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (account.expiresAt - now > 300) return account.accessToken;

  const t = await refresh(account.refreshToken);
  await prisma.stravaAccount.update({
    where: { id: account.id },
    data: {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: t.expires_at,
    },
  });
  return t.access_token;
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  type: string;
  distance: number; // mét
  moving_time: number; // giây
  elapsed_time: number;
  start_date: string; // ISO
  manual: boolean;
  average_speed?: number; // m/s
  map?: { summary_polyline?: string | null; polyline?: string | null };
}

// Lấy chi tiết 1 hoạt động (gọi sau mỗi webhook create/update).
export async function fetchActivity(accessToken: string, id: string | number): Promise<StravaActivity> {
  const res = await fetch(`${API}/activities/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava getActivity ${id} lỗi ${res.status}: ${await res.text()}`);
  return res.json();
}

// Liệt kê hoạt động (dùng cho backfill / nạp lịch sử). afterEpoch: unix seconds.
export async function listActivities(
  accessToken: string,
  afterEpoch: number,
  page = 1,
  perPage = 100,
): Promise<StravaActivity[]> {
  const p = new URLSearchParams({
    after: String(afterEpoch),
    page: String(page),
    per_page: String(perPage),
  });
  const res = await fetch(`${API}/athlete/activities?${p.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava listActivities lỗi ${res.status}: ${await res.text()}`);
  return res.json();
}
