// Gửi tin nhắn chủ động qua Lark (DM cho từng nhân sự bằng open_id đã lưu khi đăng nhập SSO).
// Dùng tenant_access_token của Lark app (app_id/app_secret = LARK_CLIENT_ID/LARK_CLIENT_SECRET).
//
// YÊU CẦU khi go-live: trong Lark Developer Console, cấp cho app quyền:
//   - im:message  (gửi tin nhắn)
//   - im:message:send_as_bot
// và publish app cho tenant Wicom. Trước khi có quyền, mọi hàm ở đây tự no-op êm (không ném lỗi).
//
// Vùng: quốc tế (larksuite) mặc định; Feishu (feishu.cn) -> đặt LARK_API_BASE=https://open.feishu.cn

const API_BASE = process.env.LARK_API_BASE || "https://open.larksuite.com";

// Bật/tắt toàn cục. Mặc định: bật nếu có app credentials. Đặt LARK_NOTIFY_ENABLED=false để tắt.
export function larkNotifyEnabled(): boolean {
  if (process.env.LARK_NOTIFY_ENABLED === "false") return false;
  return Boolean(process.env.LARK_CLIENT_ID && process.env.LARK_CLIENT_SECRET);
}

// ── tenant_access_token (cache trong memory tới trước khi hết hạn) ──
let cachedToken: { token: string; expireAt: number } | null = null;

async function getTenantAccessToken(): Promise<string | null> {
  const appId = process.env.LARK_CLIENT_ID;
  const appSecret = process.env.LARK_CLIENT_SECRET;
  if (!appId || !appSecret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expireAt > now + 30_000) return cachedToken.token;

  try {
    const res = await fetch(`${API_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const j = await res.json();
    if (j.code !== 0 || !j.tenant_access_token) {
      console.warn("[larkNotify] không lấy được tenant_access_token:", j.code, j.msg);
      return null;
    }
    cachedToken = { token: j.tenant_access_token, expireAt: now + (j.expire ?? 7200) * 1000 };
    return cachedToken.token;
  } catch (e) {
    console.warn("[larkNotify] lỗi lấy token:", e);
    return null;
  }
}

// Gửi 1 tin nhắn text tới 1 open_id. Trả về true nếu Lark nhận.
export async function sendLarkText(openId: string, text: string): Promise<boolean> {
  if (!larkNotifyEnabled() || !openId) return false;
  const token = await getTenantAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/open-apis/im/v1/messages?receive_id_type=open_id`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    });
    const j = await res.json();
    if (j.code !== 0) {
      console.warn("[larkNotify] gửi text lỗi:", j.code, j.msg);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[larkNotify] lỗi gửi text:", e);
    return false;
  }
}

// Gửi 1 interactive card (đẹp hơn text, có nút mở hoạt động). Fallback về text nếu lỗi.
export async function sendLarkCard(openId: string, card: unknown): Promise<boolean> {
  if (!larkNotifyEnabled() || !openId) return false;
  const token = await getTenantAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/open-apis/im/v1/messages?receive_id_type=open_id`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receive_id: openId, msg_type: "interactive", content: JSON.stringify(card) }),
    });
    const j = await res.json();
    if (j.code !== 0) {
      console.warn("[larkNotify] gửi card lỗi:", j.code, j.msg);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[larkNotify] lỗi gửi card:", e);
    return false;
  }
}

function activityUrl(activityId: string): string {
  const base = process.env.APP_BASE_URL || "";
  return `${base}/activity/${activityId}`;
}

// WiThanks: bắn cho người NHẬN khoai.
export async function notifyThanksReceived(openId: string, o: { giverName: string; khoai: number; message: string; totalBalance: number }): Promise<boolean> {
  return sendLarkText(
    openId,
    `🥔 Bạn vừa nhận ${o.khoai} củ khoai từ ${o.giverName}:\n"${o.message}"\nTổng khoai bạn hiện có: ${o.totalBalance} củ.`,
  );
}

// WiThanks: bắn cho người GỬI khoai (xác nhận + số dư hạn mức còn lại).
export async function notifyThanksGiven(openId: string, o: { receiverName: string; khoai: number; message: string; weekRemaining: number | null; monthRemaining: number | null }): Promise<boolean> {
  const rem =
    o.weekRemaining != null
      ? `Khoai còn lại: ${o.weekRemaining} củ tuần này, ${o.monthRemaining} củ tháng này.`
      : `Khoai còn lại tháng này: ${o.monthRemaining} củ.`;
  return sendLarkText(openId, `🥔 Bạn vừa tặng ${o.khoai} củ khoai cho ${o.receiverName}:\n"${o.message}"\n${rem}`);
}

// Bắn cho chủ hoạt động khi có người bình luận.
export async function notifyComment(opts: { ownerOpenId: string; commenterName: string; activityName: string; activityId: string; body: string }): Promise<boolean> {
  const url = activityUrl(opts.activityId);
  const snippet = opts.body.length > 80 ? opts.body.slice(0, 80) + "…" : opts.body;
  return sendLarkText(
    opts.ownerOpenId,
    `💬 ${opts.commenterName} vừa bình luận hoạt động "${opts.activityName}" của bạn:\n"${snippet}"\n${url}`,
  );
}

// Card thông báo có người thả cảm xúc.
export async function notifyReaction(opts: {
  ownerOpenId: string;
  reactorName: string;
  emoji: string;
  activityName: string;
  activityId: string;
}): Promise<boolean> {
  const { ownerOpenId, reactorName, emoji, activityName, activityId } = opts;
  const url = activityUrl(activityId);
  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: "turquoise",
      title: { tag: "plain_text", content: `${emoji} Bạn nhận được một cảm xúc!` },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**${reactorName}** vừa thả ${emoji} cho hoạt động **${activityName}** của bạn trên **Move for Wishare**.`,
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "Xem hoạt động" },
            type: "primary",
            url,
          },
        ],
      },
    ],
  };
  const ok = await sendLarkCard(ownerOpenId, card);
  if (ok) return true;
  // Fallback text nếu card không gửi được.
  return sendLarkText(
    ownerOpenId,
    `${emoji} ${reactorName} vừa thả cảm xúc cho hoạt động "${activityName}" của bạn trên Move for Wishare.\n${url}`,
  );
}
