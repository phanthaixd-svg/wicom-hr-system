"use client";

import { useEffect, useState } from "react";
import { SPORTS, SPORT_ORDER, SportKey } from "@/lib/sports";

interface Rule {
  activityType: string;
  mode: string;
  rateVnd: number;
  capPerDayVnd: number | null;
  active: boolean;
}

export default function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/rules", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        const map: Record<string, Rule> = {};
        for (const r of j.rules as Rule[]) map[r.activityType] = r;
        setRules(
          SPORT_ORDER.map(
            (k) =>
              map[k] ?? {
                activityType: k,
                mode: SPORTS[k].defaultMode,
                rateVnd: SPORTS[k].defaultRateVnd,
                capPerDayVnd: null,
                active: k !== "Other",
              },
          ),
        );
      }
      setLoading(false);
    })();
  }, []);

  const patch = (i: number, field: keyof Rule, value: string | number | boolean | null) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
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
    <>
      <div className="card" style={{ padding: 6 }}>
        <div className="tbl-wrap" style={{ border: "none", boxShadow: "none" }}>
          <table className="admin-tbl">
            <thead>
              <tr>
                <th>Hoạt động</th>
                <th>Cách tính</th>
                <th style={{ textAlign: "right" }}>Tỷ lệ (₫)</th>
                <th style={{ textAlign: "right" }}>Trần/ngày (₫)</th>
                <th style={{ textAlign: "center" }}>Bật</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => {
                const meta = SPORTS[r.activityType as SportKey] ?? SPORTS.Other;
                return (
                  <tr key={r.activityType}>
                    <td>
                      <span className="act-name">
                        <span className="badge">{meta.icon}</span>
                        {meta.vi}
                      </span>
                    </td>
                    <td>
                      <select value={r.mode} onChange={(e) => patch(i, "mode", e.target.value)}>
                        <option value="km">theo km</option>
                        <option value="activity">theo buổi</option>
                      </select>
                    </td>
                    <td>
                      <input className="rate" type="number" min={0} value={r.rateVnd} onChange={(e) => patch(i, "rateVnd", Number(e.target.value))} />
                      <div className="unit">{r.mode === "km" ? "₫ / km" : "₫ / buổi"}</div>
                    </td>
                    <td>
                      <input
                        className="rate"
                        type="number"
                        min={0}
                        placeholder="không trần"
                        value={r.capPerDayVnd ?? ""}
                        onChange={(e) => patch(i, "capPerDayVnd", e.target.value ? Number(e.target.value) : null)}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={r.active} onChange={(e) => patch(i, "active", e.target.checked)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="save-bar">
        {msg && <span className="save-msg">{msg}</span>}
        <span className="grow" />
        <button className="btn-save" onClick={save} disabled={saving}>
          {saving ? "Đang lưu…" : "💾 Lưu & tính lại quỹ"}
        </button>
      </div>
    </>
  );
}
