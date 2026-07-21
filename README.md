# Wicom Move — Cổng vận động gây quỹ

Website nội bộ Wicom: nhân sự **đăng nhập bằng Lark**, **cấp quyền Strava**, hệ thống tự kéo hoạt động về, **quy đổi thành quỹ** (theo km hoặc theo số hoạt động) và hiển thị **dashboard + bảng xếp hạng** có lọc theo ngày.

## Công nghệ
- **Next.js 15** (App Router, TypeScript) — cả frontend và backend API
- **Prisma + PostgreSQL** — lưu nhân sự, token, hoạt động, tỷ lệ quy đổi
- **Lark OAuth 2.0** — đăng nhập SSO, giới hạn trong tenant Wicom
- **Strava OAuth + Webhook** — nhận hoạt động real-time, tự làm mới token
- Session bằng JWT ký (cookie httpOnly) — không cần dịch vụ auth ngoài

## Cấu trúc
```
src/
  lib/           sports, conversion, session, lark, strava, ingest, backfill, db
  app/
    page.tsx                  Trang đăng nhập (Lark)
    connect/page.tsx          Trang cấp quyền Strava
    dashboard/                Dashboard (server guard + client component)
    api/
      auth/lark/…             OAuth Lark: redirect + callback + logout
      strava/connect,callback OAuth Strava
      strava/webhook          Nhận event real-time (GET validate, POST xử lý)
      dashboard               Tổng hợp số liệu theo khoảng ngày
      cron/backfill           Đối soát dự phòng (bảo vệ bằng CRON_SECRET)
  middleware.ts               Chặn sớm route chưa đăng nhập
prisma/schema.prisma          Schema DB + seed.ts (rule + campaign mặc định)
scripts/strava-webhook.ts     Tạo/xem/xoá webhook subscription
```

## Cài đặt local
1. **Cài dependency**
   ```bash
   npm install
   ```
2. **Tạo `.env`** từ mẫu và điền giá trị:
   ```bash
   cp .env.example .env
   # tạo SESSION_SECRET: openssl rand -base64 32
   ```
3. **Tạo DB** (PostgreSQL) và đẩy schema + seed:
   ```bash
   npm run db:push
   npm run db:seed
   ```
4. **Chạy dev**
   ```bash
   npm run dev   # http://localhost:3000
   ```

## Đăng ký ứng dụng Lark
1. Vào **Lark Developer Console** → tạo app nội bộ cho Wicom.
2. Lấy **Client ID / Client Secret** → điền `LARK_CLIENT_ID`, `LARK_CLIENT_SECRET`.
3. Bật quyền đọc hồ sơ (name, email) và cấu hình **Redirect URL**:
   `https://move.wicom.vn/api/auth/lark/callback`
4. Nếu muốn siết chỉ nhân sự Wicom: điền `LARK_TENANT_KEY` (Tenant Key của Wicom).
5. Kiểm tra vùng: quốc tế dùng `larksuite.com` (mặc định trong `.env.example`); nếu Wicom dùng **Feishu** thì đổi `LARK_AUTHORIZE_URL/TOKEN_URL/USERINFO_URL` sang `feishu.cn`. **Xác nhận chính xác các endpoint trong Console** trước khi lên production.

## Đăng ký ứng dụng Strava
1. Vào https://www.strava.com/settings/api → tạo application.
2. Lấy **Client ID / Client Secret** → điền `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`.
3. Đặt **Authorization Callback Domain** = `move.wicom.vn`.
4. Đặt `STRAVA_WEBHOOK_VERIFY_TOKEN` (chuỗi tự chọn).

## Đăng ký Webhook Strava (sau khi deploy có HTTPS công khai)
```bash
npm run strava:webhook create   # tạo subscription tới /api/strava/webhook
npm run strava:webhook view     # kiểm tra
npm run strava:webhook delete <id>
```
> Webhook yêu cầu `callback_url` là HTTPS truy cập được từ Internet. Khi dev local, dùng **ngrok**/**cloudflared** tạo tunnel và đặt `APP_BASE_URL` tạm thời trỏ về tunnel đó.

## Cron đối soát (dự phòng khi webhook lỡ event)
Gọi định kỳ (vd. mỗi đêm) — bảo vệ bằng `CRON_SECRET`:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://move.wicom.vn/api/cron/backfill?days=3"
```
Trên Vercel: thêm mục trong `vercel.json` → `crons`. Trên server riêng: dùng `cron` gọi curl.

## Luồng hoạt động
1. Nhân sự bấm **Đăng nhập với Lark** → `/api/auth/lark` → Lark → callback tạo/đăng nhập nhân sự.
2. Nếu chưa liên kết Strava → trang **/connect** → cấp quyền → lưu token + nạp lịch sử 90 ngày.
3. Về sau, mỗi hoạt động mới → Strava đẩy **webhook** → hệ thống lấy chi tiết, chuẩn hoá, quy đổi, lưu.
4. **Dashboard** đọc dữ liệu theo khoảng ngày, dựng 3 bảng xếp hạng: tổng tiền, km theo môn, số hoạt động theo môn.

## Quy đổi quỹ
- Cấu hình trong bảng `ConversionRule` (seed sẵn mặc định, admin chỉnh sau):
  - **Theo km:** `quỹ = km × rate` (chạy 5.000đ, đạp 2.000đ, bơi 12.000đ…)
  - **Theo activity:** `quỹ = rate cố định/buổi` (Yoga/Gym 20.000đ)
- Hoạt động **nhập tay** hoặc **pace bất thường** (vd. chạy > 25 km/h) bị gắn cờ → `amountVnd = 0` tới khi admin duyệt (xem `src/lib/sports.ts`).

## Bảo mật cần lưu ý trước khi lên production
- `SESSION_SECRET`, `*_CLIENT_SECRET`, `CRON_SECRET` chỉ đặt trong biến môi trường của hosting — không commit.
- **Nên mã hoá token Strava at rest** (hiện lưu plaintext trong DB cho gọn scaffold) — thêm lớp mã hoá ở `src/lib/strava.ts` khi lưu/đọc.
- Bật HTTPS (bắt buộc cho webhook Strava và cookie `secure`).
- Cân nhắc thêm xác thực chữ ký/allowlist cho webhook.

## Trạng thái scaffold
Đây là bộ khung **chạy được end-to-end** khi đã cấu hình đủ credential + DB. Các phần nên bổ sung tuỳ nhu cầu: trang admin chỉnh rate, trang cá nhân từng nhân viên, biểu đồ theo thời gian, xuất báo cáo quỹ, và mã hoá token.
