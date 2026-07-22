import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Move for Wishare — Cổng vận động gây quỹ",
  description: "Đăng nhập Lark, kết nối Strava, xem quỹ và bảng xếp hạng của Wicom.",
};

// Đặt data-theme TRƯỚC khi trang vẽ (tránh nhấp nháy sáng→tối). Ưu tiên lựa chọn đã lưu,
// nếu chưa có thì theo hệ điều hành. Bọc try/catch để không bao giờ chặn render.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('wm-theme');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
