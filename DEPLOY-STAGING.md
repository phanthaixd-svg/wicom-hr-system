# 🚀 Deploy STAGING (Vercel) — cho 3–5 người test

> Bản này để **test**, tách hẳn production. Mọi số liệu bắt đầu từ trắng.
> Đã chuẩn bị sẵn (Claude làm): repo git + commit đầu tiên, Prisma engine cho Vercel, migrations, build PASS.

Sếp làm lần lượt 7 bước. Chỗ cần copy đều có sẵn lệnh.

---

## Bước 1 — Tạo database cloud (Neon, miễn phí)
Vercel không nối được Postgres ở máy Sếp, nên cần 1 DB trên mây.
1. Vào **neon.tech** → Sign up (bằng Google/GitHub).
2. **Create project** (chọn region gần VN, vd Singapore).
3. Ở màn hình **Connection string**, copy chuỗi dạng:
   `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   → Nếu có 2 lựa chọn **Pooled / Direct**, chọn **Direct**. Lưu lại chuỗi này (gọi là `DATABASE_URL`).

## Bước 2 — Nạp cấu trúc bảng + dữ liệu nền vào DB (chạy 1 lần từ máy Mac)
Mở Terminal, dán (thay `<CHUỖI_NEON>` bằng chuỗi ở Bước 1):
```bash
cd ~/wicom-move
DATABASE_URL="<CHUỖI_NEON>" npm run db:migrate   # tạo toàn bộ bảng
DATABASE_URL="<CHUỖI_NEON>" npm run db:seed      # nạp rule + quà + bộ bài Wicer Card + ledger
```
Thấy "All migrations… applied" và "✅ Seed xong" là được.

## Bước 3 — Đưa code lên GitHub
1. Vào **github.com** → New repository → đặt tên `wicer-hr`, chọn **Private**, KHÔNG tích thêm gì → Create.
2. Dán (thay `<USER>` bằng tên GitHub của Sếp):
```bash
cd ~/wicom-move
git remote add origin https://github.com/<USER>/wicer-hr.git
git push -u origin main
```
(GitHub sẽ hỏi đăng nhập — dùng tài khoản GitHub của Sếp.)

## Bước 4 — Import vào Vercel + đặt biến môi trường
1. Vào **vercel.com** → Sign up bằng GitHub → **Add New… → Project** → chọn repo `wicer-hr`.
2. Ở **Project Name** đặt `wicer-hr` → domain sẽ là **https://wicer-hr.vercel.app** (nhớ tên này cho Bước 5).
3. Mở **Environment Variables**, thêm từng dòng dưới đây (giá trị nào có sẵn thì điền, LARK lấy trong Lark Console):

| Name | Value (staging) |
|---|---|
| `DATABASE_URL` | *(chuỗi Neon ở Bước 1)* |
| `SESSION_SECRET` | *(tạo bằng lệnh dưới)* |
| `APP_BASE_URL` | `https://wicer-hr.vercel.app` |
| `ADMIN_EMAILS` | `thaiphan@wicom.asia` |
| `LARK_NOTIFY_ENABLED` | `false` |
| `LARK_CLIENT_ID` | *(từ Lark Console)* |
| `LARK_CLIENT_SECRET` | *(từ Lark Console)* |
| `LARK_API_BASE` | `https://open.larksuite.com` |
| `LARK_AUTHORIZE_URL` | `https://accounts.larksuite.com/open-apis/authen/v1/authorize` |
| `LARK_TOKEN_URL` | `https://passport.larksuite.com/suite/passport/oauth/token` |
| `LARK_USERINFO_URL` | `https://passport.larksuite.com/suite/passport/oauth/userinfo` |

Tạo `SESSION_SECRET` (chạy ở Terminal, copy kết quả dán vào Vercel):
```bash
openssl rand -base64 32
```
4. Bấm **Deploy**, đợi ~2 phút.

## Bước 5 — Khai báo callback Lark (để đăng nhập được)
Trong **Lark Developer Console** → app của Wicom → **Security settings / Redirect URL**, thêm:
```
https://wicer-hr.vercel.app/api/auth/lark/callback
```
(Giữ luôn URL production cũ — Lark cho phép nhiều URL.)

## Bước 6 — (Khuyến khích) Strava, để test cả Move4Wishare
Strava nay **KHÔNG bắt buộc**: sau khi đăng nhập Lark, người test thấy màn "Kết nối Strava" nhưng có nút **"Để sau, vào khám phá trước →"** để bỏ qua và vẫn dùng WiThanks/Wicer Card ngay. Họ kết nối Strava sau tại **Trang của tôi → Ứng dụng đã kết nối**.
Muốn test đầy đủ Move4Wishare (tự nhận hoạt động), cấu hình Strava:
- Tạo **1 app Strava riêng cho staging** ở strava.com/settings/api, đặt **Authorization Callback Domain** = `wicer-hr.vercel.app`.
- Thêm vào Vercel env: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` (tự đặt) → **Redeploy**.

## Bước 7 — Kiểm tra (smoke test)
1. Mở **https://wicer-hr.vercel.app** → đăng nhập Lark → (kết nối Strava hoặc bấm "Để sau") → vào app.
2. Tài khoản của Sếp **tự động là Admin** (nhờ `ADMIN_EMAILS`). Mở **HR Setting** ở menu trái.
3. Thử: tặng khoai 1 người · lật 1 thẻ Wicer Card · vào HR Setting cấp quyền HR cho 1 người test.
4. Gửi link cho 3–5 người test.

---

## Cập nhật code về sau (sau khi Claude sửa)
```bash
cd ~/wicom-move
git add -A && git commit -m "cập nhật"
git push          # Vercel tự deploy lại
```
Nếu có đổi schema DB, chạy thêm: `DATABASE_URL="<CHUỖI_NEON>" npm run db:migrate`.

## Muốn chỉ 3–5 người test được vào (chặn 45 người còn lại)?
Hiện mọi nhân sự Lark Wicom đăng nhập đều vào được. Muốn giới hạn → báo Claude thêm biến `ALLOWED_EMAILS` (whitelist). Khi lên production chỉ cần xoá biến đó.
