import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { giveThanksFromLark, LarkGiveError } from "@/lib/larkGive";
import { sendLarkText, sendLarkReaction, notifyThanksGiven, notifyThanksReceived, larkNotifyEnabled } from "@/lib/larkNotify";
import { revalidateHome } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Giải mã payload nếu app bật "Encrypt Key" (AES-256-CBC, key = SHA256(encryptKey)).
function decrypt(encrypt: string, key: string): string {
  const aesKey = crypto.createHash("sha256").update(key).digest();
  const data = Buffer.from(encrypt, "base64");
  const iv = data.subarray(0, 16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  return Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]).toString("utf8");
}

// GET: chẩn đoán cấu hình (không lộ bí mật) — để kiểm tra nhanh từ xa vì sao bot "im ru".
export async function GET() {
  let larkEventLogTable = false;
  try { await prisma.larkEventLog.count(); larkEventLogTable = true; } catch { /* bảng chưa tạo */ }
  let employees = -1;
  try { employees = await prisma.employee.count(); } catch { /* DB lỗi */ }
  return NextResponse.json({
    endpoint: "ok",
    larkNotifyEnabled: larkNotifyEnabled(),
    hasClientId: !!process.env.LARK_CLIENT_ID,
    hasClientSecret: !!process.env.LARK_CLIENT_SECRET,
    hasVerificationToken: !!process.env.LARK_VERIFICATION_TOKEN,
    hasEncryptKey: !!process.env.LARK_ENCRYPT_KEY,
    larkEventLogTable, // false = migration Neon CHƯA chạy
    employees,
    apiBase: process.env.LARK_API_BASE || "https://open.larksuite.com",
  });
}

// Lark gửi event tin nhắn về đây. Nhận diện lệnh tặng khoai (🥔 + @người nhận) trong group.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({}); }

  const encKey = process.env.LARK_ENCRYPT_KEY;
  if (typeof body.encrypt === "string") {
    if (!encKey) {
      console.warn("[lark events] payload đã mã hoá nhưng THIẾU LARK_ENCRYPT_KEY → không đọc được. Tắt Encrypt Key ở Lark hoặc set env.");
      return NextResponse.json({});
    }
    try { body = JSON.parse(decrypt(body.encrypt, encKey)); }
    catch (e) { console.error("[lark events] giải mã lỗi:", (e as Error).message); return NextResponse.json({}); }
  }

  // Xác thực URL khi thiết lập event subscription.
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Kiểm tra Verification Token (nếu cấu hình) — chống giả mạo.
  const header = body.header as { token?: string; event_type?: string } | undefined;
  const expected = process.env.LARK_VERIFICATION_TOKEN;
  const token = header?.token ?? (body.token as string | undefined);
  if (expected && token !== expected) {
    console.warn("[lark events] Verification Token KHÔNG khớp → bỏ event. Kiểm tra LARK_VERIFICATION_TOKEN trên Vercel.");
    return NextResponse.json({});
  }

  console.log("[lark events] nhận event:", header?.event_type ?? "(không rõ event_type)", "| keys:", Object.keys(body).join(","));

  if (header?.event_type === "im.message.receive_v1") {
    const ev = body.event as LarkMessageEvent;
    after(() => handleMessage(ev).catch((e) => console.error("[lark events] lỗi nền:", e)));
  }
  return NextResponse.json({});
}

// ── Kiểu event tin nhắn (rút gọn) ──
interface LarkMessageEvent {
  sender?: { sender_id?: { open_id?: string } };
  message?: {
    message_id?: string;
    chat_type?: string;
    message_type?: string;
    content?: string;
    mentions?: { key?: string; id?: { open_id?: string }; name?: string }[];
  };
}

const POTATO_UNICODE = /🥔/gu;
// Emoji built-in của Lark xuất hiện trong text dạng [Key] (vd "[Potato]"). Cho thêm key qua env.
const POTATO_KEYS = (process.env.LARK_POTATO_KEYS || "Potato,SweetPotato,Khoai")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const isPotatoToken = (inner: string): boolean => {
  const low = inner.toLowerCase();
  return low.includes("potato") || low.includes("khoai") || POTATO_KEYS.includes(low);
};

// Đếm số "củ khoai": Unicode 🥔 + token [Key] khớp danh sách khoai (không phân biệt hoa thường).
function countPotatoes(raw: string): number {
  const uni = (raw.match(POTATO_UNICODE) || []).length;
  let tokens = 0;
  for (const b of raw.match(/\[([^\]]+)\]/g) || []) if (isPotatoToken(b.slice(1, -1))) tokens++;
  return uni + tokens;
}

// Bỏ mọi biểu diễn "khoai" (🥔 Unicode + token [Potato]/[khoai]) khỏi lời nhắn — chỉ giữ chữ.
function stripPotatoes(text: string): string {
  return text
    .replace(POTATO_UNICODE, "")
    .replace(/\[([^\]]+)\]/g, (full, inner) => (isPotatoToken(inner) ? "" : full));
}

// Parse tin nhắn: chỉ coi là lệnh tặng khi CÓ 🥔 VÀ CÓ @người (tránh nhiễu khi ai đó gõ 🥔 vu vơ).
function parseThanks(ev: LarkMessageEvent): { potatoes: number; receiverOpenIds: string[]; text: string } | null {
  const msg = ev.message;
  if (!msg || msg.chat_type !== "group" || msg.message_type !== "text" || !msg.content) return null;
  let raw = "";
  try { raw = (JSON.parse(msg.content) as { text?: string }).text ?? ""; } catch { return null; }

  const potatoes = countPotatoes(raw);
  if (potatoes === 0) return null;

  const mentions = msg.mentions ?? [];
  const receiverOpenIds = mentions.map((m) => m.id?.open_id).filter((x): x is string => Boolean(x));
  if (receiverOpenIds.length === 0) return null; // 🥔 nhưng không @ ai → bỏ qua

  // Lời nhắn = phần chữ, ĐÃ bỏ @mention và mọi 🥔/[potato] → chỉ còn text.
  let text = raw;
  for (const m of mentions) if (m.key) text = text.split(m.key).join("");
  text = stripPotatoes(text).replace(/\s+/g, " ").trim();

  return { potatoes, receiverOpenIds, text };
}

async function handleMessage(ev: LarkMessageEvent): Promise<void> {
  // Log nội dung THÔ để biết chính xác "củ khoai" hiện ra thế nào (Unicode 🥔 hay token [Key]).
  console.log("[lark events] content thô:", (ev.message?.content || "").slice(0, 250),
    "| mentions:", (ev.message?.mentions || []).map((m) => m.name).join(",") || "(none)");
  const parsed = parseThanks(ev);
  console.log("[lark events] parse:",
    `chat_type=${ev.message?.chat_type} msg_type=${ev.message?.message_type}`,
    parsed ? `→ ${parsed.potatoes}🥔, ${parsed.receiverOpenIds.length} người nhận` : "→ KHÔNG phải lệnh khoai (bỏ qua)");
  if (!parsed) return;
  const msgId = ev.message?.message_id;
  const senderOpenId = ev.sender?.sender_id?.open_id;
  if (!msgId || !senderOpenId) return;

  // Chống xử lý trùng. Trùng (P2002) → bỏ. Lỗi khác (vd bảng chưa tạo) → VẪN xử lý để không im ru.
  try {
    await prisma.larkEventLog.create({ data: { msgId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    console.warn("[lark events] dedupe bỏ qua (migration chưa chạy?):", (e as Error).message);
  }

  try {
    const res = await giveThanksFromLark({
      senderOpenId,
      receiverOpenIds: parsed.receiverOpenIds,
      khoai: parsed.potatoes,
      message: parsed.text || "Cảm ơn!",
    });
    console.log("[lark events] TẶNG OK:", res.khoai, "khoai →", res.receivers.map((r) => r.name).join(", "));

    await sendLarkReaction(msgId);

    // DÙNG LẠI card của app (giống hệt tin nhắn tặng khoai trên web).
    if (res.giver.notifyThanks) {
      const names = res.receivers.map((r) => r.name).join(", ");
      const wk = res.weekRemaining == null ? "không giới hạn" : `${res.weekRemaining} củ`;
      const mo = res.monthRemaining == null ? "không giới hạn" : `${res.monthRemaining} củ`;
      await notifyThanksGiven(res.giver.openId, {
        receiverNames: names,
        khoai: res.khoai,
        message: res.message,
        remaining: `Số khoai còn lại của bạn trong tuần là ${wk}, trong tháng là ${mo}.`,
        kind: "thanks",
      });
    }
    for (const r of res.receivers) {
      if (r.openId && r.notifyThanks) {
        await notifyThanksReceived(r.openId, {
          giverName: res.giver.name,
          khoai: res.khoai,
          message: res.message,
          totalBalance: r.newBalance,
          kind: "thanks",
        });
      }
    }
    revalidateHome();
  } catch (e) {
    if (e instanceof LarkGiveError) {
      console.warn("[lark events] không tặng được:", e.reason, e.message);
      await sendLarkText(senderOpenId, `⚠️ Wicer chưa ghi nhận được lệnh tặng khoai: ${e.message}`);
    } else {
      console.error("[lark events] give lỗi:", e);
    }
  }
}
