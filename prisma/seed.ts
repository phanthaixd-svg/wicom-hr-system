import { PrismaClient } from "@prisma/client";
import { SPORTS, SPORT_ORDER } from "../src/lib/sports";
import { DEFAULT_DECK } from "../src/lib/wicerCards";

const prisma = new PrismaClient();

async function main() {
  // 1) Bảng tỷ lệ quy đổi mặc định (mỗi môn 1 dòng)
  for (const key of SPORT_ORDER) {
    const s = SPORTS[key];
    await prisma.conversionRule.upsert({
      where: { activityType: key },
      create: {
        activityType: key,
        mode: s.defaultMode,
        rateVnd: s.defaultRateVnd,
        active: key !== "Other",
      },
      update: {},
    });
  }

  // 2) Chiến dịch mặc định
  const existing = await prisma.campaign.findFirst({ where: { active: true } });
  if (!existing) {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 2);
    await prisma.campaign.create({
      data: {
        name: "Khoẻ cho mình - Sẻ chia cho cộng đồng",
        description: "Mỗi km vận động của bạn góp thành quỹ cho cộng đồng. Cùng nhau về đích!",
        goalVnd: BigInt(50_000_000),
        startDate: start,
        endDate: end,
        active: true,
      },
    });
  }

  // 3) Cài đặt hệ thống: mốc quy đổi tiền (từ env nếu có)
  if (process.env.CONVERSION_FROM_DATE) {
    await prisma.setting.upsert({
      where: { key: "conversionFromDate" },
      create: { key: "conversionFromDate", value: process.env.CONVERSION_FROM_DATE },
      update: {},
    });
  }

  // 4) WiThanks — quà Squad + Green Field mẫu (idempotent theo tên)
  const mkReward = async (name: string, r: { description: string; emoji: string; kind: string; goalKhoai?: number; maxMain?: number; costKhoai?: number; sortOrder: number }) => {
    const ex = await prisma.reward.findFirst({ where: { name } });
    if (!ex) await prisma.reward.create({ data: { name, active: true, ...r } });
  };
  await mkReward("Bữa steak cho 3 người", { description: "Nhóm tối đa 3 suất Main Contributor — ai giữ suất Main sẽ được đi ăn. Người khác vẫn góp khoai.", emoji: "🥩", kind: "squad", goalKhoai: 3000, maxMain: 3, sortOrder: 10 });
  await mkReward("Bowling team 4 người", { description: "Cả nhóm 4 người đi bowling. 4 suất Main.", emoji: "🎳", kind: "squad", goalKhoai: 2000, maxMain: 4, sortOrder: 11 });
  await mkReward("Spa đôi thư giãn", { description: "Buổi spa cho 2 người giữ suất Main.", emoji: "💆", kind: "squad", goalKhoai: 2000, maxMain: 2, sortOrder: 12 });
  await mkReward("Tiệc gà rán văn phòng", { description: "Ai cũng góp được, nhiều lần. Đạt 100% → cả văn phòng cùng hưởng.", emoji: "🍗", kind: "greenfield", goalKhoai: 1000, sortOrder: 20 });
  await mkReward("Máy pha cà phê xịn", { description: "Góp chung mua máy pha cà phê cho phòng nghỉ.", emoji: "☕", kind: "greenfield", goalKhoai: 3000, sortOrder: 21 });
  await mkReward("Máy game phòng nghỉ", { description: "Máy chơi game giải trí giờ nghỉ.", emoji: "👾", kind: "greenfield", goalKhoai: 5000, sortOrder: 22 });

  // 5) Ledger: mở sổ cho nhân sự chưa có giao dịch nào (số dư hiện tại = dòng "opening").
  const emps = await prisma.employee.findMany({ select: { id: true, khoaiBalance: true } });
  for (const e of emps) {
    const has = await prisma.khoaiTransaction.count({ where: { employeeId: e.id } });
    if (has === 0) await prisma.khoaiTransaction.create({ data: { employeeId: e.id, delta: e.khoaiBalance, balanceAfter: e.khoaiBalance, reason: "opening", note: "Số dư mở sổ" } });
  }

  // 6) Wicer Card — bộ bài mặc định (idempotent theo message; admin thêm/sửa/xoá ở Console)
  let cardN = 0;
  for (const c of DEFAULT_DECK) {
    const ex = await prisma.wicerCard.findFirst({ where: { message: c.message } });
    if (!ex) { await prisma.wicerCard.create({ data: { message: c.message, category: c.category, emoji: c.emoji, rarity: c.rarity, rewardKhoai: c.rewardKhoai, sortOrder: ++cardN * 10 } }); }
  }

  console.log("✅ Seed xong: rule quy đổi + chiến dịch + quà WiThanks + ledger mở sổ + bộ bài Wicer Card.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
