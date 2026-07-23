/* Gửi card mẫu tất cả trường hợp WiThanks tới Lark của 1 người (để duyệt thiết kế).
   Chạy: APP_BASE_URL=https://... node --env-file=.env --import tsx scripts/send-sample-cards.ts [email] */
import { notifyThanksReceived, notifyThanksGiven, sendLarkText } from "../src/lib/larkNotify";

const API_BASE = process.env.LARK_API_BASE || "https://open.larksuite.com";
const EMAILS = process.argv.slice(2).length ? process.argv.slice(2) : ["thaiphan@wicom.asia", "phanthai.xd@gmail.com"];

async function tenantToken(): Promise<string> {
  const r = await fetch(`${API_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: process.env.LARK_CLIENT_ID, app_secret: process.env.LARK_CLIENT_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`tenant_access_token lỗi: ${j.code} ${j.msg}`);
  return j.tenant_access_token;
}

async function resolveOpenId(token: string, emails: string[]): Promise<string | null> {
  const r = await fetch(`${API_BASE}/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ emails }),
  });
  const j = await r.json();
  console.log("batch_get_id:", JSON.stringify(j.data ?? j));
  for (const u of j.data?.user_list ?? []) if (u.user_id) return u.user_id as string;
  return null;
}

async function main() {
  const token = await tenantToken();
  const openId = await resolveOpenId(token, EMAILS);
  if (!openId) { console.error("❌ Không tìm được open_id cho:", EMAILS); process.exit(1); }
  console.log("✅ open_id:", openId);

  const label = (t: string) => sendLarkText(openId, `━━━━━━━━━━\n${t}`);
  const msg = "Cảm ơn bạn đã hỗ trợ team hết mình tuần này!";

  await label("① APP · THANKS · card NGƯỜI GỬI");
  await notifyThanksGiven(openId, { receiverNames: "Yến Trần", khoai: 3, message: msg, remaining: "Bạn còn 12 khoai để tặng tuần này.", kind: "thanks" });

  await label("② APP · THANKS · card NGƯỜI NHẬN");
  await notifyThanksReceived(openId, { giverName: "Phạm Trung Hiếu", khoai: 3, message: msg, totalBalance: 58, kind: "thanks", valueTagLabel: "🤝 Tinh thần đồng đội" });

  await label("③ APP · SUPER THANKS · card NGƯỜI GỬI");
  await notifyThanksGiven(openId, { receiverNames: "Hoài Thu", khoai: 30, message: "Người truyền cảm hứng nhất tháng — cảm ơn chị!", remaining: "", kind: "super" });

  await label("④ APP · SUPER THANKS · card NGƯỜI NHẬN");
  await notifyThanksReceived(openId, { giverName: "Thi Hương", khoai: 30, message: "Người truyền cảm hứng nhất tháng — cảm ơn chị!", totalBalance: 88, kind: "super" });

  await label("⑤ APP · SPECIAL GIFT · card NGƯỜI GỬI");
  await notifyThanksGiven(openId, { receiverNames: "Yến Trần", khoai: 100, message: "Cảm ơn vì 2 năm gắn bó và cống hiến 💛", remaining: "", kind: "special" });

  await label("⑥ APP · SPECIAL GIFT · card NGƯỜI NHẬN");
  await notifyThanksReceived(openId, { giverName: "Phan Thái", khoai: 100, message: "Cảm ơn vì 2 năm gắn bó và cống hiến 💛", totalBalance: 158, kind: "special" });

  await label("⑦ LARK GROUP 🥔 · card NGƯỜI GỬI (dùng chung card app)");
  await notifyThanksGiven(openId, { receiverNames: "Hoai Thu, Yến Trần", khoai: 2, message: "Ngon lành cành đào", remaining: "Số khoai còn lại của bạn trong tuần là không giới hạn, trong tháng là không giới hạn.", kind: "thanks" });

  await label("⑧ LARK GROUP 🥔 · card NGƯỜI NHẬN (dùng chung card app)");
  await notifyThanksReceived(openId, { giverName: "Phan Thái", khoai: 2, message: "Ngon lành cành đào", totalBalance: 60, kind: "thanks" });

  console.log("✅ ĐÃ GỬI XONG 8 card mẫu tới Lark.");
}

main().catch((e) => { console.error(e); process.exit(1); });
