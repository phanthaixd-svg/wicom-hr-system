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

// Chế độ dry-run: in nội dung notification ra terminal (bật bằng LARK_NOTIFY_DEBUG=true trong .env local).
// Dùng để test logic + câu chữ ở local mà không cần Lark gửi thật.
export function larkDebug(): boolean {
  return process.env.LARK_NOTIFY_DEBUG === "true";
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
  if (larkDebug()) console.log(`\n📨 [LARK-DEBUG] text → open_id ${openId}\n${text}\n`);
  if (!larkNotifyEnabled() || !openId) return larkDebug();
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
  if (larkDebug()) console.log(`\n🃏 [LARK-DEBUG] card → open_id ${openId}\n${JSON.stringify(card, null, 2)}\n`);
  if (!larkNotifyEnabled() || !openId) return larkDebug();
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

// ── Helpers dùng chung cho card ─────────────────────────────────────────────
const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");

function appUrl(path: string): string {
  const base = process.env.APP_BASE_URL || "";
  return `${base}${path}`;
}
function activityUrl(activityId: string): string {
  return appUrl(`/activity/${activityId}`);
}
// Mở app tại 1 tab cụ thể (deep-link). AppShell đọc ?tab=… để chọn tab.
function tabUrl(tab: "home" | "move" | "withanks" | "wigrow"): string {
  return appUrl(`/dashboard?tab=${tab}`);
}

// ── Bộ dựng phần tử card (khớp thiết kế đã duyệt) ────────────────────────────
type El = Record<string, unknown>;
const mdEl = (content: string): El => ({ tag: "div", text: { tag: "lark_md", content } });
const hrEl = (): El => ({ tag: "hr" });
const fieldsEl = (a: string, b: string): El => ({
  tag: "div",
  fields: [
    { is_short: true, text: { tag: "lark_md", content: a } },
    { is_short: true, text: { tag: "lark_md", content: b } },
  ],
});
const noteEl = (content: string): El => ({ tag: "note", elements: [{ tag: "plain_text", content }] });
const btnEl = (text: string, url: string): El => ({
  tag: "action",
  actions: [{ tag: "button", text: { tag: "plain_text", content: text }, type: "primary", url }],
});
const mkCard = (color: string, title: string, elements: El[]): unknown => ({
  config: { wide_screen_mode: true },
  header: { template: color, title: { tag: "plain_text", content: title } },
  elements,
});
const BRAND = "🌱 Wicer · WiThanks";

// Gửi card, nếu Lark từ chối thì fallback về text.
async function sendCard(openId: string, card: unknown, fallbackText: string): Promise<boolean> {
  const ok = await sendLarkCard(openId, card);
  if (ok) return true;
  return sendLarkText(openId, fallbackText);
}

type Kind = "thanks" | "super" | "special";

// A1 — WiThanks: bắn cho người NHẬN khoai.
export async function notifyThanksReceived(openId: string, o: { giverName: string; khoai: number; message: string; totalBalance: number; kind: Kind; valueTagLabel?: string }): Promise<boolean> {
  if (o.kind === "special") {
    const card = mkCard("carmine", "🎁 Bạn nhận được Special Gift!", [
      mdEl(`**${o.giverName}** vừa dành tặng bạn một **Special Gift** — món quà thật + khoảnh khắc gặp nhau.`),
      mdEl(`💬 *"${o.message}"*`),
      hrEl(),
      noteEl("🎁 HR sẽ liên hệ để trao món quà thật tới bạn."),
      btnEl("Xem WiThanks →", tabUrl("withanks")),
    ]);
    return sendCard(openId, card, `🎁 ${o.giverName} vừa tặng bạn một Special Gift: "${o.message}". HR sẽ liên hệ trao quà thật. 💛`);
  }
  const isSuper = o.kind === "super";
  const giaTri = o.valueTagLabel
    ? `**💛 Giá trị cốt lõi**\n${o.valueTagLabel}`
    : `**Loại**\n${isSuper ? "💜 Super (30 🥔)" : "🥔 Thanks"}`;
  const card = mkCard(
    isSuper ? "purple" : "green",
    isSuper ? "💜 Super Thanks dành cho bạn!" : "🥔 Bạn nhận được khoai!",
    [
      mdEl(isSuper
        ? `**${o.giverName}** đã chọn bạn là người xứng đáng được tôn vinh nhất tháng này 💜`
        : `**${o.giverName}** vừa gửi tặng bạn **${o.khoai} 🥔**`),
      mdEl(`💬 *"${o.message}"*`),
      hrEl(),
      fieldsEl(giaTri, `**🥔 Ví khoai**\n${o.totalBalance} 🥔`),
      noteEl(BRAND),
      btnEl("Cảm ơn lại →", tabUrl("withanks")),
    ],
  );
  return sendCard(openId, card, `🥔 Bạn vừa nhận được ${o.khoai} khoai từ ${o.giverName} với lời cảm ơn: "${o.message}". Ví: ${o.totalBalance} 🥔.`);
}

// B2 — WiThanks: bắn cho người GỬI khoai (xác nhận).
export async function notifyThanksGiven(openId: string, o: { receiverNames: string; khoai: number; message: string; remaining: string; kind: Kind }): Promise<boolean> {
  if (o.kind === "special") {
    const card = mkCard("carmine", "🎁 Đã gửi Special Gift", [
      mdEl(`Bạn vừa gửi tặng một **Special Gift** cho **${o.receiverNames}**. HR sẽ lo phần quà thật.`),
      mdEl(`💬 *"${o.message}"*`),
      noteEl("Cảm ơn vì đã trân trọng đồng đội 💛"),
      noteEl(BRAND),
    ]);
    return sendCard(openId, card, `🎁 Bạn vừa gửi Special Gift cho ${o.receiverNames}. HR sẽ lo phần quà thật. 💛`);
  }
  const khoaiLabel = o.kind === "super" ? "một **Super Thanks (30 🥔)**" : `**${o.khoai} 🥔**`;
  const els: El[] = [
    mdEl(`Bạn vừa gửi tặng ${khoaiLabel} cho **${o.receiverNames}**`),
    mdEl(`💬 *"${o.message}"*`),
  ];
  if (o.remaining) { els.push(hrEl(), noteEl(o.remaining)); }
  els.push(noteEl(BRAND));
  const card = mkCard("wathet", "🥔 Đã gửi lời cảm ơn", els);
  return sendCard(openId, card, `🥔 Bạn vừa gửi tặng ${o.khoai} khoai cho ${o.receiverNames} với lời cảm ơn: "${o.message}".`);
}

// B1 — bắn cho chủ hoạt động khi có hoạt động MỚI được ghi nhận (Strava sync / duyệt tay).
export async function notifyNewActivity(openId: string, o: { activityName: string; distanceKm: number; amountVnd: number; activityId: string }): Promise<boolean> {
  const fundField = o.amountVnd > 0 ? `**💰 Quỹ tạo ra**\n+${vnd(o.amountVnd)}đ` : `**💪 Ghi nhận**\n1 buổi`;
  const distField = o.distanceKm > 0 ? `**📏 Quãng đường**\n${o.distanceKm.toFixed(1)} km` : `**🔥 Trạng thái**\nĐã ghi nhận`;
  const card = mkCard("turquoise", "🏃 Hoạt động mới đã ghi nhận!", [
    mdEl(`Buổi **${o.activityName || "tập luyện"}** của bạn đã được đồng bộ 🔥`),
    hrEl(),
    fieldsEl(fundField, distField),
    noteEl(`${BRAND} · Move4Wishare`),
    btnEl("Xem hoạt động →", activityUrl(o.activityId)),
  ]);
  return sendCard(openId, card, `🏃 Hoạt động "${o.activityName}" đã ghi nhận.${o.amountVnd > 0 ? ` +${vnd(o.amountVnd)}đ vào quỹ.` : ""}`);
}

// A3 — bắn cho chủ hoạt động khi có người bình luận.
export async function notifyComment(opts: { ownerOpenId: string; commenterName: string; activityName: string; activityId: string; body: string }): Promise<boolean> {
  const snippet = opts.body.length > 100 ? opts.body.slice(0, 100) + "…" : opts.body;
  const card = mkCard("blue", "💬 Bình luận mới", [
    mdEl(`**${opts.commenterName}** vừa bình luận hoạt động **${opts.activityName}** của bạn:`),
    mdEl(`*"${snippet}"*`),
    noteEl(BRAND),
    btnEl("Xem & trả lời →", activityUrl(opts.activityId)),
  ]);
  return sendCard(opts.ownerOpenId, card, `💬 ${opts.commenterName} bình luận "${opts.activityName}": "${snippet}"`);
}

// A2 — bắn cho chủ hoạt động khi có người thả cảm xúc.
export async function notifyReaction(opts: { ownerOpenId: string; reactorName: string; emoji: string; activityName: string; activityId: string }): Promise<boolean> {
  const card = mkCard("turquoise", `${opts.emoji} Bạn nhận được một cảm xúc!`, [
    mdEl(`**${opts.reactorName}** vừa thả ${opts.emoji} cho hoạt động **${opts.activityName}** của bạn.`),
    noteEl(BRAND),
    btnEl("Xem hoạt động →", activityUrl(opts.activityId)),
  ]);
  return sendCard(opts.ownerOpenId, card, `${opts.emoji} ${opts.reactorName} vừa thả cảm xúc cho hoạt động "${opts.activityName}" của bạn.`);
}

// E1+C2 — Tổng kết tuần (sáng thứ 2): nhìn lại tuần qua + nhắc hạn mức khoai tuần mới.
export async function notifyWeeklyDigest(openId: string, o: { name: string; km: number; fundVnd: number; khoaiReceived: number; gaveCount: number; weekAllowance: number | null }): Promise<boolean> {
  const first = o.name.split(" ").slice(-1)[0] || o.name;
  const allowanceLine = o.weekAllowance != null
    ? `🌟 **Tuần mới:** bạn có **${o.weekAllowance} 🥔** để cảm ơn đồng đội — đừng để phí nhé!`
    : `🌟 **Tuần mới:** hãy tiếp tục lan toả lời cảm ơn 💛`;
  const card = mkCard("indigo", "📊 Tổng kết tuần của bạn", [
    mdEl(`Chào **${first}**! Cùng nhìn lại 7 ngày qua của bạn 👇`),
    hrEl(),
    fieldsEl(`**🏃 Vận động**\n${o.km.toFixed(1)} km`, `**💰 Góp quỹ**\n+${vnd(o.fundVnd)}đ`),
    fieldsEl(`**🥔 Khoai nhận**\n${o.khoaiReceived} 🥔`, `**🌻 Đã cho đi**\n${o.gaveCount} lần`),
    hrEl(),
    mdEl(allowanceLine),
    noteEl(BRAND),
    btnEl("Mở Wicer →", tabUrl("home")),
  ]);
  return sendCard(openId, card, `📊 Tuần qua: ${o.km.toFixed(1)}km · +${vnd(o.fundVnd)}đ quỹ · nhận ${o.khoaiReceived}🥔 · cho đi ${o.gaveCount} lần. Tuần mới bạn có ${o.weekAllowance ?? "∞"}🥔 để cảm ơn.`);
}

// ── WiThanks trong Lark group (tặng khoai bằng 🥔) ──

// Thả reaction 🥔 lên tin nhắn gốc để xác nhận đã ghi nhận. Best-effort (lỗi không chặn luồng).
// emoji_type mặc định "POTATO"; nếu Lark báo sai key, đổi qua env LARK_POTATO_EMOJI.
export async function sendLarkReaction(messageId: string, emojiType = process.env.LARK_POTATO_EMOJI || "POTATO"): Promise<boolean> {
  if (!larkNotifyEnabled()) return false;
  const token = await getTenantAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/open-apis/im/v1/messages/${messageId}/reactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reaction_type: { emoji_type: emojiType } }),
    });
    const j = await res.json();
    if (j.code !== 0) { if (larkDebug()) console.warn("[lark reaction]", j.code, j.msg); return false; }
    return true;
  } catch (e) {
    console.warn("[lark reaction] lỗi", e);
    return false;
  }
}

// DM cho NGƯỜI GỬI sau khi tặng khoai trong group.
export async function notifyGroupThanksGiver(openId: string, o: {
  khoai: number; receiverLabel: string; message: string; weekRemaining: number | null; monthRemaining: number | null;
}): Promise<boolean> {
  const wk = o.weekRemaining == null ? "không giới hạn" : `${o.weekRemaining} củ`;
  const mo = o.monthRemaining == null ? "không giới hạn" : `${o.monthRemaining} củ`;
  const text = `Bạn vừa tặng ${o.khoai} củ khoai 🥔 cho ${o.receiverLabel}: “${o.message}”.\nSố khoai còn lại của bạn trong tuần là ${wk}, trong tháng là ${mo}.`;
  return sendLarkText(openId, text);
}

// DM cho NGƯỜI NHẬN sau khi được tặng khoai trong group.
export async function notifyGroupThanksReceiver(openId: string, o: {
  khoai: number; giverName: string; message: string; totalBalance: number;
}): Promise<boolean> {
  const text = `Bạn vừa nhận ${o.khoai} củ khoai 🥔 từ ${o.giverName}: “${o.message}”.\nTổng số khoai bạn hiện có: ${o.totalBalance} củ.`;
  return sendLarkText(openId, text);
}
