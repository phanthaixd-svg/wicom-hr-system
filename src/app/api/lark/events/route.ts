import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { giveThanksFromLark, LarkGiveError } from "@/lib/larkGive";
import { sendLarkText, sendLarkReaction, notifyGroupThanksGiver, notifyGroupThanksReceiver } from "@/lib/larkNotify";
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

// Lark gửi event tin nhắn về đây. Nhận diện lệnh tặng khoai (🥔 + @người nhận) trong group.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({}); }

  const encKey = process.env.LARK_ENCRYPT_KEY;
  if (typeof body.encrypt === "string" && encKey) {
    try { body = JSON.parse(decrypt(body.encrypt, encKey)); } catch { return NextResponse.json({}); }
  }

  // Xác thực URL khi thiết lập event subscription.
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Kiểm tra Verification Token (nếu cấu hình) — chống giả mạo.
  const header = body.header as { token?: string; event_type?: string } | undefined;
  const expected = process.env.LARK_VERIFICATION_TOKEN;
  const token = header?.token ?? (body.token as string | undefined);
  if (expected && token !== expected) return NextResponse.json({});

  if (header?.event_type === "im.message.receive_v1") {
    const ev = body.event as LarkMessageEvent;
    // Trả 200 ngay, xử lý nền (Lark timeout 3s + retry nếu lỗi).
    after(() => handleMessage(ev).catch((e) => console.error("[lark events] lỗi:", e)));
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

const POTATO = /🥔/gu;

// Parse tin nhắn: chỉ coi là lệnh tặng khi CÓ 🥔 VÀ CÓ @người (tránh nhiễu khi ai đó gõ 🥔 vu vơ).
function parseThanks(ev: LarkMessageEvent): { potatoes: number; receiverOpenIds: string[]; text: string } | null {
  const msg = ev.message;
  if (!msg || msg.chat_type !== "group" || msg.message_type !== "text" || !msg.content) return null;
  let raw = "";
  try { raw = (JSON.parse(msg.content) as { text?: string }).text ?? ""; } catch { return null; }

  const potatoes = (raw.match(POTATO) || []).length;
  if (potatoes === 0) return null;

  const mentions = msg.mentions ?? [];
  const receiverOpenIds = mentions.map((m) => m.id?.open_id).filter((x): x is string => Boolean(x));
  if (receiverOpenIds.length === 0) return null; // 🥔 nhưng không @ ai → bỏ qua

  // Bỏ placeholder @_user_N khỏi lời nhắn; giữ nguyên phần chữ + 🥔.
  let text = raw;
  for (const m of mentions) if (m.key) text = text.split(m.key).join("");
  text = text.replace(/\s+/g, " ").trim();

  return { potatoes, receiverOpenIds, text };
}

async function handleMessage(ev: LarkMessageEvent): Promise<void> {
  const parsed = parseThanks(ev);
  if (!parsed) return;
  const msgId = ev.message?.message_id;
  const senderOpenId = ev.sender?.sender_id?.open_id;
  if (!msgId || !senderOpenId) return;

  // Chống xử lý trùng: đánh dấu message đã xử lý (Lark có thể gửi lại). Trùng → bỏ.
  try {
    await prisma.larkEventLog.create({ data: { msgId } });
  } catch {
    return;
  }

  try {
    const res = await giveThanksFromLark({
      senderOpenId,
      receiverOpenIds: parsed.receiverOpenIds,
      khoai: parsed.potatoes,
      message: parsed.text || "🥔",
    });

    // Xác nhận công khai: thả reaction 🥔 lên tin gốc.
    await sendLarkReaction(msgId);

    // DM người gửi.
    if (res.giver.notifyThanks) {
      const label = res.receivers.map((r) => `@${r.name}`).join(", ");
      await notifyGroupThanksGiver(res.giver.openId, {
        khoai: res.khoai, receiverLabel: label, message: res.message,
        weekRemaining: res.weekRemaining, monthRemaining: res.monthRemaining,
      });
    }
    // DM từng người nhận.
    for (const r of res.receivers) {
      if (r.openId && r.notifyThanks) {
        await notifyGroupThanksReceiver(r.openId, {
          khoai: res.khoai, giverName: res.giver.name, message: res.message, totalBalance: r.newBalance,
        });
      }
    }
    revalidateHome();
  } catch (e) {
    // Lỗi nghiệp vụ → DM người gửi để họ biết vì sao không tặng được.
    if (e instanceof LarkGiveError) {
      await sendLarkText(senderOpenId, `⚠️ Wicer chưa ghi nhận được lệnh tặng khoai: ${e.message}`);
    } else {
      console.error("[lark events] give lỗi:", e);
    }
  }
}
