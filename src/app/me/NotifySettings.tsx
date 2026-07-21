"use client";

import { useEffect, useState } from "react";

// Bật/tắt nhận DM Lark khi có người thả cảm xúc lên hoạt động của mình.
export default function NotifySettings() {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/me/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setOn(j.larkNotifyReaction);
          setReady(j.larkReady);
        }
        setLoaded(true);
      });
  }, []);

  const toggle = async () => {
    const next = !on;
    setOn(next); // lạc quan
    await fetch("/api/me/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ larkNotifyReaction: next }),
    });
  };

  if (!loaded) return null;

  return (
    <div className="card notify-card">
      <div className="notify-row">
        <div>
          <h3>🔔 Thông báo Lark</h3>
          <p className="sub">Nhận tin nhắn khi có người thả cảm xúc lên hoạt động của bạn</p>
        </div>
        <button className={`switch${on ? " on" : ""}`} onClick={toggle} role="switch" aria-checked={on} aria-label="Bật/tắt thông báo Lark">
          <span className="knob" />
        </button>
      </div>
      {!ready && (
        <p className="notify-hint">
          ⚙️ Lark app chưa được cấu hình gửi tin. Sau khi Admin cắm API key &amp; cấp quyền <code>im:message</code>, thông báo sẽ tự hoạt động.
        </p>
      )}
    </div>
  );
}
