"use client";

import Logo from "../Logo";
import type { BadgeState } from "@/lib/badges";

export interface Level { name: string; icon: string; color: string; xp: number; pct: number; next: { name: string; icon: string; minXp: number } | null }
export interface Title { key: string; name: string; icon: string; desc: string; earned: boolean }
export interface PassportMe {
  name: string; team: string; avatarUrl: string | null;
  level: Level; streakWeeks: number; totalVnd: number; kmSeason: number; khoaiBalance: number;
  titles: Title[]; badges: BadgeState[];
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN");
function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return w.length === 1 ? w[0].slice(0, 2).toUpperCase() : (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

export default function Passport({ me }: { me: PassportMe }) {
  const lv = me.level;
  return (
    <div className="wp-card">
      <div className="wp-brand"><Logo size={22} /><span className="wp-wm">wicom</span></div>
      <div className="wp-in">
        {/* Danh tính + vòng cấp */}
        <div className="wp-id">
          <div className="wp-avwrap" style={{ ["--lvc" as string]: lv.color }}>
            <div className="wp-lvring">
              <div className="wp-av">
                {me.avatarUrl ? <img src={me.avatarUrl} alt="" /> : <span>{initials(me.name)}</span>}
              </div>
            </div>
            <span className="wp-emblem" title={lv.name}>{lv.icon}</span>
          </div>
          <div className="wp-name">{me.name}</div>
          <div className="wp-team">{me.team} · Wicom</div>
          <div className="wp-xp">
            <b className="tnum">{vnd(lv.xp)}</b>{lv.next ? <> / {vnd(lv.next.minXp)} XP · còn để lên {lv.next.icon} {lv.next.name}</> : " XP · cấp cao nhất 🏛️"}
          </div>
        </div>

        <div className="wp-div" />

        {/* Đã góp cùng Wishare */}
        <div className="wp-money">
          <div className="wp-money-lb">Đã góp cùng Wishare</div>
          <div className="wp-money-vv tnum">{vnd(me.totalVnd)}đ</div>
        </div>

        {/* 3 chỉ số */}
        <div className="wp-stats">
          <div className="wp-stat"><b className="tnum">🔥 {me.streakWeeks}</b><small>Tuần streak</small></div>
          <div className="wp-stat"><b className="tnum">🥔 {me.khoaiBalance}</b><small>Khoai</small></div>
          <div className="wp-stat"><b className="tnum">🏃 {me.kmSeason}</b><small>Km mùa</small></div>
        </div>

        <div className="wp-div" />

        {/* Danh hiệu thể lực — tile chữ nhật */}
        <div className="wp-blabel">Danh hiệu thể lực</div>
        <div className="wp-rects">
          {me.titles.map((t) => (
            <span key={t.key} className={`wp-rect wp-tip${t.earned ? " on" : " locked"}`} data-tip={`${t.icon} ${t.name} · ${t.desc}${t.earned ? "" : " (chưa đạt)"}`}>{t.icon}</span>
          ))}
        </div>

        {/* Huy hiệu — lục giác */}
        <div className="wp-blabel" style={{ marginTop: 15 }}>Huy hiệu</div>
        <div className="wp-hexes">
          {me.badges.map((b) => (
            <span key={b.key} className={`wp-hx tier-${b.tier}${b.unlocked ? "" : " locked"} wp-tip`}
              data-tip={`${b.icon} ${b.name}${b.tierName ? ` · hạng ${b.tierName}` : " (chưa mở)"}`}>
              <span className="fr"></span><span className="fi"><span className="ic">{b.icon}</span></span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
