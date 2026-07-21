// WiThanks — sổ cái ví NHẬN (khoaiBalance). Mọi thay đổi số dư ĐI QUA đây để có audit trail
// + đảm bảo nguyên tử. Luôn gọi TRONG một $transaction để nhất quán với các thao tác kèm theo.
import type { Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface LedgerMeta {
  reason: string; // thanks | super | redeem | special | card | contribution | admin | opening | refund
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  createdById?: string | null;
}

// Cộng khoai vào ví NHẬN + ghi ledger. Trả về số dư sau giao dịch.
export async function creditKhoai(tx: Tx, employeeId: string, amount: number, meta: LedgerMeta): Promise<number> {
  if (amount <= 0) throw new Error("creditKhoai: amount phải > 0");
  const emp = await tx.employee.update({
    where: { id: employeeId },
    data: { khoaiBalance: { increment: amount } },
    select: { khoaiBalance: true },
  });
  await tx.khoaiTransaction.create({
    data: { employeeId, delta: amount, balanceAfter: emp.khoaiBalance, reason: meta.reason, refType: meta.refType ?? null, refId: meta.refId ?? null, note: meta.note ?? null, createdById: meta.createdById ?? null },
  });
  return emp.khoaiBalance;
}

// Trừ khoai NGUYÊN TỬ (chỉ khi số dư còn đủ) + ghi ledger.
// Trả về số dư sau giao dịch, hoặc null nếu KHÔNG đủ khoai (không ghi gì).
export async function debitKhoai(tx: Tx, employeeId: string, amount: number, meta: LedgerMeta): Promise<number | null> {
  if (amount <= 0) throw new Error("debitKhoai: amount phải > 0");
  const upd = await tx.employee.updateMany({
    where: { id: employeeId, khoaiBalance: { gte: amount } },
    data: { khoaiBalance: { decrement: amount } },
  });
  if (upd.count === 0) return null; // không đủ
  const emp = await tx.employee.findUnique({ where: { id: employeeId }, select: { khoaiBalance: true } });
  const balanceAfter = emp?.khoaiBalance ?? 0;
  await tx.khoaiTransaction.create({
    data: { employeeId, delta: -amount, balanceAfter, reason: meta.reason, refType: meta.refType ?? null, refId: meta.refId ?? null, note: meta.note ?? null, createdById: meta.createdById ?? null },
  });
  return balanceAfter;
}

// Admin đặt số dư = target (ghi delta chênh lệch vào ledger). Trả target.
export async function adminSetBalance(tx: Tx, employeeId: string, target: number, adminId: string, note?: string): Promise<number> {
  const t = Math.max(0, Math.round(target));
  const cur = await tx.employee.findUnique({ where: { id: employeeId }, select: { khoaiBalance: true } });
  const delta = t - (cur?.khoaiBalance ?? 0);
  if (delta === 0) return t;
  await tx.employee.update({ where: { id: employeeId }, data: { khoaiBalance: t } });
  await tx.khoaiTransaction.create({
    data: { employeeId, delta, balanceAfter: t, reason: "admin", note: note ?? null, createdById: adminId },
  });
  return t;
}
