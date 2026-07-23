"use client";

import { useState } from "react";
import { ConnectWithStrava, PoweredByStrava } from "@/components/StravaBrand";

// Quản lý app đã kết nối của user. Hiện tại: Strava (đọc hoạt động).
export default function ConnectApps({ connected, onChange }: { connected: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  const disconnect = async () => {
    if (!confirm("Ngừng kết nối Strava? Hệ thống sẽ không nhận hoạt động mới của bạn nữa. Hoạt động đã có vẫn được giữ lại.")) return;
    setBusy(true);
    const res = await fetch("/api/strava/disconnect", { method: "POST" });
    setBusy(false);
    if (res.ok) onChange();
  };

  return (
    <div className="card connect-apps">
      <div className="ca-head">🔗 Ứng dụng đã kết nối</div>
      <div className="ca-item">
        <div className="ca-logo strava">⛰️</div>
        <div className="ca-meta">
          <b>Strava</b>
          <span>Tự đồng bộ hoạt động tập luyện</span>
        </div>
        {connected ? (
          <div className="ca-right">
            <span className="ca-badge on"><span className="ca-dot" /> Đã kết nối</span>
            <button className="ca-btn off" onClick={disconnect} disabled={busy}>
              {busy ? "Đang ngắt…" : "Ngừng kết nối"}
            </button>
          </div>
        ) : (
          <div className="ca-right">
            <span className="ca-badge off">Chưa kết nối</span>
            {/* Asset chính thức theo Strava Brand Guidelines */}
            <ConnectWithStrava href="/api/strava/connect" />
          </div>
        )}
      </div>
      <div className="ca-foot"><PoweredByStrava /></div>
    </div>
  );
}
