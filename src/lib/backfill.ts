import { prisma } from "./db";
import { getValidAccessToken, listActivities } from "./strava";
import { upsertActivity } from "./ingest";
import { getConversionContext } from "./conversion";
import type { StravaAccount } from "@prisma/client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Nạp/đối soát hoạt động của 1 account từ mốc `afterEpoch` (unix seconds).
// afterEpoch = 1 => kéo toàn bộ lịch sử (lifetime). Có phân trang; dừng khi trang < perPage.
export async function backfillAccount(account: StravaAccount, afterEpoch: number): Promise<number> {
  if (account.revokedAt) return 0;
  const token = await getValidAccessToken(account);
  const ctx = await getConversionContext();
  let page = 1;
  let total = 0;
  const perPage = 200; // tối đa Strava cho phép
  // Trần 200 trang (≈ 40.000 hoạt động) làm chốt an toàn.
  while (page <= 200) {
    const acts = await listActivities(token, afterEpoch, page, perPage);
    for (const a of acts) {
      await upsertActivity(account.employeeId, a, ctx);
      total++;
    }
    if (acts.length < perPage) break;
    page++;
    await sleep(800); // nghỉ nhẹ giữa các trang, tránh chạm rate limit
  }
  return total;
}

// Backfill toàn bộ account đang hoạt động (dùng cho cron).
export async function backfillAll(days: number): Promise<{ accounts: number; activities: number }> {
  const afterEpoch = Math.floor(Date.now() / 1000) - days * 86400;
  const accounts = await prisma.stravaAccount.findMany({ where: { revokedAt: null } });
  let activities = 0;
  for (const acc of accounts) {
    try {
      activities += await backfillAccount(acc, afterEpoch);
    } catch (e) {
      console.error(`Backfill lỗi cho account ${acc.id}`, e);
    }
  }
  return { accounts: accounts.length, activities };
}
