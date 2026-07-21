# Wicer Experience (HR system) — Hướng dẫn deploy

App Next.js 15 + Prisma + PostgreSQL, đăng nhập bằng **Lark SSO**. Thông báo qua **Lark bot** (tuỳ chọn), tích hợp **Strava** (cho module Move4Wishare).

Mô hình môi trường:
- **Staging (test):** Vercel — CEO tự dựng để test với vài user thật.
- **Production:** Docker — bàn giao team dev deploy cho toàn công ty.

Cùng một codebase, chỉ khác **biến môi trường**. Mỗi môi trường có **database riêng**.

---

## 1. Biến môi trường

| Biến | Bắt buộc | Ghi chú | Staging | Production |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL. **DB riêng từng môi trường** | DB test (Neon/Supabase…) | DB công ty |
| `SESSION_SECRET` | ✅ | `openssl rand -base64 32`. Mỗi env 1 chuỗi riêng | riêng | riêng |
| `APP_BASE_URL` | ✅ | URL gốc (HTTPS) | https://abc.vercel.app | https://congty.com |
| `NODE_ENV` | ✅ | `production` | production | production |
| `ADMIN_EMAILS` | ✅ | Email tự cấp admin khi đăng nhập (phân tách bằng phẩy) | `thaiphan@wicom.asia` | `thaiphan@wicom.asia` |
| `LARK_CLIENT_ID` / `LARK_CLIENT_SECRET` | ✅ | Lark Developer Console | | |
| `LARK_NOTIFY_ENABLED` | | Bật bot nhắn Lark thật | **`false`** (không DM thật khi test) | `true` |
| `LARK_API_BASE` | | `open.larksuite.com` (quốc tế) / `open.feishu.cn` | | |
| `LARK_AUTHORIZE_URL` / `LARK_TOKEN_URL` / `LARK_USERINFO_URL` | | Xem `.env.example` | | |
| `LARK_TENANT_KEY` | | Siết đăng nhập đúng tenant Wicom | | |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | | Chỉ cần nếu dùng Move4Wishare | | |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | | Chuỗi tự đặt cho webhook | | |
| `CRON_SECRET` | | Bảo vệ endpoint cron (nhắc buổi sáng) | | |
| `CONVERSION_FROM_DATE` | | Mốc bắt đầu quy đổi tiền (YYYY-MM-DD) | | |

Xem đầy đủ mô tả trong [`.env.example`](.env.example).

### Đăng ký callback (làm cho CẢ 2 domain)
- **Lark** → thêm redirect URI: `<APP_BASE_URL>/api/auth/lark/callback` (Lark cho phép nhiều URL → 1 app Lark dùng chung cả staging & prod).
- **Strava** → mỗi app Strava chỉ 1 "Authorization Callback Domain". Muốn test Strava trên staging thì tạo **app Strava riêng** cho staging. *(Có thể bỏ qua Strava ở giai đoạn test WiThanks/Wicer Card.)*

---

## 2. Staging trên Vercel
1. Import repo vào Vercel.
2. Tạo Postgres (Vercel Postgres / Neon / Supabase) → điền `DATABASE_URL`.
3. Nhập các biến ở mục 1 (đặt `LARK_NOTIFY_ENABLED=false`).
4. Deploy. Sau deploy, chạy migrate + seed (một lần) từ máy có `DATABASE_URL` staging:
   ```bash
   npm run db:migrate   # prisma migrate deploy — tạo bảng
   npm run db:seed      # nạp rule + quà + bộ bài Wicer Card + ledger mở sổ
   ```
   > ⚠️ Ảnh upload (`/public/uploads`) **không tồn tại lâu trên Vercel** (serverless). Test nền thẻ bằng **gradient dựng sẵn** là đủ; upload ảnh chỉ hoạt động ổn ở Docker (mục 3) hoặc khi dùng S3/R2.

---

## 3. Production trên Docker (team dev)

Có sẵn [`Dockerfile`](Dockerfile). Entrypoint tự chạy `prisma migrate deploy` (idempotent) rồi start app.

```bash
# build
docker build -t wicer-hr .

# chạy (migrate tự động khi khởi động)
docker run -d --name wicer-hr \
  --env-file .env.production \
  -p 3000:3000 \
  -v wicer_uploads:/app/public/uploads \    # giữ ảnh upload qua các lần deploy
  wicer-hr

# seed dữ liệu nền — CHẠY 1 LẦN sau lần deploy đầu tiên
docker exec wicer-hr npm run db:seed
```

- Đặt sau **reverse proxy (Nginx/Traefik) có HTTPS** cho `congty.com` (cookie `secure` + HSTS cần HTTPS).
- **Volume `/app/public/uploads`** bắt buộc để không mất ảnh khi redeploy. (Khuyến nghị lâu dài: chuyển upload sang **S3/R2**.)
- **Cron nhắc buổi sáng:** đặt lịch ngoài (cron hệ thống / k8s CronJob) gọi:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://congty.com/api/cron/morning-nudge`

> Nếu team muốn tách migration khỏi container app (chạy như job riêng thay vì entrypoint), có thể bỏ `prisma migrate deploy` khỏi `CMD` và chạy `docker run --rm --env-file .env wicer-hr npm run db:migrate` trong pipeline.

---

## 4. Cấp quyền admin
`ADMIN_EMAILS` giúp **email trong danh sách tự thành admin** ngay khi đăng nhập Lark lần đầu (chỉ nâng quyền, không tự hạ). Không cần chạy SQL tay.
Sau đó admin đầu tiên (CEO) vào **Console quản trị** để cấp admin cho HR khác.

---

## 5. Quy trình cập nhật về sau
1. Sửa code → test lại trên **staging**.
2. Merge vào nhánh production → team dev build lại image Docker → deploy.
3. Nếu có đổi schema: đã tạo migration bằng `npm run db:migrate:dev --name <tên>` ở bước dev; khi deploy, entrypoint tự `migrate deploy` — **không mất dữ liệu** (khoai, ledger, bộ sưu tập giữ nguyên).

> Dev workflow: đổi `prisma/schema.prisma` → `npm run db:migrate:dev` (tạo file migration) → commit cả thư mục `prisma/migrations`. **Không** dùng `prisma db push` cho nhánh production.

---

## 6. Kiểm tra khói sau deploy
Đăng nhập Lark → tặng 1 khoai → lật 1 thẻ Wicer Card → mở Console (Nhân sự / WiThanks / Wicer Card). Chạy trơn = OK.
