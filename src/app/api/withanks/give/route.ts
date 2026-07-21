import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  computeAllowance, givenToPersonToday, countKindSince, tenureDays,
  VALUE_TAG_MAP, SUPER_KHOAI, SUPER_PER_MONTH, MIN_SUPER_MSG,
  SPECIAL_KHOAI, SPECIAL_PER_YEAR, SPECIAL_MIN_TENURE_DAYS, MIN_SPECIAL_MSG,
} from "@/lib/withanks";
import { creditKhoai, debitKhoai } from "@/lib/khoai";
import { monthStartVN, yearStartVN } from "@/lib/wicer";
import { larkNotifyEnabled, notifyThanksReceived, sendLarkText } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

const MIN_MSG = 10; // ký tự tối thiểu cho Thanks thường

// Lỗi nghiệp vụ trong transaction -> map ra HTTP tương ứng.
class GiveError extends Error {
  constructor(public status: number, public payload: Record<string, unknown>) { super("give-error"); }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let b: { receiverIds?: string[]; khoai?: number; message?: string; anonymous?: boolean; kind?: string; valueTags?: string[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const kind = b.kind === "super" || b.kind === "special" ? b.kind : "thanks";
  const receiverIds = [...new Set((b.receiverIds ?? []).filter(Boolean))];
  const message = (b.message ?? "").trim().slice(0, 2000);
  const anonymous = Boolean(b.anonymous);
  const valueTags = [...new Set((b.valueTags ?? []).filter((t) => VALUE_TAG_MAP[t]))].slice(0, 3);

  if (receiverIds.length === 0) return NextResponse.json({ error: "no-receiver", message: "Chọn ít nhất 1 người nhận." }, { status: 400 });
  if (receiverIds.includes(session.employeeId)) return NextResponse.json({ error: "self", message: "Không thể tự tặng khoai cho mình." }, { status: 400 });

  // Super/Special: chỉ 1 người nhận.
  if ((kind === "super" || kind === "special") && receiverIds.length !== 1)
    return NextResponse.json({ error: "one-receiver", message: `${kind === "super" ? "Super Thanks" : "Special Gift"} chỉ gửi cho 1 người.` }, { status: 400 });

  // Độ dài lời cảm ơn theo nấc.
  const minMsg = kind === "super" ? MIN_SUPER_MSG : kind === "special" ? MIN_SPECIAL_MSG : MIN_MSG;
  if (message.length < minMsg)
    return NextResponse.json({ error: "short-msg", message: `Lời cảm ơn cần tối thiểu ${minMsg} ký tự.` }, { status: 400 });

  // Số khoai/người theo nấc (thanks: người dùng chọn; super: cố định 30; special: cố định 100).
  const khoai = kind === "super" ? SUPER_KHOAI : kind === "special" ? SPECIAL_KHOAI : Math.round(Number(b.khoai) || 0);
  if (kind === "thanks" && khoai < 1) return NextResponse.json({ error: "bad-khoai", message: "Số khoai phải ≥ 1." }, { status: 400 });

  const me = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { id: true, name: true, isAdmin: true, wiRole: true, joinedAt: true, createdAt: true, khoaiBalance: true },
  });
  if (!me) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const receivers = await prisma.employee.findMany({
    where: { id: { in: receiverIds } },
    select: { id: true, name: true, larkOpenId: true, larkNotifyReaction: true },
  });
  if (receivers.length === 0) return NextResponse.json({ error: "bad-receiver" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      // Khoá theo người gửi để 2 request song song không cùng vượt hạn mức / double-spend.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${me.id}))`;

      if (kind === "thanks") {
        if (!me.isAdmin) {
          const allowance = await computeAllowance(me, tx);
          const cap = allowance.perPersonDay ?? 5;
          if (khoai > cap) throw new GiveError(400, { error: "cap", message: `Tối đa ${cap} khoai/người/lần.` });
          for (const r of receivers) {
            const already = await givenToPersonToday(me.id, r.id, tx);
            if (already + khoai > cap)
              throw new GiveError(400, { error: "cap-day", message: `Bạn đã tặng ${r.name} ${already} khoai hôm nay (trần ${cap}/ngày).` });
          }
          const total = khoai * receivers.length;
          if (allowance.canGiveNow != null && total > allowance.canGiveNow)
            throw new GiveError(400, { error: "over-allowance", message: `Vượt hạn mức. Bạn còn tặng được ${allowance.canGiveNow} khoai.` });
        }
        for (const r of receivers) {
          const g = await tx.thanksGift.create({ data: { senderId: me.id, receiverId: r.id, khoai, message, anonymous, kind: "thanks", valueTags } });
          await creditKhoai(tx, r.id, khoai, { reason: "thanks", refType: "ThanksGift", refId: g.id, createdById: me.id });
        }
      } else if (kind === "super") {
        // 1 Super/tháng cho mỗi người gửi (admin vẫn giới hạn để giữ ý nghĩa).
        const usedThisMonth = await countKindSince(me.id, "super", monthStartVN(), tx);
        if (usedThisMonth >= SUPER_PER_MONTH)
          throw new GiveError(400, { error: "super-used", message: "Bạn đã dùng Super Thanks tháng này. Tháng sau nhé!" });
        const r = receivers[0];
        const g = await tx.thanksGift.create({ data: { senderId: me.id, receiverId: r.id, khoai: SUPER_KHOAI, message, anonymous, kind: "super", valueTags } });
        await creditKhoai(tx, r.id, SUPER_KHOAI, { reason: "super", refType: "ThanksGift", refId: g.id, createdById: me.id });
      } else {
        // special
        if (tenureDays(me) < SPECIAL_MIN_TENURE_DAYS)
          throw new GiveError(400, { error: "tenure", message: "Special Gift dành cho nhân sự gắn bó ≥ 6 tháng." });
        const usedThisYear = await countKindSince(me.id, "special", yearStartVN(), tx);
        if (usedThisYear >= SPECIAL_PER_YEAR)
          throw new GiveError(400, { error: "special-used", message: "Bạn đã dùng Special Gift năm nay. Mỗi năm 1 lần thôi 💛" });
        // TRỪ 100🥔 ví nhận người tặng (cam kết cá nhân) — nguyên tử.
        const balAfter = await debitKhoai(tx, me.id, SPECIAL_KHOAI, { reason: "special", refType: "ThanksGift", note: `Special Gift → ${receivers[0].name}` });
        if (balAfter === null)
          throw new GiveError(400, { error: "insufficient", message: `Special Gift cần ${SPECIAL_KHOAI}🥔 trong ví. Bạn có ${me.khoaiBalance}🥔.` });
        const r = receivers[0];
        const g = await tx.thanksGift.create({ data: { senderId: me.id, receiverId: r.id, khoai: SPECIAL_KHOAI, message, anonymous: false, kind: "special", valueTags } });
        // Không cộng khoai cho người nhận — Special Gift là quà THẬT do HR trao. Tạo hàng đợi HR.
        await tx.fulfillment.create({
          data: { kind: "special", title: `Special Gift cho ${r.name}`, employeeId: r.id, counterpart: me.name, khoai: SPECIAL_KHOAI, refType: "ThanksGift", refId: g.id, status: "pending" },
        });
      }
    });
  } catch (e) {
    if (e instanceof GiveError) return NextResponse.json(e.payload, { status: e.status });
    console.error("[withanks/give] lỗi:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  void notifyAll(me, receivers, khoai, message, kind);

  const after = await computeAllowance(me);
  return NextResponse.json({ ok: true, sentTo: receivers.length, kind, allowance: after });
}

async function notifyAll(
  me: { id: string; name: string; isAdmin: boolean; wiRole: string },
  receivers: { id: string; name: string; larkOpenId: string; larkNotifyReaction: boolean }[],
  khoai: number,
  message: string,
  kind: string,
) {
  try {
    if (!larkNotifyEnabled()) return;
    for (const r of receivers) {
      if (!r.larkOpenId || !r.larkNotifyReaction) continue;
      if (kind === "special") {
        await sendLarkText(r.larkOpenId, `🎁 ${me.name} vừa dành tặng bạn một Special Gift!\n"${message}"\nHR sẽ liên hệ để trao món quà thật tới bạn. 💛`);
        continue;
      }
      const fresh = await prisma.employee.findUnique({ where: { id: r.id }, select: { khoaiBalance: true } });
      const prefix = kind === "super" ? "💜 Super Thanks! " : "";
      await notifyThanksReceived(r.larkOpenId, { giverName: `${prefix}${me.name}`, khoai, message, totalBalance: fresh?.khoaiBalance ?? 0 });
    }
    const sender = await prisma.employee.findUnique({ where: { id: me.id }, select: { larkOpenId: true } });
    if (sender?.larkOpenId) {
      const names = receivers.map((r) => r.name).join(", ");
      if (kind === "special") {
        await sendLarkText(sender.larkOpenId, `🎁 Bạn vừa gửi Special Gift cho ${names} (trừ ${SPECIAL_KHOAI}🥔). HR sẽ lo phần quà thật. Cảm ơn vì đã trân trọng đồng đội 💛`);
      } else {
        const after = await computeAllowance(me);
        const rem = after.weekRemaining != null ? `Khoai còn: ${after.weekRemaining} củ tuần này, ${after.monthRemaining} củ tháng này.` : after.unlimited ? "" : `Khoai còn tháng này: ${after.monthRemaining} củ.`;
        const label = kind === "super" ? "Super Thanks (30🥔)" : `${khoai} củ khoai`;
        await sendLarkText(sender.larkOpenId, `🥔 Bạn vừa tặng ${label} cho ${names}:\n"${message}"\n${rem}`.trim());
      }
    }
  } catch (e) {
    console.warn("[withanks] notify lỗi:", e);
  }
}
