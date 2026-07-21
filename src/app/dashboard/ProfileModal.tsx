"use client";

import { useEffect, useState } from "react";
import Avatar from "../Avatar";
import Modal from "@/components/ui/Modal";
import ActivityModal from "../me/ActivityModal";

interface Act { id: string; icon: string; name: string; km: number; timeS: number; date: string; amountVnd: number; pending: boolean; }
interface Profile {
  id: string; name: string; team: string; avatarUrl: string | null; isMe: boolean;
  totalVnd: number; totalKm: number; count: number; streak: number; since: string | null; recent: Act[];
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
function dateLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff <= 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff < 7) return `${diff} ngày trước`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
function timeLabel(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

export default function ProfileModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState(false);
  const [actId, setActId] = useState<string | null>(null);

  useEffect(() => {
    setP(null);
    setErr(false);
    fetch(`/api/employee/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setP)
      .catch(() => setErr(true));
  }, [id]);

  return (
    <Modal onClose={onClose} panelClassName="profile-panel">
      <>
        {err ? (
          <p className="lead">Không tải được hồ sơ.</p>
        ) : !p ? (
          <p className="lead">Đang tải…</p>
        ) : (
          <>
            <div className="pf-head">
              <Avatar name={p.name} url={p.avatarUrl} size={64} className="pf-av" />
              <div className="pf-head-meta">
                <b className="pf-name"><span className="pf-name-txt">{p.name}</span>{p.isMe && <span className="youtag">YOU</span>}</b>
                <div className="pf-dp">{p.team} · Wicom{p.since ? ` · từ ${new Date(p.since).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" })}` : ""}</div>
              </div>
            </div>

            <div className="pf-stats">
              <div><b className="num">{Math.round(p.totalKm)}</b><span>km</span></div>
              <div><b className="num">{p.count}</b><span>hoạt động</span></div>
              <div><b className="num pf-fund">{vnd(p.totalVnd)}đ</b><span>đã góp quỹ</span></div>
              <div><b className="num">{p.streak}🔥</b><span>streak</span></div>
            </div>

            <div className="pf-sec">Hoạt động gần đây</div>
            <div className="pf-list">
              {p.recent.length === 0 ? (
                <div className="feed-empty">Chưa có hoạt động nào.</div>
              ) : (
                p.recent.map((a) => (
                  <button className="pf-act" key={a.id} onClick={() => setActId(a.id)}>
                    <span className="sport">{a.icon}</span>
                    <div className="grow">
                      <div className="at">{a.name}</div>
                      <div className="as">{dateLabel(a.date)} · {a.km > 0 ? `${a.km.toFixed(1)} km · ` : ""}{timeLabel(a.timeS)}</div>
                    </div>
                    <div className={`pf-earn${a.pending ? " pending" : ""}`}>{a.pending ? "chờ duyệt" : `+${vnd(a.amountVnd)}đ`}</div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
        {actId && <ActivityModal id={actId} onClose={() => setActId(null)} />}
      </>
    </Modal>
  );
}
