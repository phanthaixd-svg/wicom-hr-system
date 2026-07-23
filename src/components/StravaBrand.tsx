"use client";

import { useState } from "react";

// Tuân thủ Strava Brand Guidelines (https://developers.strava.com/guidelines):
// - Nút cấp quyền PHẢI dùng asset chính thức "Connect with Strava" (cao 48px hoặc 96px), KHÔNG sửa/đổi màu.
// - Dữ liệu lấy từ Strava phải có link "View on Strava" (đậm/gạch chân/cam #FC5200).
// - Nơi hiển thị dữ liệu Strava nên gắn logo "Powered by Strava".
// Đặt file asset chính thức vào public/strava/ (xem public/strava/README.md).
const CONNECT_BTN = "/strava/btn_strava_connect_orange.svg";
const POWERED_BY = "/strava/powered_by_strava_horiz.svg"; // bản cam — nền sáng
const POWERED_BY_WHITE = "/strava/powered_by_strava_horiz_white.svg"; // bản trắng — nền tối

// Nút "Connect with Strava" — asset gốc, không chỉnh sửa.
export function ConnectWithStrava({ href = "/api/strava/connect", className = "" }: { href?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    // Dự phòng khi chưa thả asset vào public/strava/ — vẫn giữ đúng câu chữ Strava yêu cầu.
    return <a className={`btn btn-strava ${className}`} href={href}>Connect with Strava</a>;
  }
  return (
    <a className={`strava-connect ${className}`} href={href} aria-label="Connect with Strava">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={CONNECT_BTN} alt="Connect with Strava" height={48} onError={() => setBroken(true)} />
    </a>
  );
}

// Link "View on Strava" — chỉ hiện với hoạt động có nguồn từ Strava.
export function ViewOnStrava({ stravaId, className = "" }: { stravaId?: string | number | null; className?: string }) {
  if (!stravaId) return null;
  return (
    <a
      className={`view-on-strava ${className}`}
      href={`https://www.strava.com/activities/${stravaId}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      View on Strava
    </a>
  );
}

// Logo "Powered by Strava" cho khu vực hiển thị dữ liệu Strava.
// Render cả 2 bản (cam / trắng), CSS chọn bản hợp nền theo giao diện sáng-tối.
export function PoweredByStrava({ className = "" }: { className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className={`powered-by-strava-txt ${className}`}>Powered by Strava</span>;
  return (
    <span className={`pbs ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="powered-by-strava pbs-light" src={POWERED_BY} alt="Powered by Strava" height={20} onError={() => setBroken(true)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="powered-by-strava pbs-dark" src={POWERED_BY_WHITE} alt="" aria-hidden="true" height={20} />
    </span>
  );
}
