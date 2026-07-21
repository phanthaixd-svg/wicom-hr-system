/**
 * Seed nhân sự demo + hoạt động mẫu theo 6 phòng ban để xem podium & leaderboard phòng ban.
 * Chạy:  npm run seed:demo
 * Xoá:   npm run clear:demo   (xoá sạch mọi dữ liệu demo, không đụng dữ liệu thật)
 *
 * Nhận diện demo: Employee.larkOpenId bắt đầu bằng "demo-".
 */
try {
  (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(".env");
} catch {
  /* env đã có */
}

import { PrismaClient } from "@prisma/client";
import { upsertActivity } from "../src/lib/ingest";
import type { StravaActivity } from "../src/lib/strava";
import { getConversionContext } from "../src/lib/conversion";

const prisma = new PrismaClient();

// PRNG có hạt giống -> dữ liệu ổn định, tái lập được.
let seed = 20260719;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

const PEOPLE: { n: string; d: string }[] = [
  { n: "Nguyễn Hoàng Long", d: "Product" },
  { n: "Trần Mỹ Linh", d: "Product" },
  { n: "Lê Thu Trang", d: "Marketing" },
  { n: "Phạm Anh Tuấn", d: "Marketing" },
  { n: "Vũ Khánh Chi", d: "Content" },
  { n: "Đỗ Minh Quân", d: "Content" },
  { n: "Hoàng Văn Sơn", d: "Supply Chain" },
  { n: "Bùi Thị Hà", d: "Supply Chain" },
  { n: "Đặng Quốc Huy", d: "Tech & Data" },
  { n: "Ngô Bảo Ngọc", d: "Tech & Data" },
  { n: "Trương Đình Phúc", d: "BOD" },
];

const SPORTS = ["Run", "Ride", "Walk", "Swim", "Hike", "Yoga"];
const ANCHOR = new Date(2026, 6, 19); // 19/07/2026

function genActivity(slug: string, i: number): StravaActivity {
  const type = pick(SPORTS);
  const daysAgo = Math.floor(rnd() * 200); // trải ~200 ngày (có cả trước/sau mốc 01/03)
  const day = new Date(ANCHOR);
  day.setDate(day.getDate() - daysAgo);
  day.setHours(6 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0);

  let km = 0;
  let sec = 0;
  if (type === "Run") { km = 3 + rnd() * 15; sec = km * (300 + rnd() * 90); }
  else if (type === "Ride") { km = 8 + rnd() * 45; sec = km * (115 + rnd() * 35); }
  else if (type === "Walk") { km = 2 + rnd() * 6; sec = km * (640 + rnd() * 100); }
  else if (type === "Swim") { km = 0.6 + rnd() * 2.4; sec = km * (1450 + rnd() * 350); }
  else if (type === "Hike") { km = 4 + rnd() * 10; sec = km * (740 + rnd() * 220); }
  else { sec = 1800 + rnd() * 2700; } // Yoga

  return {
    id: `demo-${slug}-${i}`,
    name: "Demo activity",
    sport_type: type,
    type,
    distance: Math.round(km * 1000),
    moving_time: Math.round(sec),
    elapsed_time: Math.round(sec),
    start_date: day.toISOString(),
    manual: false,
  };
}

async function main() {
  const ctx = await getConversionContext();

  // Xếp CEO thật (Phan Thái) vào phòng BOD để leaderboard phòng ban có đủ mặt.
  await prisma.employee.updateMany({ where: { email: "thaiphan@wicom.asia" }, data: { team: "BOD" } });

  let people = 0;
  let acts = 0;
  for (let p = 0; p < PEOPLE.length; p++) {
    const { n, d } = PEOPLE[p];
    const slug = `p${p}`;
    const emp = await prisma.employee.upsert({
      where: { larkOpenId: `demo-${slug}` },
      create: { larkOpenId: `demo-${slug}`, name: n, team: d, email: `demo-${slug}@demo.local` },
      update: { name: n, team: d },
    });
    const nAct = 8 + Math.floor(rnd() * 16); // 8..23 hoạt động/người
    for (let i = 0; i < nAct; i++) {
      await upsertActivity(emp.id, genActivity(slug, i), ctx);
      acts++;
    }
    people++;
    console.log(`  + ${n} (${d}): ${nAct} hoạt động`);
  }
  console.log(`✅ Đã seed ${people} nhân sự demo, ${acts} hoạt động.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
