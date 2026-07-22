"use client";

import { useState } from "react";
import Avatar from "./Avatar";

// Avatar + lời chào + dropdown (đổi theme / System Setting / đăng xuất). Dùng chung mọi header.
export default function UserMenu({
  meName,
  avatarUrl,
  isAdmin,
  activeAdmin,
  onGoMe,
}: {
  meName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  activeAdmin?: boolean;
  onGoMe?: () => void; // điều hướng "mượt" trong SPA (không reload); nếu không có sẽ dùng href
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleTheme = () => {
    const r = document.documentElement;
    const c = r.getAttribute("data-theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = c === "dark" ? "light" : "dark";
    r.setAttribute("data-theme", next);
    try { localStorage.setItem("wm-theme", next); } catch { /* bỏ qua nếu chặn storage */ }
    setMenuOpen(false);
  };

  return (
    <div className="usermenu">
      <button className="user-trigger" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
        <span className="greet">
          <small>Xin chào,</small>
          <b>{meName}</b>
        </span>
        <Avatar name={meName} url={avatarUrl} size={38} />
      </button>
      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="usermenu-pop" role="menu">
            {onGoMe ? (
              <button className="um-item" role="menuitem" onClick={() => { setMenuOpen(false); onGoMe(); }} style={{ width: "100%" }}>
                <span className="um-ic">👤</span> Trang của tôi
              </button>
            ) : (
              <a className="um-item" href="/me" role="menuitem">
                <span className="um-ic">👤</span> Trang của tôi
              </a>
            )}
            <button className="um-item" role="menuitem" onClick={() => toggleTheme()}>
              <span className="um-ic">◐</span> Chế độ ngày / đêm
            </button>
            <form action="/api/auth/logout" method="post">
              <button className="um-item danger" type="submit" role="menuitem" style={{ width: "100%" }}>
                <span className="um-ic">⏻</span> Đăng xuất
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
