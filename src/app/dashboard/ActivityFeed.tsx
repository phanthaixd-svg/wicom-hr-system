"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "../Avatar";
import ActivityModal from "../me/ActivityModal";

interface FeedItem {
  id: string; sport: string; icon: string; name: string; dateISO: string;
  distanceKm: number; timeS: number; amountVnd: number; pending: boolean;
  who: { id: string; name: string; team: string; avatarUrl: string | null };
}
interface FeedData { myTeam: string | null; sports: { key: string; vi: string; icon: string }[]; items: FeedItem[]; }

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dayLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);
  if (diff <= 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff < 7) return `${diff} ngày trước`;
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
}
function relTime(iso: string): string {
  const d = new Date(iso), now = new Date();
  const sameDay = startOfDay(d).getTime() === startOfDay(now).getTime();
  if (sameDay) {
    const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
    if (mins < 1) return "vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    return `${Math.round(mins / 60)} giờ trước`;
  }
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function ActivityFeed({ from, to, onOpenProfile }: { from: string; to: string; onOpenProfile: (id: string) => void }) {
  const [data, setData] = useState<FeedData | null>(null);
  const [sport, setSport] = useState("all");
  const [scope, setScope] = useState<"all" | "team">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/feed?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [from, to]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter(
      (a) => (sport === "all" || a.sport === sport) && (scope === "all" || a.who.team === data.myTeam),
    );
  }, [data, sport, scope]);

  // Nhóm theo ngày (giữ thứ tự mới→cũ).
  const groups = useMemo(() => {
    const m = new Map<string, FeedItem[]>();
    for (const a of filtered) {
      const k = dayLabel(a.dateISO);
      (m.get(k) ?? m.set(k, []).get(k)!).push(a);
    }
    return [...m.entries()];
  }, [filtered]);

  return (
    <div className="card feedcard">
      <div className="feed-head">
        <div>
          <h3>Bảng tin hoạt động</h3>
          <p className="sub">Toàn công ty · đồng bộ từ Strava</p>
        </div>
        <span className="sub tnum">{filtered.length} hoạt động</span>
      </div>

      <div className="feed-tools">
        <div className="seg">
          <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>🌐 Toàn công ty</button>
          <button className={scope === "team" ? "on" : ""} onClick={() => setScope("team")} disabled={!data?.myTeam}>
            🏢 Phòng tôi
          </button>
        </div>
        <span className="grow" />
        <div className="filters" style={{ marginTop: 0 }}>
          <button className={`filt${sport === "all" ? " active" : ""}`} onClick={() => setSport("all")}>Tất cả</button>
          {(data?.sports ?? []).map((s) => (
            <button key={s.key} className={`filt${sport === s.key ? " active" : ""}`} onClick={() => setSport(s.key)}>
              {s.icon} {s.vi}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="feed-empty">Đang tải…</div>
      ) : filtered.length === 0 ? (
        <div className="feed-empty">Chưa có hoạt động nào phù hợp trong khoảng ngày này.</div>
      ) : (
        groups.map(([day, items]) => (
          <div key={day}>
            <div className="feed-day">{day}</div>
            <div className="feed-grid">
              {items.map((a) => (
                <a
                  className="feed-row"
                  href={`/activity/${a.id}`}
                  key={a.id}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                      e.preventDefault();
                      setOpenId(a.id);
                    }
                  }}
                >
                  <span
                    className="av-click"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenProfile(a.who.id);
                    }}
                  >
                    <Avatar name={a.who.name} url={a.who.avatarUrl} size={40} />
                  </span>
                  <div className="fr-txt">
                    <b>
                      {a.who.name} <span className="fr-dept">· {a.who.team}</span>
                    </b>
                    <span className="fr-act">
                      {a.icon} {a.name} · {a.distanceKm > 0 ? `${a.distanceKm.toFixed(1)} km · ` : ""}
                      {relTime(a.dateISO)}
                    </span>
                  </div>
                  <div className={`fr-earn${a.pending ? " pending" : ""}`}>
                    {a.pending ? "chờ duyệt" : `+${vnd(a.amountVnd)}đ`}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))
      )}

      {openId && <ActivityModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
