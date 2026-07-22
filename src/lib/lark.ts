// Lark / Larksuite OAuth 2.0 (luồng authorization code chuẩn v2).
// Endpoint mặc định cho vùng quốc tế (larksuite.com); nếu Wicom dùng Feishu (feishu.cn)
// thì đổi các biến LARK_*_URL trong .env. Xác nhận lại trong Lark Developer Console.

import { prisma } from "./db";
import { createSession } from "./session";
import { isBootstrapAdminEmail } from "./admin";

// Base cho các Open API (/open-apis/...); trùng với LARK_API_BASE dùng cho bot.
const API_BASE = process.env.LARK_API_BASE || "https://open.larksuite.com";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Thiếu biến môi trường ${key}`);
  return v;
}

const AUTHORIZE_URL =
  process.env.LARK_AUTHORIZE_URL || "https://accounts.larksuite.com/open-apis/authen/v1/authorize";
const TOKEN_URL =
  process.env.LARK_TOKEN_URL || "https://passport.larksuite.com/suite/passport/oauth/token";
const USERINFO_URL =
  process.env.LARK_USERINFO_URL || "https://passport.larksuite.com/suite/passport/oauth/userinfo";
// scope tối thiểu để lấy hồ sơ; có thể thêm 'contact:user.email:readonly' để chắc chắn có email.
const SCOPE = process.env.LARK_SCOPE || "contact:user.base:readonly contact:user.email:readonly";

export function larkAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env("LARK_CLIENT_ID"),
    redirect_uri: `${env("APP_BASE_URL")}/api/auth/lark/callback`,
    response_type: "code",
    state,
    scope: SCOPE,
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

export interface LarkTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function larkExchangeCode(code: string): Promise<LarkTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env("LARK_CLIENT_ID"),
    client_secret: env("LARK_CLIENT_SECRET"),
    code,
    redirect_uri: `${env("APP_BASE_URL")}/api/auth/lark/callback`,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Lark token exchange lỗi ${res.status}: ${await res.text()}`);
  }
  const j = await res.json();
  const accessToken = j.access_token;
  if (!accessToken) throw new Error(`Lark không trả access_token: ${JSON.stringify(j)}`);
  return {
    accessToken,
    refreshToken: j.refresh_token,
    expiresIn: j.expires_in,
  };
}

export interface LarkUser {
  openId: string;
  unionId: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  tenantKey: string | null;
}

export async function larkUserInfo(accessToken: string): Promise<LarkUser> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Lark userinfo lỗi ${res.status}: ${await res.text()}`);
  }
  const j = await res.json();
  // Endpoint có thể trả trực tiếp hoặc bọc trong { data: {...} } tuỳ phiên bản.
  const d = j.data ?? j;
  return {
    openId: d.open_id ?? d.sub ?? "",
    unionId: d.union_id ?? null,
    name: d.name ?? d.en_name ?? "Nhân sự Wicom",
    email: d.email ?? d.enterprise_email ?? null,
    avatarUrl: d.avatar_url ?? d.picture ?? d.avatar_big ?? null,
    tenantKey: d.tenant_key ?? null,
  };
}

// Nếu cấu hình LARK_TENANT_KEY, chỉ chấp nhận user cùng tenant với Wicom.
export function isAllowedTenant(user: LarkUser): boolean {
  const required = process.env.LARK_TENANT_KEY;
  if (!required) return true; // không siết -> cho qua
  if (!user.tenantKey) return true; // userinfo không trả tenant -> không chặn nhầm
  return user.tenantKey === required;
}

// Tạo/khởi tạo nhân sự từ hồ sơ Lark + tạo session. Dùng chung cho cả OAuth web lẫn H5免登.
// Trả về đường dẫn nên điều hướng tiếp (đã kết nối Strava -> /dashboard, chưa -> /connect).
export async function loginLarkUser(user: LarkUser): Promise<string> {
  const bootstrapAdmin = isBootstrapAdminEmail(user.email);
  const employee = await prisma.employee.upsert({
    where: { larkOpenId: user.openId },
    create: {
      larkOpenId: user.openId,
      larkUnionId: user.unionId,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isAdmin: bootstrapAdmin,
    },
    update: {
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      lastLogin: new Date(),
      ...(bootstrapAdmin ? { isAdmin: true } : {}),
    },
    include: { stravaAccount: true },
  });
  await createSession({ employeeId: employee.id, name: employee.name, isAdmin: employee.isAdmin });
  return employee.stravaAccount && !employee.stravaAccount.revokedAt ? "/dashboard" : "/connect";
}

// ── H5 免登 (đăng nhập ngầm khi app mở trong Lark) ──
// app_access_token: cần để đổi login pre-auth code lấy hồ sơ user.
async function getAppAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/open-apis/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env("LARK_CLIENT_ID"), app_secret: env("LARK_CLIENT_SECRET") }),
  });
  const j = await res.json();
  if (j.code !== 0 || !j.app_access_token) {
    throw new Error(`app_access_token lỗi: ${j.code} ${j.msg}`);
  }
  return j.app_access_token as string;
}

// Đổi login pre-auth code (từ tt.requestAuthCode trong Lark) -> hồ sơ user.
export async function larkH5CodeToUser(code: string): Promise<LarkUser> {
  const appToken = await getAppAccessToken();
  const res = await fetch(`${API_BASE}/open-apis/authen/v1/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${appToken}` },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
  });
  const j = await res.json();
  if (j.code !== 0 || !j.data) {
    throw new Error(`authen access_token lỗi: ${j.code} ${j.msg}`);
  }
  const d = j.data;
  return {
    openId: d.open_id ?? "",
    unionId: d.union_id ?? null,
    name: d.name ?? d.en_name ?? "Nhân sự Wicom",
    email: d.email ?? d.enterprise_email ?? null,
    avatarUrl: d.avatar_url ?? d.avatar_big ?? null,
    tenantKey: d.tenant_key ?? null,
  };
}
