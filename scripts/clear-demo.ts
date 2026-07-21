/**
 * Xoá toàn bộ dữ liệu demo (nhân sự demo + hoạt động của họ).
 * Chạy: npm run clear:demo
 * Không đụng tới dữ liệu thật (chỉ xoá Employee.larkOpenId bắt đầu bằng "demo-").
 */
try {
  (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(".env");
} catch {
  /* env đã có */
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Activity có onDelete: Cascade nên xoá Employee sẽ xoá luôn hoạt động của họ.
  const res = await prisma.employee.deleteMany({ where: { larkOpenId: { startsWith: "demo-" } } });
  console.log(`✅ Đã xoá ${res.count} nhân sự demo (và toàn bộ hoạt động của họ).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
