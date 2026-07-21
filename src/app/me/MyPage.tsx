"use client";

import { useEffect, useMemo, useState } from "react";
import Logo from "../Logo";
import ActivityModal from "./ActivityModal";
import Badges, { type Badge } from "./Badges";
import Goals from "./Goals";
import NotifySettings from "./NotifySettings";
import SubmitActivity from "./SubmitActivity";
import ConnectApps from "./ConnectApps";

interface Act {
  id: string; sport: string; icon: string; name: string; km: number; timeS: number;
  date: string; amountVnd: number; pending: boolean; rateLabel: string;
  rejected?: boolean; manual?: boolean;
}
interface MeData {
  name: string; team: string; avatarUrl: string | null;
  stravaConnected: boolean; stravaConnectedAt: string | null;
  totalVnd: number; totalKm: number; count: number; streak: number;
  rank: number; percentile: number; totalPeople: number;
  badges: Badge[]; unlockedBadges: number; totalTiers: number; pendingCount: number;
  recent: Act[]; sports: { key: string; vi: string; icon: string }[];
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");

function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff <= 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  if (diff < 7) return `${diff} ngày trước`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}
function timeLabel(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

// Nội dung tab "Wicer" (Trang của tôi). Header/điều hướng do AppShell lo.
export default function MyPage() {
  const [data, setData] = useState<MeData | null>(null);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [hint, setHint] = useState('💡 Chụp riêng vùng thẻ để có ảnh dọc đẹp nhất cho Story — hoặc bấm "Lưu / chia sẻ".');

  const reload = () =>
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);

  useEffect(() => {
    reload();
  }, []);

  const shareText = useMemo(
    () =>
      data
        ? `Quý này mình đã góp ${vnd(data.totalVnd)}đ cùng Wishare qua Move4Wishare — ${Math.round(data.totalKm)}km / ${data.count} hoạt động 🏃💪 #Move4Wishare`
        : "",
    [data],
  );

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Wicom Move", text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setHint('✓ Đã sao chép nội dung khoe — chụp màn hình tấm thẻ rồi đăng kèm nhé!');
      }
    } catch {
      setHint("💡 Chụp màn hình vùng thẻ (Cmd/Ctrl + Shift + 4) để lưu ảnh dọc.");
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://move.wicom.vn/the/toi");
      setHint("✓ Đã sao chép link thẻ: move.wicom.vn/the/toi");
    } catch {
      setHint("🔗 Link thẻ: move.wicom.vn/the/toi");
    }
  };

  const filtered = data ? data.recent.filter((a) => filter === "all" || a.sport === filter) : [];

  return (
    <div className="wrap">
      <div className="me-grid">
        {/* LEFT: thẻ vận động */}
        <aside className="me-left">
          <div className="flexcard">
            <div className="fc-in">
              <div className="fc-head">
                <div className="fc-brand">
                  <Logo size={20} /> Move4Wishare
                </div>
              </div>
              <div className="fc-ava">
                <div className="ring">
                  {data?.avatarUrl ? (
                    <img className="fc-photo" src={data.avatarUrl} alt="" />
                  ) : (
                    <div className="fc-init">{data ? initialsOf(data.name) : ""}</div>
                  )}
                </div>
                <div className="nm">{data?.name ?? "…"}</div>
                <div className="dp">{data?.team ?? ""} · Wicom</div>
              </div>
              <div className="fc-money">
                <div className="lb">Đã góp cùng Wishare</div>
                <div className="vv tnum">{data ? vnd(data.totalVnd) : "0"}đ</div>
              </div>
              <div className="fc-stats">
                <div className="fc-stat"><b className="tnum">{data ? Math.round(data.totalKm) : 0}</b><span>km</span></div>
                <div className="fc-stat"><b className="tnum">{data?.count ?? 0}</b><span>hoạt động</span></div>
                <div className="fc-stat"><b className="tnum">{data?.streak ?? 0}🔥</b><span>ngày streak</span></div>
              </div>
              <div className="fc-foot">
                <div className="tag">
                  Mỗi bước chân là một đóng góp
                  <br />
                  <b>#Move4Wishare</b>
                </div>
                <span className="fc-rank">TOP {data?.percentile ?? 100}%</span>
              </div>
            </div>
          </div>
          <div className="share-btns">
            <button className="btn pri" onClick={share}>📷 Lưu / chia sẻ</button>
            <button className="btn ghost" onClick={copyLink} title="Sao chép link thẻ">🔗 Link</button>
          </div>
          <div className="share-hint">{hint}</div>

          <ConnectApps connected={data?.stravaConnected ?? false} onChange={reload} />
        </aside>

        {/* RIGHT: huy hiệu + hoạt động */}
        <div className="me-right">
          <Badges badges={data?.badges ?? []} unlocked={data?.unlockedBadges ?? 0} totalTiers={data?.totalTiers ?? 0} />

          <Goals />

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <h3>Hoạt động gần đây</h3>
                <p className="sub">Đồng bộ từ Strava · hoặc gửi tay</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {data && data.pendingCount > 0 && <span className="pill warn">{data.pendingCount} chờ duyệt</span>}
                <SubmitActivity onDone={reload} />
              </div>
            </div>
            <div className="filters">
              <button className={`filt${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
                Tất cả
              </button>
              {(data?.sports ?? []).map((s) => (
                <button key={s.key} className={`filt${filter === s.key ? " active" : ""}`} onClick={() => setFilter(s.key)}>
                  {s.icon} {s.vi}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              {!data ? (
                <div className="act-empty" style={{ display: "block" }}>Đang tải…</div>
              ) : filtered.length === 0 ? (
                <div className="act-empty" style={{ display: "block" }}>Chưa có hoạt động nào thuộc môn này.</div>
              ) : (
                filtered.map((a) => (
                  <a
                    className="act"
                    href={`/activity/${a.id}`}
                    key={a.id}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                        e.preventDefault();
                        setOpenId(a.id);
                      }
                    }}
                  >
                    <span className="sport">{a.icon}</span>
                    <div className="grow">
                      <div className="at">
                        {a.name}{" "}
                        {a.manual && <span className="status s-manual">Gửi tay</span>}{" "}
                        <span className={`status ${a.rejected ? "s-rej" : a.pending ? "s-pend" : "s-appr"}`}>
                          {a.rejected ? "Từ chối" : a.pending ? "Chờ duyệt" : "Đã duyệt"}
                        </span>
                      </div>
                      <div className="as">
                        {dateLabel(a.date)} · {a.km > 0 ? `${a.km.toFixed(1)} km · ` : ""}
                        {timeLabel(a.timeS)}
                      </div>
                    </div>
                    <div className="earn tnum">
                      {a.pending ? "—" : `+${vnd(a.amountVnd)}đ`}
                      <small>{a.rateLabel}</small>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          <NotifySettings />
        </div>
      </div>

      {openId && <ActivityModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
