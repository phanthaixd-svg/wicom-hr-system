"use client";

import { useEffect, useState } from "react";

interface Goal {
  id: string;
  sport: string;
  metric: string;
  target: number;
  period: string;
  label: string | null;
  active: boolean;
  remindEveryDays: number | null;
  remindHour: number;
  current: number;
  pct: number;
}
interface Kind { key: string; nameVi: string; icon: string }

const SPORT_OPTS = [
  { key: "all", vi: "Tất cả bộ môn", icon: "✨" },
  { key: "Run", vi: "Chạy", icon: "🏃" },
  { key: "Ride", vi: "Đạp", icon: "🚴" },
  { key: "Walk", vi: "Đi bộ", icon: "🚶" },
  { key: "Swim", vi: "Bơi", icon: "🏊" },
  { key: "Hike", vi: "Leo núi", icon: "🥾" },
  { key: "Yoga", vi: "Yoga", icon: "🧘" },
];
const METRIC_OPTS = [
  { key: "km", label: "Quãng đường (km)", short: "km" },
  { key: "sessions", label: "Số buổi tập", short: "buổi" },
  { key: "minutes", label: "Thời gian (phút)", short: "phút" },
  { key: "vnd", label: "Quỹ đóng góp (₫)", short: "₫" },
];
const PERIOD_OPTS = [
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "quarter", label: "Quý này" },
];

const shortMetric = (m: string) => METRIC_OPTS.find((x) => x.key === m)?.short ?? "";
const fmtNum = (m: string, v: number) =>
  m === "vnd" ? `${Math.round(v).toLocaleString("vi-VN")}₫` : `${Math.round(v * 10) / 10}`.replace(/\.0$/, "");

const emptyForm = { sport: "all", metric: "km", target: "", period: "week", label: "", remind: false, remindEveryDays: 3, remindHour: 8 };

export default function Goals() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/me/goals", { cache: "no-store" });
    if (res.ok) setGoals((await res.json()).goals);
  };
  useEffect(() => {
    load();
    fetch("/api/kinds", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { kinds: [] }))
      .then((j) => setKinds(j.kinds ?? []));
  }, []);

  const sportOpts = [...SPORT_OPTS, ...kinds.map((k) => ({ key: k.key, vi: k.nameVi, icon: k.icon }))];
  const sportMeta = (key: string) => sportOpts.find((s) => s.key === key) ?? { vi: key, icon: "✨", key };

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setAdding(true);
  };
  const openEdit = (g: Goal) => {
    setForm({
      sport: g.sport, metric: g.metric, target: String(g.target), period: g.period,
      label: g.label ?? "", remind: g.remindEveryDays != null, remindEveryDays: g.remindEveryDays ?? 3, remindHour: g.remindHour,
    });
    setEditId(g.id);
    setAdding(true);
  };

  const submit = async () => {
    const target = Number(form.target);
    if (!target || target <= 0) return;
    setBusy(true);
    const payload = {
      id: editId ?? undefined,
      sport: form.sport,
      metric: form.metric,
      target,
      period: form.period,
      label: form.label.trim() || null,
      remindEveryDays: form.remind ? Number(form.remindEveryDays) : null,
      remindHour: Number(form.remindHour),
    };
    const res = await fetch("/api/me/goals", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setGoals((await res.json()).goals);
      setAdding(false);
      setEditId(null);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Xoá mục tiêu này?")) return;
    const res = await fetch(`/api/me/goals?id=${id}`, { method: "DELETE" });
    if (res.ok) setGoals((await res.json()).goals);
  };

  return (
    <div className="card goals-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h3>🎯 Mục tiêu của tôi</h3>
          <p className="sub">Tự đặt mục tiêu theo bộ môn — có thể bật nhắc qua Lark</p>
        </div>
        {!adding && (
          <button className="goal-add-btn" onClick={openAdd}>+ Thêm mục tiêu</button>
        )}
      </div>

      {adding && (
        <div className="goal-form">
          <div className="gf-row">
            <label className="fld">
              <span>Bộ môn</span>
              <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
                {sportOpts.map((s) => (
                  <option key={s.key} value={s.key}>{s.icon} {s.vi}</option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Chỉ tiêu</span>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
                {METRIC_OPTS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="gf-row">
            <label className="fld">
              <span>Mục tiêu ({shortMetric(form.metric)})</span>
              <input type="number" min={0} step="any" placeholder="vd. 20" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </label>
            <label className="fld">
              <span>Trong</span>
              <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                {PERIOD_OPTS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="fld">
            <span>Tên gợi nhớ (tuỳ chọn)</span>
            <input placeholder="vd. Chạy đều mỗi tuần" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>

          <label className="goal-remind-toggle">
            <input type="checkbox" checked={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.checked })} />
            <span>🔔 Nhắc tôi qua Lark</span>
          </label>
          {form.remind && (
            <div className="gf-row gf-remind">
              <label className="fld">
                <span>Mỗi (ngày)</span>
                <input type="number" min={1} max={90} value={form.remindEveryDays} onChange={(e) => setForm({ ...form, remindEveryDays: Number(e.target.value) })} />
              </label>
              <label className="fld">
                <span>Vào lúc (giờ)</span>
                <input type="number" min={0} max={23} value={form.remindHour} onChange={(e) => setForm({ ...form, remindHour: Number(e.target.value) })} />
              </label>
            </div>
          )}

          <div className="goal-form-actions">
            <button className="btn-cancel" onClick={() => { setAdding(false); setEditId(null); }}>Huỷ</button>
            <button className="btn-save-goal" onClick={submit} disabled={busy || !Number(form.target)}>
              {busy ? "Đang lưu…" : editId ? "Lưu thay đổi" : "Tạo mục tiêu"}
            </button>
          </div>
        </div>
      )}

      <div className="goals-list">
        {goals === null ? (
          <div className="act-empty" style={{ display: "block" }}>Đang tải…</div>
        ) : goals.length === 0 && !adding ? (
          <div className="act-empty" style={{ display: "block" }}>
            Chưa có mục tiêu nào. Đặt mục tiêu đầu tiên để giữ động lực nhé! 🎯
          </div>
        ) : (
          goals.map((g) => {
            const sm = sportMeta(g.sport);
            const done = g.pct >= 100;
            const periodLabel = PERIOD_OPTS.find((p) => p.key === g.period)?.label ?? g.period;
            return (
              <div className={`goal-item${done ? " done" : ""}`} key={g.id}>
                <div className="goal-top">
                  <span className="goal-ico">{sm.icon}</span>
                  <div className="goal-meta">
                    <div className="goal-name">
                      {g.label || `${METRIC_OPTS.find((m) => m.key === g.metric)?.label ?? g.metric} · ${sm.vi}`}
                      {g.remindEveryDays != null && <span className="goal-bell" title={`Nhắc mỗi ${g.remindEveryDays} ngày lúc ${g.remindHour}h`}>🔔</span>}
                    </div>
                    <div className="goal-sub">{sm.vi} · {periodLabel}</div>
                  </div>
                  <div className="goal-actions">
                    <button title="Sửa" onClick={() => openEdit(g)}>✎</button>
                    <button title="Xoá" onClick={() => del(g.id)}>✕</button>
                  </div>
                </div>
                <div className="goal-bar">
                  <i style={{ width: `${g.pct}%` }} className={done ? "full" : ""} />
                </div>
                <div className="goal-nums tnum">
                  <b>{fmtNum(g.metric, g.current)}</b>
                  <span> / {fmtNum(g.metric, g.target)} {g.metric !== "vnd" ? shortMetric(g.metric) : ""}</span>
                  <span className={`goal-pct${done ? " done" : ""}`}>{done ? "🎉 Hoàn thành" : `${g.pct}%`}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
