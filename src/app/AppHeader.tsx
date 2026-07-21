"use client";

import Logo from "./Logo";
import UserMenu from "./UserMenu";

// Header đơn giản cho các trang phụ (Admin, chi tiết hoạt động): logo→dashboard + menu avatar.
export default function AppHeader({
  meName,
  avatarUrl,
  isAdmin,
  active,
}: {
  meName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  active?: "dashboard" | "me" | "admin";
}) {
  return (
    <div className="nav">
      <div className="nav-in">
        <a className="nav-brand" href="/dashboard">
          <Logo size={30} />
          <b>
            Move for Wishare
            <small>Khoẻ cho mình · Sẻ chia cho cộng đồng</small>
          </b>
        </a>
        <span className="grow" />
        <UserMenu meName={meName} avatarUrl={avatarUrl} isAdmin={isAdmin} activeAdmin={active === "admin"} />
      </div>
    </div>
  );
}
