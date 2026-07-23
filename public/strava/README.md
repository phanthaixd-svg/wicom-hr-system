# Asset thương hiệu Strava (bắt buộc để pass API review)

Tải bộ asset **chính thức** tại: https://developers.strava.com/guidelines

Sau đó **đổi tên** (chỉ đổi tên file — TUYỆT ĐỐI không sửa/đổi màu/bóp méo hình) và đặt vào đúng thư mục này:

| File cần có ở đây | Lấy từ asset Strava |
|---|---|
| `btn_strava_connect_orange.svg` | Nút **"Connect with Strava"** bản **cam** (dùng bản cao 48px hoặc 96px) |
| `powered_by_strava_horiz.svg` | Logo **"Powered by Strava"** bản ngang (horizontal) |

> Nếu tải về là PNG thay vì SVG, cứ đổi đuôi trong `src/components/StravaBrand.tsx`
> (hằng số `CONNECT_BTN` / `POWERED_BY`).

Khi CHƯA có 2 file này, giao diện vẫn chạy — component tự fallback sang chữ
"Connect with Strava" / "Powered by Strava" (không vỡ layout), nhưng **Strava sẽ không
duyệt** nếu screenshot không thấy nút asset gốc → nhớ thả file vào trước khi nộp review.

## Quy tắc bắt buộc (trích Brand Guidelines)
- Không dùng logo Strava làm icon ứng dụng.
- Không sửa/xoay/animate logo Strava.
- Không dùng chữ "Strava" trong tên ứng dụng, không ngụ ý Strava tài trợ/phát triển.
- Logo Strava không được nổi bật hơn thương hiệu của app.
- Dữ liệu nguồn từ Strava phải kèm link **"View on Strava"** (đậm/gạch chân hoặc cam `#FC5200`).
