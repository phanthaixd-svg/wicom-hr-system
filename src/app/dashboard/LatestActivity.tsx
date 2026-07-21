"use client";

import { useEffect, useState } from "react";
import Avatar from "../Avatar";
import ActivityModal from "../me/ActivityModal";
import Reactions from "./Reactions";
import type { ReactionGroup } from "@/lib/reactions";

interface FeedItem { id: string; sport: string; kindKey?: string | null; icon: string; kindName?: string | null; name: string; km: number; timeS: number; dateISO: string; amountVnd: number; pending: boolean; who: { id: string; name: string; team: string; avatarUrl: string | null }; reactions: ReactionGroup[]; }
interface Week { fundVnd: number; trendPct: number; daily: number[]; dayLabels: string[]; activities: number; km: number; peopleMoved: number; totalPeople: number; topSport: { vi: string; icon: string } | null; }
interface PulseData { feed: FeedItem[]; week: Week; }

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
const VERB: Record<string, string> = { Run: "Chạy", Ride: "Đạp", Walk: "Đi bộ", Swim: "Bơi", Hike: "Leo núi", Yoga: "Yoga", Other: "Vận động" };
function desc(sport: string, km: number, timeS: number, kindName?: string | null) {
  const v = kindName ?? VERB[sport] ?? "Vận động";
  if (km <= 0) return `${v} ${Math.round(timeS / 60)} phút`;
  if (!kindName && sport === "Yoga") return `${v} ${Math.round(timeS / 60)} phút`;
  return `${v} ${km.toFixed(1).replace(".", ",")} km`;
}
function relTime(iso: string) {
  const d = new Date(iso), now = new Date();
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.round(hrs / 24)} ngày trước`;
}
// Bộ lọc gồm các môn Strava + các hoạt động tự thêm (lấy từ setting). "all" = tất cả.
const SPORT_FILTERS = [
  { f: "Run", label: "🏃 Chạy" }, { f: "Ride", label: "🚴 Đạp" }, { f: "Walk", label: "🚶 Đi bộ" },
  { f: "Swim", label: "🏊 Bơi" }, { f: "Hike", label: "🥾 Leo núi" }, { f: "Yoga", label: "🧘 Yoga" },
];

// Đường cong Catmull-Rom mượt cho sparkline 7 ngày.
function Sparkline({ daily }: { daily: number[] }) {
  const W = 300, H = 90, pad = 14;
  const max = Math.max(...daily), min = Math.min(...daily);
  const span = max - min || max || 1;
  const lo = min - span * 0.35, hi = max + span * 0.2;
  const pts = daily.map((v, i) => ({ x: ((i + 0.5) / daily.length) * W, y: H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad) }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  const area = `${line} L ${last.x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
  return (
    <svg className="spark" viewBox="0 0 300 90" preserveAspectRatio="xMidYMid meet" aria-label="Biểu đồ quỹ 7 ngày qua">
      <defs>
        <linearGradient id="spg7" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18E4A2" stopOpacity="0.28" />
          <stop offset="1" stopColor="#18E4A2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spg7)" />
      <path d={line} fill="none" stroke="#18E4A2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.slice(0, -1).map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2" fill="#18E4A2" opacity="0.45" />
      ))}
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="4.5" fill="var(--surface)" stroke="#18E4A2" strokeWidth="2.5" />
    </svg>
  );
}

export default function LatestActivity({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const [d, setD] = useState<PulseData | null>(null);
  const [filter, setFilter] = useState("all");
  const [kinds, setKinds] = useState<{ f: string; label: string }[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pulse", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setD);
    fetch("/api/kinds", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { kinds: [] }))
      .then((j) => setKinds((j.kinds ?? []).map((k: { key: string; nameVi: string; icon: string }) => ({ f: k.key, label: `${k.icon} ${k.nameVi}` }))));
  }, []);

  const filterOpts = [{ f: "all", label: "Tất cả hoạt động" }, ...SPORT_FILTERS, ...kinds];
  const feed = d ? d.feed.filter((a) => filter === "all" || a.sport === filter || a.kindKey === filter) : [];
  const w = d?.week;

  return (
    <div className="card latest-card">
      <div className="split2">
        {/* PANEL TRÁI — feed */}
        <div className="lap-feed">
          <div className="lh">
            <div>
              <div className="t">⚡ Hoạt động mới nhất</div>
              <div className="u">Toàn công ty · realtime</div>
            </div>
            <div className="feed-head-right">
              <select className="feed-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc theo hoạt động">
                {filterOpts.map((c) => (
                  <option key={c.f} value={c.f}>{c.label}</option>
                ))}
              </select>
              <span className="feed-live">LIVE</span>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            {!d ? (
              <div className="act-empty" style={{ display: "block" }}>Đang tải…</div>
            ) : feed.length === 0 ? (
              <div className="act-empty" style={{ display: "block" }}>Chưa có hoạt động nào thuộc môn này.</div>
            ) : (
              feed.map((a) => (
                <div className="feed-item" key={a.id}>
                  <a
                    className="act"
                    href={`/activity/${a.id}`}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && e.button === 0) { e.preventDefault(); setOpenId(a.id); }
                    }}
                  >
                    <span
                      className="av-click"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenProfile(a.who.id); }}
                    >
                      <Avatar name={a.who.name} url={a.who.avatarUrl} size={40} />
                    </span>
                    <div className="grow">
                      <div className="at">{a.who.name} <span className="at-dept">· {a.who.team}</span></div>
                      <div className="as">{a.icon} {desc(a.sport, a.km, a.timeS, a.kindName)} · {relTime(a.dateISO)}</div>
                    </div>
                    <div className={`earn tnum${a.pending ? " pending" : ""}`}>{a.pending ? "chờ duyệt" : `+${vnd(a.amountVnd)}đ`}</div>
                  </a>
                  <Reactions activityId={a.id} initial={a.reactions} variant="feed" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL PHẢI — nhịp 7 ngày */}
        <div className="lap-pulse">
          <div className="lh"><div className="t">📈 Nhịp 7 ngày qua</div></div>
          <div className="ph-cap">Quỹ gây được 7 ngày</div>
          <div className="ph-row">
            <div className="ph-val tnum">+{vnd(w?.fundVnd ?? 0)}đ</div>
            {w && (
              <span className={`trend${w.trendPct < 0 ? " down" : ""}`}>
                {w.trendPct >= 0 ? "▲" : "▼"} {Math.abs(w.trendPct)}% vs tuần trước
              </span>
            )}
          </div>
          {w && <Sparkline daily={w.daily} />}
          <div className="spark-x">
            {(w?.dayLabels ?? ["", "", "", "", "", "", ""]).map((lb, i) => (
              <span key={i}>{lb}</span>
            ))}
          </div>
          <div className="ministats">
            <div className="ms"><b className="tnum">{w?.activities ?? 0}</b><span>hoạt động</span></div>
            <div className="ms"><b className="tnum">{Math.round(w?.km ?? 0).toLocaleString("vi-VN")}</b><span>km</span></div>
            <div className="ms"><b className="tnum">{w?.peopleMoved ?? 0}/{w?.totalPeople ?? 0}</b><span>đã vận động</span></div>
          </div>
          {w?.topSport && <div className="ph-foot">Sôi nổi nhất tuần: {w.topSport.icon} {w.topSport.vi}</div>}
        </div>
      </div>

      {openId && <ActivityModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
