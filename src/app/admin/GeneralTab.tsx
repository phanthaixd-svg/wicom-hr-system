"use client";

import { useEffect, useState } from "react";

export default function GeneralTab() {
  const [convDate, setConvDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) setConvDate((await res.json()).conversionFromDate || "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversionFromDate: convDate || null }),
    });
    setSaving(false);
    if (res.ok) {
      const j = await res.json();
      setMsg(`✅ Đã lưu. Tính lại quỹ cho ${j.recomputed} hoạt động.`);
    } else {
      setMsg("❌ Lưu thất bại.");
    }
  };

  if (loading) return <div className="loading">Đang tải…</div>;

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ fontSize: 14, marginBottom: 4 }}>Mốc quy đổi tiền của hệ thống</h3>
      <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
        Chỉ những hoạt động từ ngày này trở đi mới được quy đổi thành tiền. Hoạt động trước mốc vẫn hiện đầy đủ
        trong bảng xếp hạng km / số hoạt động (theo số thực), nhưng không cộng vào quỹ. Để trống = tính toàn bộ.
      </p>
      <label className="fld" style={{ maxWidth: 240 }}>
        <span>Quy đổi tiền từ ngày</span>
        <input type="date" value={convDate} onChange={(e) => setConvDate(e.target.value)} />
      </label>
      <div className="save-bar" style={{ position: "static", marginTop: 16 }}>
        {msg && <span className="save-msg">{msg}</span>}
        <span className="grow" />
        <button className="btn-save" onClick={save} disabled={saving}>
          {saving ? "Đang lưu…" : "💾 Lưu & tính lại quỹ"}
        </button>
      </div>
    </div>
  );
}
