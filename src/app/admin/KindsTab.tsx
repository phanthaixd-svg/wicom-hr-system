"use client";

import { useEffect, useState } from "react";

interface Kind {
  id?: string;
  key?: string;
  nameVi: string;
  icon: string;
  mode: string;
  rateVnd: number;
  capPerDayVnd: number | null;
  requireProof: boolean;
  active: boolean;
  sortOrder: number;
}

const ICON_SUGGEST = ["🏸", "🏓", "⚽", "🏀", "🏐", "🎾", "🥊", "🧗", "🤸", "⛹️", "🏋️", "🚣", "🛹", "⛳", "🎯", "🕺"];
const blankKind = (order: number): Kind => ({
  nameVi: "", icon: "🏸", mode: "session", rateVnd: 20000, capPerDayVnd: null, requireProof: true, active: true, sortOrder: order,
});

export default function KindsTab() {
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/kinds", { cache: "no-store" });
    if (res.ok) setKinds((await res.json()).kinds);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const patch = (i: number, field: keyof Kind, value: string | number | boolean | null) =>
    setKinds((ks) => ks.map((k, idx) => (idx === i ? { ...k, [field]: value } : k)));

  const addRow = () => setKinds((ks) => [...ks, blankKind(ks.length)]);

  const removeRow = async (i: number) => {
    const k = kinds[i];
    if (!k.id) {
      setKinds((ks) => ks.filter((_, idx) => idx !== i)); // dòng mới chưa lưu -> bỏ luôn
      return;
    }
    if (!confirm(`Xoá môn "${k.nameVi}"? Nếu đã có hoạt động dùng môn này, hệ thống sẽ tắt thay vì xoá.`)) return;
    const res = await fetch(`/api/admin/kinds?id=${k.id}`, { method: "DELETE" });
    if (res.ok) {
      const j = await res.json();
      setMsg(j.disabled ? `⚠️ "${k.nameVi}" đang được dùng (${j.used} hoạt động) → đã tắt.` : `🗑️ Đã xoá "${k.nameVi}".`);
      load();
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/kinds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kinds }),
    });
    setSaving(false);
    if (res.ok) {
      setKinds((await res.json()).kinds);
      setMsg("✅ Đã lưu danh mục hoạt động.");
    } else setMsg("❌ Lưu thất bại.");
  };

  if (loading) return <div className="loading">Đang tải…</div>;

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Hoạt động tự thêm</h3>
        <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Các môn Strava không có (cầu lông, bóng bàn, gym tại chỗ…). Nhân sự sẽ chọn các môn này khi{" "}
          <b>gửi hoạt động tay</b> kèm bằng chứng; Admin duyệt xong mới quy đổi ra tiền theo tỷ lệ bên dưới.
        </p>

        {kinds.length === 0 ? (
          <div className="act-empty" style={{ display: "block" }}>Chưa có môn nào. Bấm “+ Thêm môn” để tạo.</div>
        ) : (
          <div className="tbl-wrap" style={{ border: "none", boxShadow: "none" }}>
            <table className="admin-tbl kinds-tbl">
              <thead>
                <tr>
                  <th style={{ width: 54 }}>Icon</th>
                  <th>Tên hoạt động</th>
                  <th>Cách tính</th>
                  <th style={{ textAlign: "right" }}>Tỷ lệ (₫)</th>
                  <th style={{ textAlign: "right" }}>Trần/ngày (₫)</th>
                  <th style={{ textAlign: "center" }}>Cần bằng chứng</th>
                  <th style={{ textAlign: "center" }}>Bật</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {kinds.map((k, i) => (
                  <tr key={k.id ?? `new-${i}`}>
                    <td>
                      <input
                        className="icon-in"
                        value={k.icon}
                        maxLength={4}
                        onChange={(e) => patch(i, "icon", e.target.value)}
                        list="kind-icons"
                      />
                    </td>
                    <td>
                      <input
                        className="kind-name-in"
                        placeholder="vd. Cầu lông"
                        value={k.nameVi}
                        onChange={(e) => patch(i, "nameVi", e.target.value)}
                      />
                    </td>
                    <td>
                      <select value={k.mode} onChange={(e) => patch(i, "mode", e.target.value)}>
                        <option value="session">theo buổi</option>
                        <option value="km">theo km</option>
                      </select>
                    </td>
                    <td>
                      <input className="rate" type="number" min={0} value={k.rateVnd} onChange={(e) => patch(i, "rateVnd", Number(e.target.value))} />
                      <div className="unit">{k.mode === "km" ? "₫ / km" : "₫ / buổi"}</div>
                    </td>
                    <td>
                      <input
                        className="rate"
                        type="number"
                        min={0}
                        placeholder="không trần"
                        value={k.capPerDayVnd ?? ""}
                        onChange={(e) => patch(i, "capPerDayVnd", e.target.value ? Number(e.target.value) : null)}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={k.requireProof} onChange={(e) => patch(i, "requireProof", e.target.checked)} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={k.active} onChange={(e) => patch(i, "active", e.target.checked)} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button className="row-del" title="Xoá môn" onClick={() => removeRow(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <datalist id="kind-icons">
          {ICON_SUGGEST.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>

        <button className="addrow-btn" onClick={addRow}>+ Thêm môn</button>
      </div>

      <div className="save-bar">
        {msg && <span className="save-msg">{msg}</span>}
        <span className="grow" />
        <button className="btn-save" onClick={save} disabled={saving}>
          {saving ? "Đang lưu…" : "💾 Lưu danh mục"}
        </button>
      </div>
    </>
  );
}
