"use client";

import { useEffect, useState } from "react";

interface Pending {
  id: string;
  name: string;
  kindName: string;
  icon: string;
  mode: string;
  rateVnd: number;
  distanceKm: number;
  durationMin: number;
  occurredAt: string;
  note: string | null;
  proofUrl: string | null;
  who: { name: string; team: string; avatarUrl: string | null };
  estimateVnd: number;
}
interface Recent { id: string; name: string; who: string; rejected: boolean; amountVnd: number; reviewedAt: string | null }

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
function when(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ApprovalsTab() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/approvals", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      setPending(j.pending);
      setRecent(j.recent);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") {
      reason = prompt("Lý do từ chối (tuỳ chọn, sẽ ghi lại):") ?? undefined;
    }
    setBusyId(id);
    const res = await fetch("/api/admin/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, reason }),
    });
    setBusyId(null);
    if (res.ok) load();
  };

  if (loading) return <div className="loading">Đang tải…</div>;

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>
          Chờ duyệt {pending.length > 0 && <span className="pill warn" style={{ marginLeft: 6 }}>{pending.length}</span>}
        </h3>
        <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          Hoạt động gửi tay cần duyệt trước khi quy đổi ra tiền. Từ chối vẫn giữ lại hoạt động (không cộng quỹ).
        </p>

        {pending.length === 0 ? (
          <div className="act-empty" style={{ display: "block" }}>🎉 Không có hoạt động nào chờ duyệt.</div>
        ) : (
          <div className="appr-list">
            {pending.map((p) => (
              <div className="appr-item" key={p.id}>
                {p.proofUrl ? (
                  <button className="appr-proof" onClick={() => setZoom(p.proofUrl)} title="Phóng to bằng chứng">
                    <img src={p.proofUrl} alt="Bằng chứng" />
                  </button>
                ) : (
                  <div className="appr-proof empty">Không có<br />ảnh</div>
                )}
                <div className="appr-body">
                  <div className="appr-title">
                    <span className="appr-ico">{p.icon}</span>
                    <b>{p.name}</b>
                    <span className="appr-kind">{p.kindName}</span>
                  </div>
                  <div className="appr-who">{p.who.name} · {p.who.team}</div>
                  <div className="appr-stats tnum">
                    {p.durationMin > 0 && <span>⏱ {p.durationMin} phút</span>}
                    {p.distanceKm > 0 && <span>📏 {p.distanceKm} km</span>}
                    <span>📅 {when(p.occurredAt)}</span>
                  </div>
                  {p.note && <div className="appr-note">“{p.note}”</div>}
                  <div className="appr-est">Duyệt sẽ cộng quỹ: <b className="tnum">+{vnd(p.estimateVnd)}đ</b> <small>({p.mode === "km" ? `${vnd(p.rateVnd)}đ/km` : `${vnd(p.rateVnd)}đ/buổi`})</small></div>
                </div>
                <div className="appr-actions">
                  <button className="appr-ok" disabled={busyId === p.id} onClick={() => act(p.id, "approve")}>✓ Duyệt</button>
                  <button className="appr-no" disabled={busyId === p.id} onClick={() => act(p.id, "reject")}>✕ Từ chối</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Đã xử lý gần đây</h3>
          <div className="appr-recent">
            {recent.map((r) => (
              <div className="appr-rec-row" key={r.id}>
                <span className={`status ${r.rejected ? "s-pend" : "s-appr"}`}>{r.rejected ? "Từ chối" : "Đã duyệt"}</span>
                <span className="arr-name">{r.name}</span>
                <span className="arr-who">{r.who}</span>
                <span className="arr-amt tnum">{r.rejected ? "—" : `+${vnd(r.amountVnd)}đ`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {zoom && (
        <div className="modal-overlay" onClick={() => setZoom(null)}>
          <img className="proof-zoom" src={zoom} alt="Bằng chứng" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
