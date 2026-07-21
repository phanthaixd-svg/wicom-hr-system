"use client";

import { useEffect, useState } from "react";

interface Campaign {
  id: string;
  name: string;
  description: string;
  goalVnd: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
const emptyForm = { id: "", name: "", description: "", goalVnd: 50000000, startDate: "", endDate: "", active: true };

export default function CampaignsTab() {
  const [list, setList] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
    if (res.ok) setList((await res.json()).campaigns);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const set = (f: keyof typeof form, v: string | number | boolean) => setForm((s) => ({ ...s, [f]: v }));
  const resetForm = () => setForm({ ...emptyForm });

  const save = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      setMsg("⚠️ Cần điền Tên, Ngày bắt đầu và Ngày kết thúc.");
      return;
    }
    setSaving(true);
    setMsg("");
    const editing = Boolean(form.id);
    const res = await fetch("/api/admin/campaigns", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setMsg(editing ? "✅ Đã cập nhật chiến dịch." : "✅ Đã tạo chiến dịch.");
      resetForm();
      load();
    } else {
      setMsg("❌ Lưu thất bại.");
    }
  };

  const setActive = async (c: Campaign) => {
    await fetch("/api/admin/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: true }),
    });
    load();
  };

  const edit = (c: Campaign) => {
    setForm({ ...c });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Xoá chiến dịch "${c.name}"?`)) return;
    await fetch(`/api/admin/campaigns?id=${c.id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      {/* Form tạo/sửa */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>{form.id ? "Sửa chiến dịch" : "Tạo chiến dịch mới"}</h3>
        <div className="admin-grid">
          <label className="fld" style={{ gridColumn: "1 / -1" }}>
            <span>Tên chiến dịch</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Chạy vì cộng đồng Q3/2026" />
          </label>
          <label className="fld" style={{ gridColumn: "1 / -1" }}>
            <span>Mục đích (hiển thị cho thành viên)</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="VD: Gây quỹ xây thư viện cho trẻ em vùng cao. Mỗi km của bạn là một viên gạch."
            />
          </label>
          <label className="fld">
            <span>Số tiền cần gây quỹ (₫)</span>
            <input type="number" min={0} step={1000000} value={form.goalVnd} onChange={(e) => set("goalVnd", Number(e.target.value))} />
            <small>= {vnd(form.goalVnd)} ₫</small>
          </label>
          <label className="fld" style={{ justifyContent: "flex-end" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} style={{ width: 18, height: 18 }} />
              Đặt làm chiến dịch đang chạy
            </span>
            <small>Chỉ một chiến dịch chạy tại một thời điểm.</small>
          </label>
          <label className="fld">
            <span>Ngày bắt đầu</span>
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="fld">
            <span>Ngày kết thúc</span>
            <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </label>
        </div>
        <div className="save-bar" style={{ position: "static", marginTop: 14 }}>
          {msg && <span className="save-msg">{msg}</span>}
          <span className="grow" />
          {form.id && (
            <button className="preset" onClick={resetForm} style={{ marginRight: 8 }}>
              Huỷ
            </button>
          )}
          <button className="btn-save" onClick={save} disabled={saving}>
            {saving ? "Đang lưu…" : form.id ? "💾 Cập nhật" : "➕ Tạo chiến dịch"}
          </button>
        </div>
      </div>

      {/* Danh sách chiến dịch */}
      <h3 style={{ fontSize: 14, margin: "22px 0 10px", color: "var(--ink-2)" }}>Các chiến dịch đã tạo</h3>
      {loading ? (
        <div className="loading">Đang tải…</div>
      ) : list.length === 0 ? (
        <div className="empty">Chưa có chiến dịch nào. Tạo chiến dịch đầu tiên ở trên.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((c) => (
            <div key={c.id} className="camp-card">
              <div className="camp-head">
                <b>{c.name}</b>
                {c.active && <span className="camp-badge">● Đang chạy</span>}
              </div>
              {c.description && <p className="camp-desc">{c.description}</p>}
              <div className="camp-meta">
                <span>🎯 {vnd(c.goalVnd)} ₫</span>
                <span>📅 {c.startDate} → {c.endDate}</span>
              </div>
              <div className="camp-actions">
                {!c.active && (
                  <button className="preset" onClick={() => setActive(c)}>
                    Đặt làm hiện tại
                  </button>
                )}
                <button className="preset" onClick={() => edit(c)}>
                  Sửa
                </button>
                <button className="preset danger" onClick={() => remove(c)}>
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
