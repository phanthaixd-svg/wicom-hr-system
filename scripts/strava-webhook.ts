/**
 * Quản lý Strava webhook subscription.
 * Chạy:
 *   npm run strava:webhook create    # tạo subscription (cần app đã deploy & callback HTTPS công khai)
 *   npm run strava:webhook view      # xem subscription hiện có
 *   npm run strava:webhook delete <id>
 *
 * Lưu ý: callback_url phải là HTTPS truy cập được từ Internet. Khi dev local,
 * dùng ngrok/cloudflared để tạo tunnel và đặt APP_BASE_URL tạm thời.
 */

try {
  // Node >= 20.6 có sẵn; nạp biến từ .env
  (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(".env");
} catch {
  // bỏ qua nếu đã có env sẵn trong môi trường
}

const BASE = "https://www.strava.com/api/v3/push_subscriptions";
const clientId = process.env.STRAVA_CLIENT_ID!;
const clientSecret = process.env.STRAVA_CLIENT_SECRET!;
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!;
const callbackUrl = `${process.env.APP_BASE_URL}/api/strava/webhook`;

async function view() {
  const p = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  const res = await fetch(`${BASE}?${p}`);
  console.log(res.status, await res.text());
}

async function create() {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    }),
  });
  console.log("callback_url:", callbackUrl);
  console.log(res.status, await res.text());
}

async function del(id: string) {
  const p = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  const res = await fetch(`${BASE}/${id}?${p}`, { method: "DELETE" });
  console.log(res.status, (await res.text()) || "(đã xoá)");
}

const cmd = process.argv[2];
if (cmd === "create") create();
else if (cmd === "view") view();
else if (cmd === "delete") del(process.argv[3]);
else console.log("Dùng: create | view | delete <id>");
