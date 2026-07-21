"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "../Avatar";

interface SportAgg { km: number; count: number; vnd: number; }
interface Agg { totalVnd: number; totalKm: number; activities: number; bySport: Record<string, SportAgg>; }
interface Emp extends Agg { id: string; name: string; team: string | null; avatarUrl: string | null; isMe: boolean; }
interface Prev extends Agg { id: string; team: string | null; }
interface SportMeta { key: string; vi: string; icon: string; }

type GroupBy = "person" | "team";
type Metric = "money" | "km" | "count";

interface Entity extends Agg { id: string; name: string; sub: string; avatarUrl: string | null; isMe: boolean; }

const vndF = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
function fullFmt(v: number, m: Metric) {
  if (m === "money") return vndF(v);
  if (m === "km") return `${v.toFixed(1)} km`;
  return `${Math.round(v)} hoạt động`;
}
function shortFmt(v: number, m: Metric) {
  if (m === "money") return `${Math.round(v / 1000)}k`;
  if (m === "km") return `${Math.round(v)}km`;
  return `${Math.round(v)}`;
}
function metricVal(e: Agg, m: Metric, sport: string) {
  if (m === "money") return e.totalVnd;
  const s = e.bySport[sport] ?? { km: 0, count: 0, vnd: 0 };
  return m === "km" ? s.km : s.count;
}

type EntityInput = Agg & { id: string; name?: string; team: string | null; avatarUrl?: string | null; isMe?: boolean };
function entitiesOf(list: EntityInput[], groupBy: GroupBy, myTeam: string | null): Entity[] {
  if (groupBy === "person") {
    return list.map((e) => ({
      id: e.id, name: e.name ?? "", sub: e.team ?? "Wicom", avatarUrl: e.avatarUrl ?? null, isMe: Boolean(e.isMe),
      totalVnd: e.totalVnd, totalKm: e.totalKm, activities: e.activities, bySport: e.bySport,
    }));
  }
  const m = new Map<string, Entity & { members: number }>();
  for (const e of list) {
    const k = e.team || "Khác";
    let t = m.get(k);
    if (!t) { t = { id: k, name: k, sub: "", avatarUrl: null, isMe: k === myTeam, totalVnd: 0, totalKm: 0, activities: 0, bySport: {}, members: 0 }; m.set(k, t); }
    t.totalVnd += e.totalVnd;
    t.totalKm += e.totalKm;
    t.activities += e.activities;
    t.members += 1;
    for (const sk of Object.keys(e.bySport)) {
      const cur = t.bySport[sk] ?? { km: 0, count: 0, vnd: 0 };
      cur.km += e.bySport[sk].km; cur.count += e.bySport[sk].count; cur.vnd += e.bySport[sk].vnd;
      t.bySport[sk] = cur;
    }
  }
  for (const t of m.values()) t.sub = `${t.members} thành viên`;
  return [...m.values()];
}

export default function Leaderboard({ employees, prev, sports, onOpenProfile }: { employees: Emp[]; prev: Prev[]; sports: SportMeta[]; onOpenProfile: (id: string) => void }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("person");
  const [metric, setMetric] = useState<Metric>("money");
  const [sport, setSport] = useState("Run");
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const myTeam = employees.find((e) => e.isMe)?.team ?? null;

  const board = useMemo(() => {
    const val = (e: Agg) => metricVal(e, metric, sport);
    let curr = entitiesOf(employees, groupBy, myTeam).map((e) => ({ ...e, value: val(e) }));
    let prevE = entitiesOf(prev, groupBy, myTeam).map((e) => ({ ...e, value: val(e) }));
    if (metric !== "money") { curr = curr.filter((e) => e.value > 0); prevE = prevE.filter((e) => e.value > 0); }
    curr.sort((a, b) => b.value - a.value);
    prevE.sort((a, b) => b.value - a.value);
    const prevRank = new Map(prevE.map((e, i) => [e.id, i + 1]));
    return curr.map((e, i) => ({ ...e, rank: i + 1, delta: prevRank.has(e.id) ? prevRank.get(e.id)! - (i + 1) : null }));
  }, [employees, prev, groupBy, myTeam, metric, sport]);

  useEffect(() => {
    const sync = () => {
      if (!leftRef.current || !rightRef.current) return;
      rightRef.current.style.height = ""; // reset để đo tự nhiên
      // Chỉ đồng bộ khi 2 cột nằm CÙNG HÀNG (desktop) — mobile xếp dọc thì để cao tự nhiên.
      const sideBySide = Math.abs(leftRef.current.offsetTop - rightRef.current.offsetTop) < 6;
      if (sideBySide) rightRef.current.style.height = `${leftRef.current.offsetHeight}px`;
    };
    const raf = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(() => requestAnimationFrame(sync));
    if (leftRef.current) ro.observe(leftRef.current);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", sync); ro.disconnect(); };
  }, [board]);

  const podOrder = board.length >= 3 ? [1, 0, 2] : board.length === 2 ? [1, 0] : board.length === 1 ? [0] : [];
  const meIdx = board.findIndex((p) => p.isMe);
  const me = meIdx >= 0 ? board[meIdx] : null;
  const above = meIdx > 0 ? board[meIdx - 1] : null;

  const deltaEl = (d: number | null) => {
    if (d == null || d === 0) return <div className="dl flat">–</div>;
    if (d > 0) return <div className="dl up">▲ +{d} hạng</div>;
    return <div className="dl down">▼ {d} hạng</div>;
  };

  const METRICS: { k: Metric; label: string }[] = [
    { k: "money", label: "💰 Tiền" }, { k: "km", label: "📏 Km" }, { k: "count", label: "🔁 Hoạt động" },
  ];

  return (
    <div className="lbsec">
      <div className="lb-topbar">
        <div>
          <div className="eyebrow">Bảng xếp hạng · kỳ này</div>
          <h2 className="lb-title">Top đóng góp kỳ này</h2>
        </div>
        <div className="lb-controls">
          <div className="seg">
            {METRICS.map((mo) => (
              <button key={mo.k} className={metric === mo.k ? "active" : ""} onClick={() => setMetric(mo.k)}>{mo.label}</button>
            ))}
          </div>
          {metric !== "money" && (
            <select className="lb-sport" value={sport} onChange={(e) => setSport(e.target.value)}>
              {sports.filter((s) => s.key !== "Other").map((s) => (
                <option key={s.key} value={s.key}>{s.icon} {s.vi}</option>
              ))}
            </select>
          )}
          <div className="seg">
            <button className={groupBy === "person" ? "active" : ""} onClick={() => setGroupBy("person")}>👤 Cá nhân</button>
            <button className={groupBy === "team" ? "active" : ""} onClick={() => setGroupBy("team")}>👥 Phòng ban</button>
          </div>
        </div>
      </div>

      <div className="lbx">
        {/* CỘT TRÁI — sân khấu */}
        <div className="card lb-left" ref={leftRef}>
          <div className="pod-head">
            <span className="t">Kỳ này · Top 3 {groupBy === "team" ? "phòng ban " : ""}🎉</span>
            {me && <span className="chip-up">{me.delta && me.delta > 0 ? `▲ +${me.delta} hạng` : `Hạng #${me.rank}`}</span>}
          </div>

          <div className="podium3">
            {podOrder.map((idx) => {
              const p = board[idx];
              const r = idx + 1;
              const cls = r === 1 ? "r1" : r === 2 ? "r2" : "r3";
              return (
                <div className={`p3c ${cls}${p.isMe ? " me" : ""}`} key={p.id}>
                  {r === 1 ? <span className="crown">👑</span> : <span className="crown" style={{ visibility: "hidden" }}>·</span>}
                  <div
                    className={`av3${groupBy === "person" ? " av-click" : ""}`}
                    onClick={groupBy === "person" ? () => onOpenProfile(p.id) : undefined}
                  >
                    <Avatar name={p.name} url={p.avatarUrl} size={54} />
                    <span className="rkb">#{r}</span>
                  </div>
                  <div className="pn">{p.isMe ? "Bạn" : p.name}</div>
                  <div className="pa tnum">{shortFmt(p.value, metric)}</div>
                  <div className="bar3" />
                </div>
              );
            })}
          </div>

          <div className="lb-div" />

          {me ? (
            meIdx === 0 ? (
              <>
                <div className="gap-pill"><span>🏆 Bạn đang dẫn đầu — giữ vững nhé!</span></div>
                <div className="rankup">
                  <div className="ru-top"><b>Vị trí của bạn</b><span className="ru-pct">#1</span></div>
                  <div className="rubar"><span style={{ width: "100%" }} /></div>
                  <div className="ru-legend"><span className="you">Bạn · {fullFmt(me.value, metric)}</span><span className="nxt">Đang dẫn đầu 🎉</span></div>
                </div>
              </>
            ) : (
              <>
                <div className="gap-pill"><span>▲ Chỉ còn {fullFmt(above!.value - me.value, metric)} nữa lên #{meIdx}</span></div>
                <div className="rankup">
                  <div className="ru-top"><b>Tiến độ thăng hạng</b><span className="ru-pct">{Math.round((me.value / (above!.value || 1)) * 100)}%</span></div>
                  <div className="rubar"><span style={{ width: `${Math.min(100, Math.round((me.value / (above!.value || 1)) * 100))}%` }} /></div>
                  <div className="ru-legend"><span className="you">Bạn · {fullFmt(me.value, metric)}</span><span className="nxt">{above!.name} · {fullFmt(above!.value, metric)}</span></div>
                </div>
              </>
            )
          ) : (
            <div className="gap-pill"><span>{metric === "money" ? "Bạn chưa có hoạt động trong kỳ này" : "Bạn chưa có hoạt động môn này trong kỳ này"}</span></div>
          )}
        </div>

        {/* CỘT PHẢI — bảng chi tiết cuộn nội bộ */}
        <div className="card lb-right" ref={rightRef}>
          <div className="lh">
            <div className="t">🏆 <span>{groupBy === "team" ? "Xếp hạng phòng ban" : "Xếp hạng cá nhân"}</span></div>
            <div className="u">Cập nhật vừa xong</div>
          </div>
          <div className="lb-scroll">
            {board.length === 0 ? (
              <div className="feed-empty">Chưa có dữ liệu trong khoảng ngày này.</div>
            ) : (
              board.map((p) => (
                <div className={`row${p.isMe ? " me2" : ""}`} key={p.id}>
                  <div className="rk">{p.rank <= 3 ? <span className="md">{["🥇", "🥈", "🥉"][p.rank - 1]}</span> : p.rank}</div>
                  {groupBy === "person" ? (
                    <span className="av-click" onClick={() => onOpenProfile(p.id)}>
                      <Avatar name={p.name} url={p.avatarUrl} size={40} />
                    </span>
                  ) : (
                    <Avatar name={p.name} url={p.avatarUrl} size={40} />
                  )}
                  <div>
                    <div className="nm2">{p.isMe ? "Bạn" : p.name}{p.isMe && <span className="youtag">YOU</span>}</div>
                    <div className="sub2">{p.sub}</div>
                  </div>
                  <div className="right">
                    <div className="amt">{fullFmt(p.value, metric)}</div>
                    {deltaEl(p.delta)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
