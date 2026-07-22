"use client";

import { useEffect, useState } from "react";

type Key = "larkNotifyThanks" | "larkNotifyActivity" | "larkNotifyComment" | "larkNotifyReaction" | "larkNotifyDigest";

const ROWS: { key: Key; icon: string; title: string; sub: string }[] = [
  { key: "larkNotifyThanks", icon: "🥔", title: "Khoai & lời cảm ơn", sub: "Khi bạn nhận hoặc gửi khoai (WiThanks)" },
  { key: "larkNotifyActivity", icon: "🏃", title: "Hoạt động mới", sub: "Khi hoạt động của bạn được ghi nhận vào quỹ" },
  { key: "larkNotifyComment", icon: "💬", title: "Bình luận", sub: "Khi có người bình luận hoạt động của bạn" },
  { key: "larkNotifyReaction", icon: "❤️", title: "Cảm xúc", sub: "Khi có người thả cảm xúc lên hoạt động của bạn" },
  { key: "larkNotifyDigest", icon: "📊", title: "Tổng kết tuần", sub: "Bản tóm tắt tuần qua vào sáng thứ 2" },
];

// Bật/tắt từng loại DM thông báo qua Lark.
export default function NotifySettings() {
  const [prefs, setPrefs] = useState<Record<Key, boolean>>({
    larkNotifyThanks: true, larkNotifyActivity: true, larkNotifyComment: true, larkNotifyReaction: true, larkNotifyDigest: true,
  });
  const [ready, setReady] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/me/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setPrefs({
            larkNotifyThanks: j.larkNotifyThanks,
            larkNotifyActivity: j.larkNotifyActivity,
            larkNotifyComment: j.larkNotifyComment,
            larkNotifyReaction: j.larkNotifyReaction,
            larkNotifyDigest: j.larkNotifyDigest,
          });
          setReady(j.larkReady);
        }
        setLoaded(true);
      });
  }, []);

  const toggle = async (key: Key) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next })); // lạc quan
    await fetch("/api/me/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    });
  };

  if (!loaded) return null;

  return (
    <div className="card notify-card">
      <div className="notify-head">
        <h3>🔔 Thông báo Lark</h3>
        <p className="sub">Chọn loại tin nhắn bạn muốn nhận từ bot Wicer qua Lark.</p>
      </div>
      <div className="notify-list">
        {ROWS.map((r) => (
          <div className="notify-row" key={r.key}>
            <div className="notify-meta">
              <span className="notify-ic">{r.icon}</span>
              <div>
                <b>{r.title}</b>
                <span className="notify-sub">{r.sub}</span>
              </div>
            </div>
            <button
              className={`switch${prefs[r.key] ? " on" : ""}`}
              onClick={() => toggle(r.key)}
              role="switch"
              aria-checked={prefs[r.key]}
              aria-label={`Bật/tắt ${r.title}`}
            >
              <span className="knob" />
            </button>
          </div>
        ))}
      </div>
      {!ready && (
        <p className="notify-hint">
          ⚙️ Lark app chưa được cấu hình gửi tin. Sau khi Admin cấp quyền <code>im:message</code> &amp; publish app, thông báo sẽ tự hoạt động.
        </p>
      )}
    </div>
  );
}
