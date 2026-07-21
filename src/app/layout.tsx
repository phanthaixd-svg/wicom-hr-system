import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Move for Wishare — Cổng vận động gây quỹ",
  description: "Đăng nhập Lark, kết nối Strava, xem quỹ và bảng xếp hạng của Wicom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
