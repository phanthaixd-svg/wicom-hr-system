import { prisma } from "./db";
import { computeAmount, getConversionContext } from "./conversion";

// Tính lại amountVnd cho TẤT CẢ hoạt động theo bảng rule + mốc quy đổi hiện hành.
// Gọi sau khi admin đổi tỷ lệ hoặc đổi mốc quy đổi.
export async function recomputeAllAmounts(): Promise<number> {
  const ctx = await getConversionContext();
  const activities = await prisma.activity.findMany({
    select: { id: true, type: true, distanceKm: true, isFlagged: true, startDate: true, amountVnd: true },
  });

  let updated = 0;
  for (const a of activities) {
    const beforeCutoff = ctx.conversionFromDate ? a.startDate < ctx.conversionFromDate : false;
    const amount = beforeCutoff ? 0 : computeAmount(ctx.rules[a.type], a.distanceKm, a.isFlagged);
    if (amount !== a.amountVnd) {
      await prisma.activity.update({ where: { id: a.id }, data: { amountVnd: amount } });
      updated++;
    }
  }
  return updated;
}
