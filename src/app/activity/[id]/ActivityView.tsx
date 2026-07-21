"use client";

import { useEffect, useState } from "react";
import RouteMap from "./RouteMap";
import Reactions from "../../dashboard/Reactions";
import Comments from "./Comments";
import type { ReactionGroup } from "@/lib/reactions";

interface Split { km: number; meters: number; timeS: number; elevDiff: number; }
export interface Detail {
  name: string; sportKey: string; icon: string; sportVi: string; dateISO: string; pending: boolean;
  rejected?: boolean; rejectReason?: string | null; manual?: boolean; proofUrl?: string | null; note?: string | null;
  distanceKm: number; movingTimeS: number; elapsedTimeS: number; elevationGain: number;
  hasHr: boolean; avgHr: number | null; maxHr: number | null; cadence: number | null;
  calories: number | null; avgWatts: number | null; kudos: number; achievements: number;
  amountVnd: number; rateLabel: string; polyline: number[][] | null;
  hrSeries: number[] | null; elevSeries: number[] | null; splits: Split[];
  reactions: ReactionGroup[];
}

function Chart({ id, title, icon, values, color, unit }: { id: string; title: string; icon: string; values: number[]; color: string; unit: string }) {
  const W = 640, H = 96, PAD = 8;
  const min = Math.min(...values), max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1 || 1)) * (W - 2 * PAD);
    const y = PAD + (1 - (v - min) / range) * (H - 2 * PAD);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p}`).join(" ");
  const first = pts[0].split(" ")[0];
  const last = pts[pts.length - 1].split(" ")[0];
  const area = `${line} L${last} ${H - PAD} L${first} ${H - PAD} Z`;
  return (
    <div className="mini-chart">
      <div className="mc-head">
        <span className="mc-title">{icon} {title}</span>
        <div className="mc-badges tnum">
          <span>Thấp <b>{Math.round(min)}</b></span>
          <span>TB <b>{Math.round(avg)}</b></span>
          <span>Cao <b>{Math.round(max)}</b> {unit}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mc-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
function fmtTime(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}
function primary(sport: string, km: number, s: number): { v: string; u: string } {
  if (km <= 0 || s <= 0) return { v: "—", u: "" };
  if (sport === "Ride") return { v: (km / (s / 3600)).toFixed(1), u: "km/h" };
  if (sport === "Swim") {
    const sper100 = s / (km * 10);
    return { v: `${Math.floor(sper100 / 60)}:${String(Math.round(sper100 % 60)).padStart(2, "0")}`, u: "/100m" };
  }
  const pace = s / km;
  return { v: `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, "0")}`, u: "/km" };
}

// Phần thân chi tiết dùng chung cho trang riêng lẫn modal (id: id hoạt động).
export default function ActivityView({ id, idPrefix = "v" }: { id: string; idPrefix?: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setD(null);
    setErr(false);
    fetch(`/api/activity/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setErr(true));
  }, [id]);

  if (err) return <p className="lead">Không tải được chi tiết hoạt động.</p>;
  if (!d) return <p className="lead">Đang tải…</p>;

  const pm = primary(d.sportKey, d.distanceKm, d.movingTimeS);
  const maxSplitSpeed = Math.max(...d.splits.map((s) => (s.timeS > 0 ? s.meters / s.timeS : 0)), 0.001);

  // Thông số kiểu thẻ Activity: đúng 4 chỉ số trên 1 hàng — Quãng đường | Thời gian | Pace TB | Calo.
  const stats4: { label: string; value: string; sub?: string }[] = [
    { label: "Quãng đường", value: d.distanceKm > 0 ? d.distanceKm.toFixed(2) : "—", sub: d.distanceKm > 0 ? "km" : "" },
    { label: "Thời gian", value: fmtTime(d.movingTimeS) },
    { label: d.sportKey === "Ride" ? "Tốc độ TB" : "Pace TB", value: pm.v, sub: pm.u },
    { label: "Calo", value: d.calories ? `${Math.round(d.calories)}` : "—", sub: d.calories ? "kcal" : "" },
  ];

  const dateStr = new Date(d.dateISO).toLocaleString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const statusLabel = d.rejected ? "Từ chối" : d.pending ? "Chờ duyệt" : "Đã duyệt";
  const statusClass = d.rejected ? "s-rej" : d.pending ? "s-pend" : "s-appr";
  const hasMap = Boolean(d.polyline && d.polyline.length > 1);
  const hasProof = Boolean(d.manual && d.proofUrl);
  const hasRight = hasMap || hasProof;

  return (
    <>
      {/* ── Đầu trang: tiêu đề + trạng thái ── */}
      <div className="ad-head">
        <span className="ad-icon">{d.icon}</span>
        <div className="grow">
          <h2 className="title">{d.name}</h2>
          <p className="lead" style={{ marginTop: 4 }}>
            {d.sportVi} · {dateStr}
            {d.manual && <span className="status s-manual" style={{ marginLeft: 6 }}>Gửi tay</span>}
            <span className={`status ${statusClass}`} style={{ marginLeft: 6 }}>{statusLabel}</span>
          </p>
        </div>
        <div className="ad-fund-n">
          <span className="afn-lb">Quỹ tạo ra</span>
          <b className="tnum">{d.pending ? "chờ duyệt" : d.rejected ? "—" : `${vnd(d.amountVnd)}đ`}</b>
        </div>
      </div>

      {d.rejected && d.rejectReason && (
        <div className="reject-banner">✕ Hoạt động bị từ chối quy đổi{d.rejectReason ? `: ${d.rejectReason}` : ""}. Vẫn được ghi nhận trên hồ sơ của bạn.</div>
      )}

      {/* ── 2 cột 50/50: (trái) thông số + cảm xúc + bình luận · (phải) bản đồ ── */}
      <div className={`detail-2col${hasRight ? "" : " one"}`}>
        <div className="detail-left detail-card">
          {/* Thông số 4 chỉ số — nhãn trên, số dưới, ngăn bởi vạch dọc | */}
          <div className="ad-stats4">
            {stats4.map((s) => (
              <div className="as4" key={s.label}>
                <small>{s.label}</small>
                <b className="tnum">{s.value}{s.sub ? <em> {s.sub}</em> : null}</b>
              </div>
            ))}
          </div>
          {d.note && <div className="manual-note">📝 {d.note}</div>}
          {/* Cảm xúc kiểu Lark: icon + tên người thả */}
          <Reactions activityId={id} initial={d.reactions} variant="detail" />
          {/* Toàn bộ bình luận hiện sẵn */}
          <Comments activityId={id} />
        </div>
        {hasRight && (
          <div className="detail-right">
            {hasMap ? (
              <div className="detail-map">
                <RouteMap points={d.polyline!} />
              </div>
            ) : (
              <div className="detail-proof">
                <div className="dp-lb">📷 Bằng chứng</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={d.proofUrl!} target="_blank" rel="noreferrer"><img src={d.proofUrl!} alt="Bằng chứng" /></a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Biểu đồ nhịp tim / cao độ — gọn, gộp chung 1 khối ── */}
      {((d.hrSeries && d.hrSeries.length > 1) || (d.elevSeries && d.elevSeries.length > 1)) && (
        <div className="detail-charts">
          {d.hrSeries && d.hrSeries.length > 1 && (
            <Chart id={`${idPrefix}-hr`} title="Nhịp tim" icon="❤️" values={d.hrSeries} color="#E5544B" unit="bpm" />
          )}
          {d.elevSeries && d.elevSeries.length > 1 && (
            <Chart id={`${idPrefix}-elev`} title="Cao độ" icon="⛰️" values={d.elevSeries} color="#33A3DC" unit="m" />
          )}
        </div>
      )}

      {d.splits.length > 0 && (
        <div className="detail-splits">
          <div className="ds-head">
            <span className="ds-title">📏 Chi tiết từng km</span>
            <span className="ds-sub tnum">{d.splits.length} km · {d.distanceKm.toFixed(1)} km tổng</span>
          </div>
          <div className="splits">
            {d.splits.map((s) => {
              const speed = s.timeS > 0 ? s.meters / s.timeS : 0;
              const paceSec = speed > 0 ? 1000 / speed : 0;
              const label =
                d.sportKey === "Ride"
                  ? `${(speed * 3.6).toFixed(1)} km/h`
                  : `${Math.floor(paceSec / 60)}:${String(Math.round(paceSec % 60)).padStart(2, "0")}/km`;
              return (
                <div className="split-row" key={s.km}>
                  <span className="sp-km tnum">KM {s.km}</span>
                  <div className="sp-bar"><i style={{ width: `${(speed / maxSplitSpeed) * 100}%` }} /></div>
                  <span className="sp-pace tnum">{label}</span>
                  <span className="sp-elev tnum">{s.elevDiff >= 0 ? "▲" : "▼"} {Math.abs(Math.round(s.elevDiff))}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
