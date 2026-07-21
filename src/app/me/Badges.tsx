"use client";

import { useState } from "react";

export interface Badge {
  key: string;
  name: string;
  icon: string;
  unit: string;
  desc: string;
  money: boolean;
  value: number;
  tier: number;
  tierName: string | null;
  nextThreshold: number | null;
  prevThreshold: number;
  pct: number;
  unlocked: boolean;
  rarityPct: number;
  tiers: [number, number, number];
}

const TIERS = ["Đồng", "Bạc", "Vàng"];

function fmt(v: number, money: boolean): string {
  if (money) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return `${Math.round(v)}`;
  }
  return `${Math.round(v * 10) / 10}`.replace(/\.0$/, "");
}

function Hex({ icon }: { icon: string }) {
  return (
    <span className="hex-frame">
      <span className="hex-fill">
        <span className="hex-ico">{icon}</span>
      </span>
    </span>
  );
}

export default function Badges({ badges, unlocked, totalTiers }: { badges: Badge[]; unlocked: number; totalTiers: number }) {
  const [sel, setSel] = useState<string | null>(null);
  const b = badges.find((x) => x.key === sel) ?? null;
  const withUnit = (v: number, money: boolean, unit: string) => `${fmt(v, money)}${money ? "" : ` ${unit}`}`;

  return (
    <div className="card badges-card">
      <div className="badges-head">
        <div>
          <h3>🎖️ Huy hiệu</h3>
          <p className="sub">Bấm vào huy hiệu để xem chi tiết</p>
        </div>
        <div className="badges-score">
          <div className="bs-num tnum">{unlocked}<span>/{badges.length}</span></div>
          <div className="bs-lb">{totalTiers}★ tổng hạng</div>
        </div>
      </div>

      <div className="hex-row">
        {badges.map((x) => (
          <button
            key={x.key}
            className={`hex-btn tier-${x.tier}${x.unlocked ? " on" : " off"}${sel === x.key ? " sel" : ""}`}
            onClick={() => setSel(sel === x.key ? null : x.key)}
            title={x.name}
            aria-label={`${x.name}${x.tierName ? ` — hạng ${x.tierName}` : " — chưa mở"}`}
          >
            <Hex icon={x.icon} />
          </button>
        ))}
      </div>

      {b && (
        <div className="badge-detail">
          <div className={`bd-medal hex-btn tier-${b.tier}${b.unlocked ? " on" : " off"}`}>
            <Hex icon={b.icon} />
          </div>
          <div className="bd-body">
            <div className="bd-name">
              {b.name}
              {b.tierName ? (
                <span className={`tier-tag t${b.tier}`}>Hạng {b.tierName}</span>
              ) : (
                <span className="tier-tag locked">Chưa mở</span>
              )}
            </div>
            <div className="bd-desc">{b.desc}</div>

            <div className="bd-prog">
              <div className="bp-track"><i style={{ width: `${b.pct}%` }} /></div>
              <div className="bp-label tnum">
                <b>{withUnit(b.value, b.money, b.unit)}</b>
                {b.nextThreshold != null ? (
                  <span className="bp-next">
                    / {withUnit(b.nextThreshold, b.money, b.unit)}
                    <em> · lên hạng {TIERS[b.tier] ?? ""}</em>
                  </span>
                ) : (
                  <span className="bp-max">Đã đạt đỉnh 🏆</span>
                )}
              </div>
            </div>

            <div className="bd-foot">
              {b.unlocked ? (
                <span className="badge-rarity">🏆 Chỉ Top {b.rarityPct}% công ty đạt được</span>
              ) : (
                <span className="badge-locked">
                  🔒 Còn {withUnit(Math.max(0, (b.nextThreshold ?? 0) - b.value), b.money, b.unit)} để mở khoá hạng Đồng
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
