import { revalidateTag } from "next/cache";

// Làm mới ngay các dữ liệu tổng đang được cache (unstable_cache) khi có ghi mới,
// để không phải chờ hết 60s. Bọc try/catch: revalidate lỗi không được làm hỏng ghi dữ liệu.
export function revalidateDashboard() {
  try { revalidateTag("dashboard"); } catch { /* bỏ qua */ }
}
export function revalidateHome() {
  try { revalidateTag("home"); } catch { /* bỏ qua */ }
}
// Hoạt động (Move) ảnh hưởng cả bảng Move lẫn huy hiệu/nhịp ở Wicer Home.
export function revalidateBoards() {
  revalidateDashboard();
  revalidateHome();
}
