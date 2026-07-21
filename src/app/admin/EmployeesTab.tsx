"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "../Avatar";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface Emp {
  id: string; name: string; email: string | null; avatarUrl: string | null;
  title: string; team: string; wiRole: string; isAdmin: boolean; isHR: boolean; khoaiBalance: number;
  birthday: string | null; joinedAt: string | null; leftAt: string | null; athleticTitles: string[];
}
interface TitleDef { key: string; name: string; icon: string }

export default function EmployeesTab({ canGrantRoles }: { canGrantRoles: boolean }) {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [titles, setTitles] = useState<TitleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Emp | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/employees", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      setEmps(j.employees);
      setTitles(j.titles);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return emps.filter((e) => !s || e.name.toLowerCase().includes(s) || e.team.toLowerCase().includes(s) || e.title.toLowerCase().includes(s));
  }, [emps, q]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    setMsg("");
    const patch: Record<string, unknown> = {
      name: edit.name, title: edit.title, team: edit.team, wiRole: edit.wiRole,
      khoaiBalance: edit.khoaiBalance, birthday: edit.birthday, joinedAt: edit.joinedAt, leftAt: edit.leftAt,
      athleticTitles: edit.athleticTitles,
    };
    // Chỉ gửi trường cấp quyền khi người sửa là Admin (server cũng chặn lại).
    if (canGrantRoles) { patch.isAdmin = edit.isAdmin; patch.isHR = edit.isHR; }
    const res = await fetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: edit.id, patch }),
    });
    setSaving(false);
    if (res.ok) { setMsg(`✅ Đã lưu hồ sơ ${edit.name}.`); setEdit(null); load(); }
    else setMsg("❌ Lưu thất bại.");
  };

  const setF = <K extends keyof Emp>(f: K, v: Emp[K]) => setEdit((e) => (e ? { ...e, [f]: v } : e));
  const toggleTitle = (key: string) =>
    setEdit((e) => (e ? { ...e, athleticTitles: e.athleticTitles.includes(key) ? e.athleticTitles.filter((k) => k !== key) : [...e.athleticTitles, key] } : e));

  if (loading) return <div className="loading">Đang tải…</div>;

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Bảng nhân viên (nguồn dữ liệu gốc)</h3>
        <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Định nghĩa <b>chức vụ</b>, <b>ngày vào</b> / <b>ngày ra công ty</b>, phân quyền, ngày sinh & danh hiệu cho từng nhân sự.
          Đây là nguồn cho Wicer Home (kỷ niệm, sinh nhật, Level, danh hiệu).
        </p>
        <input className="kind-name-in" style={{ maxWidth: 280, marginBottom: 12 }} placeholder="🔍 Tìm tên / phòng ban / chức vụ…" value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="tbl-wrap" style={{ border: "none", boxShadow: "none" }}>
          <table className="admin-tbl">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Chức vụ</th>
                <th>Phòng ban</th>
                <th style={{ textAlign: "center" }}>Cấp</th>
                <th style={{ textAlign: "center" }}>Ngày vào</th>
                <th style={{ textAlign: "center" }}>Ngày ra</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} style={e.leftAt ? { opacity: 0.55 } : undefined}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar name={e.name} url={e.avatarUrl} size={30} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{e.name}{e.isAdmin && <span className="pill" style={{ marginLeft: 6 }}>Admin</span>}{e.isHR && !e.isAdmin && <span className="pill" style={{ marginLeft: 6, background: "color-mix(in srgb,var(--blue) 16%,transparent)", color: "var(--navy)" }}>HR</span>}</div>
                        <small style={{ color: "var(--ink-3)" }}>{e.email ?? ""}</small>
                      </div>
                    </div>
                  </td>
                  <td>{e.title || <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
                  <td>{e.team || <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
                  <td style={{ textAlign: "center" }}>{e.wiRole === "leader" ? "Leader" : "Staff"}</td>
                  <td style={{ textAlign: "center" }} className="tnum">{e.joinedAt ?? "—"}</td>
                  <td style={{ textAlign: "center" }} className="tnum">{e.leftAt ?? <span style={{ color: "var(--good)" }}>đang làm</span>}</td>
                  <td style={{ textAlign: "center" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEdit({ ...e })}>Sửa</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="act-empty" style={{ display: "table-cell", textAlign: "center" }}>Không tìm thấy nhân sự.</td></tr>}
            </tbody>
          </table>
        </div>
        {msg && <div className="save-msg" style={{ marginTop: 12 }}>{msg}</div>}
      </div>

      {edit && (
        <Modal onClose={() => setEdit(null)} panelClassName="emp-edit">
            <h3 style={{ margin: "0 0 14px" }}>Hồ sơ nhân sự</h3>

            <div className="emp-form">
              <label className="fld"><span>Họ tên</span><input value={edit.name} onChange={(e) => setF("name", e.target.value)} /></label>
              <div className="gf-row">
                <label className="fld"><span>Chức vụ</span><input placeholder="vd. Trưởng phòng Marketing" value={edit.title} onChange={(e) => setF("title", e.target.value)} /></label>
                <label className="fld"><span>Phòng ban</span><input placeholder="vd. Marketing" value={edit.team} onChange={(e) => setF("team", e.target.value)} /></label>
              </div>
              <div className="gf-row">
                <label className="fld"><span>Cấp (WiThanks)</span>
                  <select value={edit.wiRole} onChange={(e) => setF("wiRole", e.target.value)}>
                    <option value="staff">Staff</option>
                    <option value="leader">Leader</option>
                  </select>
                </label>
                <label className="fld"><span>Số dư khoai 🥔</span><input type="number" min={0} value={edit.khoaiBalance} onChange={(e) => setF("khoaiBalance", Math.max(0, Number(e.target.value) || 0))} /></label>
              </div>
              <div className="gf-row">
                <label className="fld"><span>Ngày sinh</span><input type="date" value={edit.birthday ?? ""} onChange={(e) => setF("birthday", e.target.value || null)} /></label>
                <label className="fld"><span>Ngày vào công ty</span><input type="date" value={edit.joinedAt ?? ""} onChange={(e) => setF("joinedAt", e.target.value || null)} /></label>
              </div>
              <div className="gf-row">
                <label className="fld"><span>Ngày ra công ty <small>(trống = đang làm)</small></span><input type="date" value={edit.leftAt ?? ""} onChange={(e) => setF("leftAt", e.target.value || null)} /></label>
              </div>
              {canGrantRoles ? (
                <div className="fld">
                  <span>Phân quyền HR Setting</span>
                  <div className="emp-roles">
                    <label className="goal-remind-toggle">
                      <input type="checkbox" checked={edit.isHR} onChange={(e) => setF("isHR", e.target.checked)} />
                      <span>👔 Quyền <b>HR</b> — thấy & cấu hình HR Setting</span>
                    </label>
                    <label className="goal-remind-toggle">
                      <input type="checkbox" checked={edit.isAdmin} onChange={(e) => setF("isAdmin", e.target.checked)} />
                      <span>🛡️ Quyền <b>Admin</b> — toàn quyền + cấp quyền cho người khác</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="fld"><span>Phân quyền</span><div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Chỉ Admin mới cấp được quyền Admin/HR.{(edit.isAdmin || edit.isHR) && ` Hiện tại: ${edit.isAdmin ? "Admin" : "HR"}.`}</div></div>
              )}
              <div className="fld">
                <span>Danh hiệu thể lực (verify thủ công)</span>
                <div className="emp-titles">
                  {titles.map((t) => (
                    <button key={t.key} type="button" className={`emp-title-chip${edit.athleticTitles.includes(t.key) ? " on" : ""}`} onClick={() => toggleTitle(t.key)}>
                      {t.icon} {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="goal-form-actions">
                <Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button>
                <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Đang lưu…" : "💾 Lưu hồ sơ"}</Button>
              </div>
            </div>
        </Modal>
      )}
    </>
  );
}
