import { prisma } from "./db";
import { computeAllowance, givenToPersonToday } from "./withanks";
import { creditKhoai } from "./khoai";

// Lỗi nghiệp vụ khi tặng khoai qua Lark (để báo lại cho người gửi qua DM).
export class LarkGiveError extends Error {
  constructor(public reason: string, message: string) {
    super(message);
  }
}

export interface LarkGiveResult {
  giver: { id: string; name: string; openId: string; notifyThanks: boolean };
  khoai: number;
  message: string;
  receivers: { id: string; name: string; openId: string | null; notifyThanks: boolean; newBalance: number }[];
  weekRemaining: number | null;
  monthRemaining: number | null;
}

// Tặng khoai (nấc "thanks") khởi nguồn từ tin nhắn Lark group.
// TÁI DÙNG luật hạn mức + khoá chống double-spend + ledger giống /api/withanks/give (nấc thanks).
export async function giveThanksFromLark(opts: {
  senderOpenId: string;
  receiverOpenIds: string[];
  khoai: number;
  message: string;
}): Promise<LarkGiveResult> {
  const me = await prisma.employee.findUnique({
    where: { larkOpenId: opts.senderOpenId },
    select: { id: true, name: true, isAdmin: true, wiRole: true, larkOpenId: true, larkNotifyThanks: true },
  });
  if (!me) throw new LarkGiveError("giver-unknown", "Người gửi chưa có tài khoản Wicer.");

  const uniqRecv = [...new Set(opts.receiverOpenIds)].filter((o) => o && o !== opts.senderOpenId);
  if (uniqRecv.length === 0) throw new LarkGiveError("no-receiver", "Cần @ ít nhất 1 người nhận (không tính chính bạn).");

  const receivers = await prisma.employee.findMany({
    where: { larkOpenId: { in: uniqRecv } },
    select: { id: true, name: true, larkOpenId: true, larkNotifyThanks: true },
  });
  if (receivers.length === 0) throw new LarkGiveError("bad-receiver", "Không tìm thấy người nhận trong Wicer.");

  const khoai = Math.round(opts.khoai);
  if (khoai < 1) throw new LarkGiveError("bad-khoai", "Số khoai phải ≥ 1.");

  const newBalances = new Map<string, number>();
  await prisma.$transaction(async (tx) => {
    // Khoá theo người gửi để không cùng lúc vượt hạn mức / double-spend.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${me.id}))`;

    if (!me.isAdmin) {
      const allowance = await computeAllowance(me, tx);
      const cap = allowance.perPersonDay ?? 5;
      if (khoai > cap) throw new LarkGiveError("cap", `Tối đa ${cap} khoai/người/lần.`);
      for (const r of receivers) {
        const already = await givenToPersonToday(me.id, r.id, tx);
        if (already + khoai > cap)
          throw new LarkGiveError("cap-day", `Bạn đã tặng ${r.name} ${already} khoai hôm nay (trần ${cap}/ngày).`);
      }
      const total = khoai * receivers.length;
      if (allowance.canGiveNow != null && total > allowance.canGiveNow)
        throw new LarkGiveError("over-allowance", `Vượt hạn mức. Bạn còn tặng được ${allowance.canGiveNow} khoai.`);
    }

    for (const r of receivers) {
      const g = await tx.thanksGift.create({
        data: { senderId: me.id, receiverId: r.id, khoai, message: opts.message, kind: "thanks" },
      });
      const bal = await creditKhoai(tx, r.id, khoai, { reason: "thanks", refType: "ThanksGift", refId: g.id, createdById: me.id });
      newBalances.set(r.id, bal);
    }
  });

  const after = await computeAllowance(me);
  return {
    giver: { id: me.id, name: me.name, openId: me.larkOpenId, notifyThanks: me.larkNotifyThanks },
    khoai,
    message: opts.message,
    receivers: receivers.map((r) => ({
      id: r.id, name: r.name, openId: r.larkOpenId, notifyThanks: r.larkNotifyThanks, newBalance: newBalances.get(r.id) ?? 0,
    })),
    weekRemaining: after.weekRemaining,
    monthRemaining: after.monthRemaining,
  };
}
