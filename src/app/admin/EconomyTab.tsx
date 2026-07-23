"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "../Avatar";

interface Row {
  id: string; name: string; avatarUrl: string | null; team: string; khoaiBalance: number;
  givenKhoai: number; receivedKhoai: number; superGiven: number; superReceived: number;
  specialGiven: number; specialReceived: number; redeemed: number;
  givenCount: number; receivedCount: number; distinctReceivers: number;
  weekRemaining: number | null; monthRemaining: number | null; lastGivenAt: string | null;
}
interface Summary {
  totalCirculating: number; totalGiven: number; totalRedeemed: number; participants: number; headcount: number;
  topGiver: { name: string; val: number } | null; topReceiver: { name: string; val: number } | null;
}
type Data = { period: string; rows: Row[]; summary: Summary };
type SortKey = keyof Pick<Row, "name" | "khoaiBalance" | "givenKhoai" | "receivedKhoai" | "superGiven" | "superReceived" | "specialGiven" | "specialReceived" | "redeemed" | "distinctReceivers">;

const PERIODS: { key: string; label: string }[] = [
  { key: "all", label: "Tất cả" }, { key: "month", label: "Tháng này" }, { key: "week", label: "Tuần này" },
];
const num = (n: number) => n.toLocaleString("vi-VN");
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");
const rem = (v: number | null) => (v == null ? "∞" : String(v));

export default function EconomyTab() {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("khoaiBalance");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/withanks-economy?period=${period}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => { setData(d); setLoading(false); });
  }, [period]);

  const rows = useMemo(() => {
    if (!data) return [];
    const kw = q.trim().toLowerCase();
    const filtered = kw ? data.rows.filter((r) => r.name.toLowerCase().includes(kw) || r.team.toLowerCase().includes(kw)) : data.rows;
    const s = [...filtered].sort((a, b) => {
      const av = a[sort], bv = b[sort];
      const cmp = typeof av === "string" ? String(av).localeCompare(String(bv), "vi") : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return s;
  }, [data, q, sort, dir]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    khoaiBalance: t.khoaiBalance + r.khoaiBalance, givenKhoai: t.givenKhoai + r.givenKhoai, receivedKhoai: t.receivedKhoai + r.receivedKhoai,
    superGiven: t.superGiven + r.superGiven, superReceived: t.superReceived + r.superReceived,
    specialGiven: t.specialGiven + r.specialGiven, specialReceived: t.specialReceived + r.specialReceived, redeemed: t.redeemed + r.redeemed,
  }), { khoaiBalance: 0, givenKhoai: 0, receivedKhoai: 0, superGiven: 0, superReceived: 0, specialGiven: 0, specialReceived: 0, redeemed: 0 }), [rows]);

  const onSort = (k: SortKey) => {
    if (sort === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(k); setDir("desc"); }
  };
  const arrow = (k: SortKey) => (sort === k ? (dir === "asc" ? " ▲" : " ▼") : "");

  const exportCsv = () => {
    const head = ["Nhân viên", "Team", "Ví khoai", "Đã cho", "Nhận", "Lượt cho", "Lượt nhận", "Đã cảm ơn (người)", "Super gửi", "Super nhận", "Special gửi", "Special nhận", "Đã đổi quà", "Hạn mức tuần", "Hạn mức tháng", "Cảm ơn gần nhất"];
    const lines = rows.map((r) => [r.name, r.team, r.khoaiBalance, r.givenKhoai, r.receivedKhoai, r.givenCount, r.receivedCount, r.distinctReceivers, r.superGiven, r.superReceived, r.specialGiven, r.specialReceived, r.redeemed, rem(r.weekRemaining), rem(r.monthRemaining), fmtDate(r.lastGivenAt)]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kinh-te-khoai-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = data?.summary;

  return (
    <div className="econ">
      <header className="page-head">
        <h1 className="page-title">📊 Kinh tế khoai</h1>
        <p className="page-sub">Thống kê khoai theo từng nhân sự — chỉ xem, tự động theo dữ liệu thực tế.</p>
      </header>

      {/* KPI tổng công ty */}
      <div className="econ-kpis">
        <div className="econ-kpi"><span className="ek-lb">Khoai đang lưu hành</span><b className="ek-val num">{num(s?.totalCirculating ?? 0)} 🥔</b></div>
        <div className="econ-kpi"><span className="ek-lb">Khoai đã trao ({period === "all" ? "tất cả" : period === "month" ? "tháng" : "tuần"})</span><b className="ek-val num">{num(s?.totalGiven ?? 0)} 🥔</b></div>
        <div className="econ-kpi"><span className="ek-lb">Đã đổi quà</span><b className="ek-val num">{num(s?.totalRedeemed ?? 0)} 🥔</b></div>
        <div className="econ-kpi"><span className="ek-lb">Người tham gia</span><b className="ek-val num">{s?.participants ?? 0}/{s?.headcount ?? 0}</b></div>
        <div className="econ-kpi"><span className="ek-lb">🏆 Cho đi nhiều nhất</span><b className="ek-val">{s?.topGiver ? `${s.topGiver.name} · ${s.topGiver.val}🥔` : "—"}</b></div>
        <div className="econ-kpi"><span className="ek-lb">💛 Được cảm ơn nhất</span><b className="ek-val">{s?.topReceiver ? `${s.topReceiver.name} · ${s.topReceiver.val}🥔` : "—"}</b></div>
      </div>

      {/* Thanh công cụ */}
      <div className="econ-tools">
        <div className="seg">
          {PERIODS.map((p) => (
            <button key={p.key} className={period === p.key ? "on" : ""} onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>
        <input className="econ-search" placeholder="Tìm tên / phòng ban…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-cancel" onClick={exportCsv} disabled={!rows.length}>⬇️ Xuất CSV</button>
      </div>

      {loading ? (
        <p className="sub" style={{ padding: 16 }}>Đang tải…</p>
      ) : (
        <div className="econ-scroll">
          <table className="econ-table">
            <thead>
              <tr>
                <th className="sticky-col sortable" onClick={() => onSort("name")}>Nhân viên{arrow("name")}</th>
                <th className="sortable" onClick={() => onSort("khoaiBalance")}>Ví khoai{arrow("khoaiBalance")}</th>
                <th className="sortable" onClick={() => onSort("givenKhoai")}>Đã cho{arrow("givenKhoai")}</th>
                <th className="sortable" onClick={() => onSort("receivedKhoai")}>Nhận{arrow("receivedKhoai")}</th>
                <th>Lượt cho / nhận</th>
                <th className="sortable" onClick={() => onSort("distinctReceivers")}>Đã cảm ơn{arrow("distinctReceivers")}</th>
                <th className="sortable" onClick={() => onSort("superGiven")}>Super G/N{arrow("superGiven")}</th>
                <th className="sortable" onClick={() => onSort("specialGiven")}>Special G/N{arrow("specialGiven")}</th>
                <th className="sortable" onClick={() => onSort("redeemed")}>Đã đổi quà{arrow("redeemed")}</th>
                <th>Hạn mức T/Th</th>
                <th>Cảm ơn gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sticky-col">
                    <div className="econ-emp">
                      <Avatar name={r.name} url={r.avatarUrl} size={30} />
                      <div><b>{r.name}</b><small>{r.team}</small></div>
                    </div>
                  </td>
                  <td className="num strong">{num(r.khoaiBalance)}</td>
                  <td className="num">{num(r.givenKhoai)}</td>
                  <td className="num">{num(r.receivedKhoai)}</td>
                  <td className="num muted">{r.givenCount} / {r.receivedCount}</td>
                  <td className="num">{r.distinctReceivers}</td>
                  <td className="num">{r.superGiven} / {r.superReceived}</td>
                  <td className="num">{r.specialGiven} / {r.specialReceived}</td>
                  <td className="num">{num(r.redeemed)}</td>
                  <td className="num muted">{rem(r.weekRemaining)} / {rem(r.monthRemaining)}</td>
                  <td className="muted">{fmtDate(r.lastGivenAt)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={11} className="muted" style={{ textAlign: "center", padding: 20 }}>Không có dữ liệu.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="econ-total">
                  <td className="sticky-col">Tổng ({rows.length} người)</td>
                  <td className="num strong">{num(totals.khoaiBalance)}</td>
                  <td className="num">{num(totals.givenKhoai)}</td>
                  <td className="num">{num(totals.receivedKhoai)}</td>
                  <td />
                  <td />
                  <td className="num">{totals.superGiven} / {totals.superReceived}</td>
                  <td className="num">{totals.specialGiven} / {totals.specialReceived}</td>
                  <td className="num">{num(totals.redeemed)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
