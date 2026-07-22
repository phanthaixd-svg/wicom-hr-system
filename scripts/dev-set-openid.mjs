/**
 * DEV ONLY — gán open_id Lark thật cho 1 nhân sự trong DB LOCAL,
 * để test notification thật (bot DM vào Lark của người đó) khi chạy local.
 *
 * Dùng:
 *   node scripts/dev-set-openid.mjs "<email hoặc tên>" "<open_id>"
 * Ví dụ:
 *   node scripts/dev-set-openid.mjs "Phan Thai" "ou_abc123..."
 */
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env"); // Node >= 20.6
} catch {
  /* env đã có sẵn */
}

const [target, openId] = process.argv.slice(2);
if (!target || !openId) {
  console.log('Dùng: node scripts/dev-set-openid.mjs "<email hoặc tên>" "<open_id>"');
  process.exit(1);
}

const prisma = new PrismaClient();
const emp = await prisma.employee.findFirst({
  where: { OR: [{ email: target }, { name: { contains: target } }] },
  select: { id: true, name: true, email: true },
});
if (!emp) {
  console.log("❌ Không tìm thấy nhân sự khớp:", target);
  await prisma.$disconnect();
  process.exit(1);
}
await prisma.employee.update({ where: { id: emp.id }, data: { larkOpenId: openId } });
console.log(`✅ Đã gán open_id cho: ${emp.name} (${emp.email ?? "—"})`);
console.log("   → Dev Login vào người này rồi trigger hành động, bot sẽ DM vào Lark thật của họ.");
await prisma.$disconnect();
