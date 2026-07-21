/**
 * Kéo TOÀN BỘ lịch sử hoạt động Strava của mọi nhân sự đã kết nối (không giới hạn thời gian).
 * Chạy: npm run strava:history
 *
 * Lật trang per_page=200 từ hoạt động đầu tiên; dừng khi hết trang.
 * Có nghỉ ngắn giữa các trang để tôn trọng rate limit của Strava.
 */

try {
  (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(".env");
} catch {
  /* env đã có sẵn */
}

import { PrismaClient } from "@prisma/client";
import { getValidAccessToken, listActivities } from "../src/lib/strava";
import { upsertActivity } from "../src/lib/ingest";
import { getConversionContext } from "../src/lib/conversion";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const accounts = await prisma.stravaAccount.findMany({ where: { revokedAt: null } });
  console.log(`Tìm thấy ${accounts.length} tài khoản Strava đã kết nối.`);
  const ctx = await getConversionContext();

  for (const acc of accounts) {
    const token = await getValidAccessToken(acc);
    let page = 1;
    let count = 0;
    const perPage = 200;

    // after=1 (≈ từ 1970) => lấy tất cả. Lật tới khi trang trả về < perPage.
    while (page <= 200) {
      const acts = await listActivities(token, 1, page, perPage);
      for (const a of acts) {
        await upsertActivity(acc.employeeId, a, ctx);
        count++;
      }
      process.stdout.write(`  athlete ${acc.athleteId}: trang ${page}, +${acts.length} (tổng ${count})\n`);
      if (acts.length < perPage) break;
      page++;
      await sleep(1200); // nghỉ nhẹ tránh chạm rate limit
    }
    console.log(`✅ athlete ${acc.athleteId}: đã đồng bộ ${count} hoạt động.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
