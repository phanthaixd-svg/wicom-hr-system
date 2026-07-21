"use client";

import { useCallback, useEffect, useState } from "react";
import Avatar from "../Avatar";
import ActivityModal from "../me/ActivityModal";
import SubmitActivity from "../me/SubmitActivity";
import Reactions from "./Reactions";
import Comments from "../activity/[id]/Comments";
import type { ReactionGroup } from "@/lib/reactions";

interface FeedItem {
  id: string; sport: string; kindKey?: string | null; icon: string; kindName?: string | null; name: string;
  km: number; timeS: number; dateISO: string; amountVnd: number; pending: boolean;
  who: { id: string; name: string; team: string; avatarUrl: string | null };
  routePath: string | null;
  reactions: ReactionGroup[]; commentCount: number; topComment: { name: string; body: string } | null;
}
interface MineRecent { id: string; name: string; icon: string; km: number; dateISO: string }
interface Mine { name: string; avatarUrl: string | null; weekKm: number; weekVnd: number; weekCount: number; movePct: number; moveKmLeft: number; recent: MineRecent[] }
interface Cheer { count: number; people: { id: string; name: string; avatarUrl: string | null }[] }
interface Pulse { feed: FeedItem[]; mine: Mine; cheer: Cheer }

function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return w.length === 1 ? w[0].slice(0, 2).toUpperCase() : (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
function shortVnd(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${Math.round(n)}`;
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
function relTime(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}
function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}
function pace(km: number, s: number) {
  if (km <= 0 || s <= 0) return "—";
  const perKm = s / km;
  return `${Math.floor(perKm / 60)}:${String(Math.round(perKm % 60)).padStart(2, "0")}`;
}

const FILTERS = [
  { f: "all", label: "Tất cả" }, { f: "Run", label: "🏃 Chạy" }, { f: "Ride", label: "🚴 Đạp" },
  { f: "Swim", label: "🏊 Bơi" }, { f: "Yoga", label: "🧘 Yoga" },
];

export default function MoveFeed({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const [d, setD] = useState<Pulse | null>(null);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cmtOpen, setCmtOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    fetch("/api/pulse", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setD);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleCmt = (id: string) => setCmtOpen((s) => ({ ...s, [id]: !s[id] }));

  const feed = d ? d.feed.filter((a) => filter === "all" || a.sport === filter || a.kindKey === filter) : [];
  const mine = d?.mine;
  const cheer = d?.cheer;

  return (
    <div className="m4-feedgrid">
      {/* MAIN — feed */}
      <div className="m4-main">
        <div className="m4-feedhead">
          <span className="m4-live">📸 Toàn công ty · <b>LIVE</b></span>
          <div className="m4-fseg">
            {FILTERS.map((c) => (
              <button key={c.f} className={filter === c.f ? "on" : ""} onClick={() => setFilter(c.f)}>{c.label}</button>
            ))}
          </div>
        </div>

        <div className="m4-feedlist">
        {!d ? (
          <div className="act-empty" style={{ display: "block" }}>Đang tải bảng tin…</div>
        ) : feed.length === 0 ? (
          <div className="act-empty" style={{ display: "block" }}>Chưa có hoạt động nào thuộc môn này.</div>
        ) : (
          feed.map((a) => {
            const fresh = Date.now() - new Date(a.dateISO).getTime() < 60 * 60 * 1000;
            const distSport = a.km > 0;
            const cmtShown = !!cmtOpen[a.id];
            return (
              <div className={`m4-post${fresh ? " fresh" : ""}`} key={a.id}>
                <div className="m4-phead">
                  <span className="m4-av-click" onClick={() => onOpenProfile(a.who.id)}>
                    <Avatar name={a.who.name} url={a.who.avatarUrl} size={42} />
                  </span>
                  <div className="m4-who">
                    <b onClick={() => onOpenProfile(a.who.id)}>{a.who.name}</b>
                    <div className="m4-meta">{relTime(a.dateISO)} · {a.who.team}</div>
                  </div>
                  {a.pending
                    ? <span className="m4-fund pending">chờ duyệt</span>
                    : <span className="m4-fund" title="Quỹ Wishare hoạt động này tạo ra">+{vnd(a.amountVnd)}đ</span>}
                </div>

                <div className="m4-title" onClick={() => setOpenId(a.id)}>
                  <span className="m4-tic">{a.icon}</span>
                  <span className="m4-tnm">{a.name}</span>
                </div>

                <div className={`m4-body${a.routePath ? " has-map" : ""}`}>
                  <div className="m4-statcol">
                    {distSport ? (
                      <>
                        <div className="m4-stat"><small>Quãng đường</small><b className="tnum">{a.km.toFixed(2)} <i>km</i></b></div>
                        <div className="m4-stat"><small>{a.sport === "Ride" ? "Tốc độ" : "Pace"}</small><b className="tnum">{a.sport === "Ride" ? `${(a.km / (a.timeS / 3600)).toFixed(1)} ` : `${pace(a.km, a.timeS)} `}<i>{a.sport === "Ride" ? "km/h" : "/km"}</i></b></div>
                        <div className="m4-stat"><small>Thời gian</small><b className="tnum">{fmtTime(a.timeS)}</b></div>
                      </>
                    ) : (
                      <>
                        <div className="m4-stat"><small>Thời gian</small><b className="tnum">{fmtTime(a.timeS)}</b></div>
                        <div className="m4-stat"><small>Buổi</small><b className="tnum">1</b></div>
                      </>
                    )}
                  </div>
                  {a.routePath && (
                    <button className="m4-map" onClick={() => setOpenId(a.id)} aria-label="Xem chi tiết tuyến">
                      <svg viewBox="0 0 96 64" preserveAspectRatio="xMidYMid meet"><path d={a.routePath} fill="none" stroke="var(--strava)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )}
                </div>

                <div className="m4-social">
                  <Reactions activityId={a.id} initial={a.reactions} variant="feed" />
                  <button className={`m4-cmt${cmtShown ? " on" : ""}`} onClick={() => toggleCmt(a.id)}>💬 {a.commentCount || "Bình luận"}</button>
                </div>

                {!cmtShown && a.topComment && (
                  <div className="m4-comment" onClick={() => toggleCmt(a.id)}>
                    <b>{a.topComment.name}:</b> {a.topComment.body}
                    {a.commentCount > 1 && <span className="m4-cmt-more"> · xem {a.commentCount} bình luận</span>}
                  </div>
                )}
                {cmtShown && (
                  <div className="m4-cmtpanel">
                    <Comments activityId={a.id} />
                  </div>
                )}
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* SIDE — Của tôi (thẻ profile kiểu Strava) */}
      <aside className="m4-side">
        <div className="card m4-mine">
          <div className="m4m-av">
            {mine?.avatarUrl ? <img src={mine.avatarUrl} alt="" /> : <span>{mine ? initials(mine.name) : ""}</span>}
          </div>
          <div className="m4m-name">{mine?.name ?? "…"}</div>

          <div className="m4m-stats3">
            <div className="m4m-s"><b className="tnum">{mine?.weekKm ?? 0}</b><small>Km tuần</small></div>
            <div className="m4m-s"><b className="tnum">{mine?.weekCount ?? 0}</b><small>Hoạt động tuần</small></div>
            <div className="m4m-s"><b className="tnum">{mine ? shortVnd(mine.weekVnd) : 0}</b><small>Tôi góp</small></div>
          </div>

          <div className="m4m-recent">
            <div className="m4m-rh">Hoạt động gần đây</div>
            {mine && mine.recent.length ? (
              mine.recent.map((a) => (
                <button className="m4m-ract" key={a.id} onClick={() => setOpenId(a.id)}>
                  <span className="ic">{a.icon}</span>
                  <span className="nm">{a.name}</span>
                  <span className="dt">{shortDate(a.dateISO)}{a.km > 0 ? ` · ${a.km.toFixed(1)}km` : ""}</span>
                </button>
              ))
            ) : (
              <div className="m4m-empty">Chưa có hoạt động nào.</div>
            )}
          </div>

          <div className="m4m-move">
            <div className="m4-move-h"><span>💪 Vòng Move tuần</span><b>{mine?.movePct ?? 0}%</b></div>
            <div className="m4-move-bar"><span style={{ width: `${mine?.movePct ?? 0}%` }} /></div>
            <div className="m4-move-hint">{mine && mine.moveKmLeft > 0 ? `Còn ${mine.moveKmLeft}km khép vòng` : "Đã khép vòng Move tuần này 🎉"}</div>
          </div>

          {cheer && cheer.count > 0 && (
            <div className="m4m-cheer">
              <div className="m4m-cheer-avs">{cheer.people.map((p) => <Avatar key={p.id} name={p.name} url={p.avatarUrl} size={24} />)}</div>
              <span className="m4m-cheer-tx">👏 {cheer.count} đồng đội vừa xong — cổ vũ →</span>
            </div>
          )}
        </div>

        {/* Thêm hoạt động ngay trong Bảng tin (kết quả cập nhật vào feed + widget) */}
        <div className="m4m-add">
          <SubmitActivity onDone={load} />
        </div>
        <p className="m4m-add-hint">Có buổi tập chưa lên Strava? Gửi tay để được ghi nhận vào quỹ.</p>
      </aside>

      {openId && <ActivityModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
