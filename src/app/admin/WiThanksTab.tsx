"use client";

import { useEffect, useState } from "react";

interface Fulfillment {
  id: string; kind: string; title: string; khoai: number; status: string;
  counterpart: string | null; hrNote: string | null; createdAt: string; fulfilledAt: string | null;
  employee: { name: string; avatarUrl: string | null };
}

const KIND_PILL: Record<string, { label: string; cls: string }> = {
  individual: { label: "Cá nhân", cls: "ind" },
  special: { label: "Special Gift", cls: "sg" },
  squad: { label: "Squad", cls: "sq" },
  greenfield: { label: "Green Field", cls: "gf" },
};
function when(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function WiThanksTab() {
  const [pending, setPending] = useState<Fulfillment[]>([]);
  const [recent, setRecent] = useState<Fulfillment[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch("/api/admin/withanks", { cache: "no-store" });
    if (res.ok) { const j = await res.json(); setPending(j.pending); setRecent(j.recent); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "fulfill" | "cancel") => {
    if (action === "cancel" && !confirm("Huỷ mục này? (không hoàn khoai tự động)")) return;
    setBusy(id);
    const res = await fetch("/api/admin/withanks", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, hrNote: notes[id] || "" }),
    });
    setBusy(null);
    if (res.ok) { setNotes((n) => { const m = { ...n }; delete m[id]; return m; }); load(); }
    else { const j = await res.json().catch(() => ({})); alert(j.message || "Thao tác thất bại."); }
  };

  if (loading) return <div className="loading">Đang tải…</div>;

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>
          🥔 Hàng đợi WiThanks {pending.length > 0 && <span className="pill warn" style={{ marginLeft: 6 }}>{pending.length}</span>}
        </h3>
        <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          Quà cá nhân đã đổi · Special Gift chờ trao · Squad/Green Field đã đạt mốc. Ghi chú sẽ lưu vào hồ sơ nhân sự. Sửa số dư khoai làm ở tab Nhân sự (ghi vào sổ cái).
        </p>

        {pending.length === 0 ? (
          <div className="act-empty" style={{ display: "block" }}>🎉 Không có mục nào chờ xử lý.</div>
        ) : (
          <div className="wta-list">
            {pending.map((f) => {
              const p = KIND_PILL[f.kind] ?? { label: f.kind, cls: "ind" };
              return (
                <div className="wta-item" key={f.id}>
                  <div className="wta-main">
                    <span className={`pill wtp-${p.cls}`}>{p.label}</span>
                    <div className="wta-body">
                      <div className="wta-title">{f.title}</div>
                      <div className="wta-sub">
                        {f.kind === "special" && f.counterpart ? `${f.counterpart} → ${f.employee.name}` : f.employee.name}
                        {" · "}<span className="tnum">{f.khoai}🥔</span>{" · "}{when(f.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="wta-act">
                    <input placeholder="Ghi chú HR (tuỳ chọn)…" value={notes[f.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))} />
                    <button className="appr-ok" disabled={busy === f.id} onClick={() => act(f.id, "fulfill")}>✓ Hoàn tất</button>
                    <button className="appr-no" disabled={busy === f.id} onClick={() => act(f.id, "cancel")}>✕ Huỷ</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Đã xử lý gần đây</h3>
          <div className="appr-recent">
            {recent.map((f) => {
              const p = KIND_PILL[f.kind] ?? { label: f.kind, cls: "ind" };
              return (
                <div className="appr-rec-row" key={f.id}>
                  <span className={`status ${f.status === "fulfilled" ? "s-appr" : "s-pend"}`}>{f.status === "fulfilled" ? "Hoàn tất" : "Đã huỷ"}</span>
                  <span className={`pill wtp-${p.cls}`} style={{ flex: "none" }}>{p.label}</span>
                  <span className="arr-name">{f.title}</span>
                  <span className="arr-who">{f.employee.name}</span>
                  <span className="arr-amt tnum">{f.khoai}🥔</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
