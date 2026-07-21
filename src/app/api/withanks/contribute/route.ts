import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { debitKhoai } from "@/lib/khoai";
import { larkNotifyEnabled, sendLarkText } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

class CErr extends Error { constructor(public status: number, public payload: Record<string, unknown>) { super("c-err"); } }

// Góp khoai cho phần quà SQUAD / GREEN FIELD. asMain=true để giữ suất Main (chỉ squad, nếu còn suất).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const meId = session.employeeId;

  let body: { rewardId?: string; khoai?: number; asMain?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-json" }, { status: 400 }); }

  const rewardId = String(body.rewardId ?? "");
  const khoai = Math.round(Number(body.khoai) || 0);
  const asMain = Boolean(body.asMain);
  if (!rewardId) return NextResponse.json({ error: "missing-id" }, { status: 400 });
  if (khoai < 1) return NextResponse.json({ error: "bad-khoai", message: "Số khoai góp phải ≥ 1." }, { status: 400 });

  const me = await prisma.employee.findUnique({ where: { id: meId }, select: { larkOpenId: true } });
  if (!me) return NextResponse.json({ error: "notfound" }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Khoá theo phần quà: mọi lượt góp cùng phần quà nối tiếp nhau (suất Main + mốc đủ chính xác).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"reward:" + rewardId}))`;

      const reward = await tx.reward.findUnique({ where: { id: rewardId }, include: { contributions: true } });
      if (!reward || !reward.active) throw new CErr(404, { error: "notfound" });
      if (reward.kind !== "squad" && reward.kind !== "greenfield") throw new CErr(400, { error: "wrong-kind", message: "Phần quà này đổi trực tiếp, không góp chung." });
      if (reward.status === "fulfilled") throw new CErr(400, { error: "done", message: "Phần quà này đã đạt mốc 🎉" });

      const existing = reward.contributions.find((c) => c.employeeId === meId) ?? null;
      const mainCount = reward.contributions.filter((c) => c.isMain).length;

      // Suất Main (chỉ squad).
      let becomeMain = false;
      if (reward.kind === "squad" && asMain && !(existing?.isMain)) {
        if (reward.maxMain != null && mainCount >= reward.maxMain)
          throw new CErr(400, { error: "no-slot", message: "Đã đủ suất Main Contributor. Bạn vẫn góp được (không giữ suất)." });
        becomeMain = true;
      }
      const isMain = existing?.isMain || becomeMain;

      // Trừ khoai người góp (nguyên tử).
      const bal = await debitKhoai(tx, meId, khoai, { reason: "contribution", refType: "Reward", refId: reward.id, note: reward.name });
      if (bal === null) throw new CErr(400, { error: "insufficient", message: "Không đủ khoai để góp." });

      const contrib = existing
        ? await tx.contribution.update({ where: { id: existing.id }, data: { khoai: { increment: khoai }, isMain } })
        : await tx.contribution.create({ data: { rewardId: reward.id, employeeId: meId, khoai, isMain } });

      const raised = reward.contributions.reduce((s, c) => s + (c.employeeId === meId ? 0 : c.khoai), 0) + contrib.khoai;
      let completed = false;
      if (reward.goalKhoai != null && raised >= reward.goalKhoai) {
        await tx.reward.update({ where: { id: reward.id }, data: { status: "fulfilled" } });
        // Đại diện nhận: Main góp nhiều nhất (squad) / người góp nhiều nhất (greenfield).
        const all = [...reward.contributions.filter((c) => c.employeeId !== meId), contrib];
        const pool = reward.kind === "squad" ? all.filter((c) => c.isMain) : all;
        const rep = (pool.length ? pool : all).sort((a, b) => b.khoai - a.khoai)[0];
        await tx.fulfillment.create({
          data: { kind: reward.kind, title: reward.name, employeeId: rep.employeeId, khoai: raised, refType: "Reward", refId: reward.id, status: "pending" },
        });
        completed = true;
      }
      return { bal, raised, goal: reward.goalKhoai ?? 0, completed, isMain, name: reward.name, kind: reward.kind };
    });

    if (larkNotifyEnabled() && me.larkOpenId) {
      const msg = result.completed
        ? `🎉 Phần quà "${result.name}" đã ĐẠT MỐC nhờ lượt góp ${khoai}🥔 của bạn! HR sẽ lo phần còn lại.`
        : `🥔 Bạn vừa góp ${khoai}🥔 cho "${result.name}" (${result.raised}/${result.goal}). Cảm ơn đã cho đi!`;
      void sendLarkText(me.larkOpenId, msg).catch(() => {});
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof CErr) return NextResponse.json(e.payload, { status: e.status });
    console.error("[withanks/contribute] lỗi:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
