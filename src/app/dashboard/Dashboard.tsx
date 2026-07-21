"use client";

import { useCallback, useEffect, useState } from "react";
import Leaderboard from "./Leaderboard";
import ProfileModal from "./ProfileModal";
import MoveFeed from "./MoveFeed";
import Avatar from "../Avatar";

interface SportAgg { km: number; count: number; vnd: number; }
interface EmpAgg {
  id: string; name: string; team: string | null; avatarUrl: string | null; isMe: boolean;
  totalVnd: number; totalKm: number; activities: number; bySport: Record<string, SportAgg>;
}
interface DashData {
  meId: string; goalVnd: number;
  today: { vnd: number; people: number; totalPeople: number };
  dailyFund: { label: string; vnd: number }[];
  kpi: { swimKm: number; rideKm: number; runKm: number; cauLong: number; other: number };
  me: { id: string; name: string; avatarUrl: string | null };
  runningCampaign: { name: string; description: string; goalVnd: number; fundVnd: number } | null;
  campaignEnd: string;
  totals: { vnd: number; km: number; activities: number; participants: number };
  sportTotals: Record<string, SportAgg>;
  sports: { key: string; vi: string; icon: string; color: string }[];
  byEmployee: EmpAgg[];
  prevByEmployee: { id: string; team: string | null; totalVnd: number; totalKm: number; activities: number; bySport: Record<string, SportAgg> }[];
}

const SPORT_HEX: Record<string, string> = {
  Run: "#FFC45F", Ride: "#0070FA", Walk: "#F0A9F9", Swim: "#33A3DC", Hike: "#B0C1D1", Yoga: "#9B7EDE", Other: "#6d8494",
};
const trFmt = (v: number) => `${(v / 1e6).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tr`;
const legendMoney = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr` : `${Math.round(v / 1e3)}k`);
const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Dashboard() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return isoDate(d); });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [preset, setPreset] = useState(30);
  const [view, setView] = useState<"feed" | "both">("feed");
  const [onlyMe, setOnlyMe] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [data, setData] = useState<DashData | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard?from=${from}&to=${to}${onlyMe ? "&me=1" : ""}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [from, to, onlyMe]);
  useEffect(() => { load(); }, [load]);

  const applyPreset = (days: number) => {
    setPreset(days);
    const t = new Date(), f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFrom(isoDate(f)); setTo(isoDate(t));
  };
  const applyAllTime = () => { setPreset(-1); setFrom("2009-01-01"); setTo(isoDate(new Date())); };

  // ── Nhiệt kế (campaign-wide, không theo filter) ──
  const running = data?.runningCampaign ?? null;
  const goal = running?.goalVnd ?? 0;
  const fund = running?.fundVnd ?? data?.totals.vnd ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((fund / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - fund);
  const daysLeft = data?.campaignEnd ? Math.max(0, Math.ceil((new Date(data.campaignEnd).getTime() - Date.now()) / 86400000)) : null;

  // ── Donut quỹ theo môn (theo filter) ──
  const st = data?.sportTotals;
  const sportFund = (data?.sports ?? []).map((s) => ({ ...s, vnd: st?.[s.key]?.vnd ?? 0 })).filter((s) => s.vnd > 0).sort((a, b) => b.vnd - a.vnd);
  const totalFund = sportFund.reduce((n, s) => n + s.vnd, 0);
  // Tối đa 9 ô: 8 môn chi tiết + 1 ô "Khác" gộp phần còn lại (donut & chú thích dùng chung danh sách này).
  const donutSports = sportFund.length <= 9
    ? sportFund
    : [...sportFund.slice(0, 8), { key: "__khac", vi: "Khác", icon: "✨", color: "#6d8494", vnd: sportFund.slice(8).reduce((n, s) => n + s.vnd, 0) }];
  const kpi = data?.kpi;

  const prevTotal = (data?.prevByEmployee ?? []).reduce((n, e) => n + e.totalVnd, 0);
  const curTotal = data?.totals.vnd ?? 0;
  const trendPct = prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : curTotal > 0 ? 100 : 0;

  return (
    <div className="shell dash-shell m4-shell">
      {/* ── Nhiệt kế "Cùng về đích" (cỡ Vừa 80%) ── */}
      <div className="m4t">
        <div className="m4t-in">
          <div className="m4t-top">
            <span className="m4t-title">🌡️ Cùng về đích — {running?.name ?? "Quỹ Wishare"}</span>
            {daysLeft != null && <span className="m4t-chip">Còn {daysLeft} ngày</span>}
          </div>
          {goal > 0 ? (
            <>
              <div className="m4t-mid"><div><span className="m4t-cur tnum">{trFmt(fund)}</span><span className="m4t-of">/ {trFmt(goal)}</span></div><div className="m4t-pct tnum">{pct}%</div></div>
              <div className="m4t-barwrap"><div className="m4t-bar"><span style={{ width: `${pct}%` }} /></div><div className="m4t-ticks"><i style={{ left: "25%" }} /><i style={{ left: "50%" }} /><i style={{ left: "75%" }} /></div></div>
              <div className="m4t-bot">
                <span className="m4t-left">Còn <b>{trFmt(remaining)}</b> là cả công ty cán mốc 🏁</span>
                <span className="m4t-today">Hôm nay +{vnd(data?.today.vnd ?? 0)}đ · {data?.today.people ?? 0} người 🔥</span>
              </div>
            </>
          ) : (
            <div className="m4t-mid"><div><span className="m4t-cur tnum">{vnd(fund)}đ</span><span className="m4t-of">tổng quỹ</span></div><span className="m4t-today">Hôm nay +{vnd(data?.today.vnd ?? 0)}đ 🔥</span></div>
          )}
        </div>
      </div>

      {/* ── Sub-tabs (gộp) ── */}
      <div className="m4-subtabs">
        <button className={view === "feed" ? "on" : ""} onClick={() => setView("feed")}>📸 Bảng tin</button>
        <button className={view === "both" ? "on" : ""} onClick={() => setView("both")}>📊 Thống kê &amp; Xếp hạng</button>
      </div>

      {view === "feed" ? (
        <MoveFeed onOpenProfile={setProfileId} />
      ) : (
        <div className="m4-both">
          {/* Thống kê */}
          <div className="card">
            <div className="m4a-head">
              <h3 className="m4-h3">📊 Thống kê quỹ &amp; hoạt động {onlyMe && <span className="m4a-metag">👤 Chỉ tôi</span>}</h3>
              <div className="m4a-filter">
                {[7, 30].map((d) => <button key={d} className={`m4a-chip${preset === d ? " on" : ""}`} onClick={() => applyPreset(d)}>{d} ngày</button>)}
                <button className={`m4a-chip${preset === -1 ? " on" : ""}`} onClick={applyAllTime}>Tất cả</button>
                <span className="m4a-date">
                  <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset(0); }} /> –
                  <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset(0); }} />
                </span>
                <button className={`m4a-mebtn${onlyMe ? " on" : ""}`} onClick={() => setOnlyMe((v) => !v)} aria-label="Chỉ tôi" data-tip={onlyMe ? "Bỏ lọc — xem cả công ty" : "Chỉ tôi"}>
                  <Avatar name={data?.me?.name ?? "Tôi"} url={data?.me?.avatarUrl ?? null} size={26} />
                </button>
              </div>
            </div>
            {totalFund > 0 ? (
              <div className="m4a-cols">
                {/* Trái (2/5): donut + chú thích môn (màu·icon·tên trên, tiền dưới) */}
                <div className="m4a-left">
                  <div className="m4a-donut">
                    <svg viewBox="0 0 120 120" role="img" aria-label="Cơ cấu quỹ theo môn">
                      <defs>
                        <filter id="donutSh" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#0A2338" floodOpacity="0.16" />
                        </filter>
                      </defs>
                      <circle cx="60" cy="60" r="49" fill="none" stroke="var(--surface-2)" strokeWidth="15" />
                      <g filter="url(#donutSh)">
                        {(() => {
                          const C = 2 * Math.PI * 49, GAP = 3; let off = 0;
                          return donutSports.map((s) => {
                            const seg = (C * s.vnd) / totalFund; const dash = Math.max(seg - GAP, 0.1);
                            const el = <circle key={s.key} cx="60" cy="60" r="49" fill="none" stroke={SPORT_HEX[s.key] ?? s.color ?? "#B0C1D1"} strokeWidth="15" strokeLinecap="round" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />;
                            off += seg; return el;
                          });
                        })()}
                      </g>
                    </svg>
                    <div className="m4a-donut-c"><b className="tnum">{trFmt(totalFund)}</b><span>tổng quỹ</span></div>
                  </div>
                  <ul className="m4a-leg">
                    {donutSports.map((s) => (
                      <li key={s.key}>
                        <span className="dot" style={{ background: SPORT_HEX[s.key] ?? s.color ?? "#B0C1D1" }} />
                        <div className="lg-tx">
                          <span className="lg-nm">{s.icon} {s.vi}</span>
                          <small className="lg-v tnum">{legendMoney(s.vnd)}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Phải (3/5): biểu đồ tiền theo thời gian + 4 ô km/buổi */}
                <div className="m4a-right">
                  <div className="m4a-top">
                    <div><div className="muted">Nhịp quỹ kỳ này</div><div className="m4a-total-v tnum">+{vnd(curTotal)}đ</div></div>
                    {trendPct !== 0 && <span className={`m4a-trend${trendPct < 0 ? " down" : ""}`}>{trendPct >= 0 ? "▲" : "▼"} {Math.abs(trendPct)}% vs kỳ trước</span>}
                  </div>
                  <FundChart data={data?.dailyFund ?? []} />
                  <div className="m4a-kpis">
                    <div className="m4a-kpi"><b className="tnum">{(kpi?.swimKm ?? 0).toFixed(1)}</b><small>🏊 Bơi km</small></div>
                    <div className="m4a-kpi"><b className="tnum">{(kpi?.rideKm ?? 0).toFixed(1)}</b><small>🚴 Đạp km</small></div>
                    <div className="m4a-kpi"><b className="tnum">{(kpi?.runKm ?? 0).toFixed(1)}</b><small>🏃 Chạy km</small></div>
                    <div className="m4a-kpi"><b className="tnum">{kpi?.cauLong ?? 0}</b><small>🏸 Buổi Cầu lông</small></div>
                    <div className="m4a-kpi"><b className="tnum">{kpi?.other ?? 0}</b><small>✨ Buổi Khác</small></div>
                  </div>
                </div>
              </div>
            ) : <div className="act-empty" style={{ display: "block" }}>Chưa có quỹ trong khoảng ngày này.</div>}
          </div>

          {/* Xếp hạng (ăn theo cùng filter) */}
          <Leaderboard employees={data?.byEmployee ?? []} prev={data?.prevByEmployee ?? []} sports={data?.sports ?? []} onOpenProfile={setProfileId} />
        </div>
      )}

      {profileId && <ProfileModal id={profileId} onClose={() => setProfileId(null)} />}
    </div>
  );
}

// Biểu đồ quỹ theo thời gian (đường mượt Catmull-Rom + vùng tô).
function FundChart({ data }: { data: { label: string; vnd: number }[] }) {
  if (!data || data.length < 2) return <div className="m4a-chart-empty">Chưa đủ dữ liệu để vẽ biểu đồ.</div>;
  const W = 640, H = 118, padX = 8, padY = 16;
  const max = Math.max(...data.map((d) => d.vnd), 1);
  const pts = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (W - 2 * padX),
    y: H - padY - (d.vnd / max) * (H - 2 * padY),
  }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  const area = `${line} L ${last.x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
  const step = Math.ceil(data.length / 6);
  return (
    <div className="m4a-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="m4a-chart-svg" aria-label="Biểu đồ quỹ theo thời gian">
        <defs><linearGradient id="fundg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#18E4A2" stopOpacity="0.24" /><stop offset="1" stopColor="#18E4A2" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#fundg)" />
        <path d={line} fill="none" stroke="#18E4A2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={last.x} cy={last.y} r="4" fill="var(--surface)" stroke="#18E4A2" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="m4a-xlabels">
        {data.map((d, i) => <span key={i}>{i % step === 0 || i === data.length - 1 ? d.label : ""}</span>)}
      </div>
    </div>
  );
}
