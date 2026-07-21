"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "../Avatar";
import GiveThanksModal from "./GiveThanksModal";
import RewardsSection from "./RewardsSection";

interface Allowance { unlimited: boolean; role: string; weekLimit: number | null; monthLimit: number | null; weekRemaining: number | null; monthRemaining: number | null; canGiveNow: number | null; perPersonDay: number | null }
interface Eligibility { canSuper: boolean; superUsed: number; canSpecial: boolean; specialUsed: number; tenureDays: number; specialCost: number; specialTenureDays: number }
interface ValueTag { key: string; label: string; emoji: string }
interface Thx { id: string; senderName: string; senderAvatar: string | null; khoai: number; kind: string; valueTags: string[]; heartCount: number; message: string; createdAt: string }
interface BoardPerson { id: string; name: string; avatarUrl: string | null; team: string; totalReceived: number; count: number; quarterCount: number; lastAt: string; thanks: Thx[] }
interface FeedItem { id: string; khoai: number; kind: string; valueTags: string[]; heartCount: number; hearted: boolean; createdAt: string; anonymous: boolean; message: string; sender: { id: string | null; name: string; avatarUrl: string | null }; receiver: { id: string; name: string; avatarUrl: string | null; team: string } }
interface GiveRank { id: string; name: string; avatarUrl: string | null; given: number; rank: number; isMe: boolean }
interface Rank { id: string; name: string; avatarUrl: string | null; team: string; total: number; rank: number; isMe: boolean }
interface Me { id: string; name: string; avatarUrl: string | null; balance: number; allowance: Allowance; eligibility: Eligibility; myRank: { rank: number | null; total: number } }
interface Data { me: Me; valueTags: ValueTag[]; board: BoardPerson[]; givingBoard: GiveRank[]; feed: FeedItem[]; lovedThanks: FeedItem[]; rankings: Rank[] }

const KIND_BADGE: Record<string, string> = { super: "💜", special: "🎁" };

function relTime(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} giờ`;
  return `${Math.round(h / 24)} ngày`;
}
const lastName = (n: string) => n.split(" ").slice(-2).join(" ");

export default function WiThanks() {
  const [d, setD] = useState<Data | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [giving, setGiving] = useState(false);
  const [person, setPerson] = useState<BoardPerson | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [rankTab, setRankTab] = useState<"give" | "loved" | "receive">("give");
  const [feedTab, setFeedTab] = useState<"all" | "super" | "special">("all");
  const [hearts, setHearts] = useState<Record<string, { hearted: boolean; count: number }>>({});

  const load = () => fetch("/api/withanks", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setD);
  useEffect(() => { load(); }, []);

  const vmap = useMemo(() => Object.fromEntries((d?.valueTags ?? []).map((v) => [v.key, v])), [d]);
  const heartOf = (t: { id: string; hearted: boolean; heartCount: number }) => hearts[t.id] ?? { hearted: t.hearted, count: t.heartCount };
  const toggleHeart = async (id: string) => {
    const res = await fetch("/api/withanks/heart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thanksId: id }) });
    if (res.ok) { const j = await res.json(); setHearts((h) => ({ ...h, [id]: { hearted: j.hearted, count: j.count } })); }
  };

  const me = d?.me;
  const al = me?.allowance;

  const people = d ? d.board.slice(0, 16) : [];
  const padTo = Math.max(8, Math.ceil(people.length / 4) * 4);
  const empties = Math.max(0, padTo - people.length);

  const pctW = al && al.weekLimit ? Math.round(((al.weekRemaining ?? 0) / al.weekLimit) * 100) : 0;
  const pctM = al && al.monthLimit ? Math.round(((al.monthRemaining ?? 0) / al.monthLimit) * 100) : 0;

  const VTags = ({ keys }: { keys: string[] }) => keys.length ? (
    <span className="wt-vtags">{keys.map((k) => vmap[k] ? <span className="wt-vtag" key={k}>{vmap[k].emoji} {vmap[k].label}</span> : null)}</span>
  ) : null;

  const feedForTab = d ? d.feed.filter((t) => feedTab === "all" ? true : t.kind === feedTab) : [];

  return (
    <div className="wrap wt-wrap">
      {/* ── Hero ── */}
      <div className="wt-hero2">
        <div className="wt-h-left">
          <div className="wt-bal2">
            <span className="wt-bal-lb2">Ví khoai của tôi</span>
            <b className="tnum">{me ? me.balance : 0} <span className="wt-pot2">🥔</span></b>
            <span className="wt-bal-sub2">để đổi quà & Special Gift</span>
          </div>
          <button className="wt-give-btn2" onClick={() => setGiving(true)}><span className="ic">💌</span> Gửi lời cảm ơn</button>
        </div>
        <div className="wt-wallet2">
          <div className="wt-w-top"><span>🥔 Còn tặng được</span><b className="tnum">{al?.unlimited ? "∞" : al?.canGiveNow ?? 0}</b></div>
          {!al?.unlimited && (
            <>
              {al?.weekLimit != null && (
                <div className="wt-w-bar"><div className="l"><span>Tuần</span><span className="tnum">{al.weekRemaining}/{al.weekLimit}</span></div><div className="track"><i style={{ width: `${pctW}%` }} /></div></div>
              )}
              <div className="wt-w-bar"><div className="l"><span>Tháng</span><span className="tnum">{al?.monthRemaining}/{al?.monthLimit}</span></div><div className="track"><i style={{ width: `${pctM}%` }} /></div></div>
            </>
          )}
        </div>
      </div>

      {/* ── Kudos Board + cột phải ── */}
      <div className="wt-grid2">
        <div className="wt-kboard">
          <div className="wt-kb-head">
            <b>🏆 Bảng vinh danh</b>
            <button className="wt-kb-refresh" onClick={load} title="Tải lời cảm ơn mới nhất">↻ Làm mới</button>
            <div className="seg wt-kb-seg">
              <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>◉ Người</button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>☰ List</button>
            </div>
            <button className="wt-kb-more" onClick={() => { setRankTab("give"); setRankOpen(true); }}>Xem bảng →</button>
          </div>

          {!d ? (
            <div className="wt-kb-empty">Đang tải…</div>
          ) : view === "board" ? (
            <div className="wt-kb-people">
              {people.map((p) => {
                const fresh = Date.now() - new Date(p.lastAt).getTime() < 60 * 60 * 1000;
                const topKind = p.thanks[0]?.kind;
                return (
                  <button className={`wt-kp${fresh ? " fresh" : ""}`} key={p.id} onClick={() => setPerson(p)} title={`${p.name} · ${p.quarterCount} lời cảm ơn quý này`}>
                    <div className="wt-kp-av">
                      <Avatar name={p.name} url={p.avatarUrl} size={54} />
                      {p.quarterCount > 0 && <span className="wt-kp-cnt tnum">{p.quarterCount}</span>}
                      {KIND_BADGE[topKind] && <span className="wt-kp-kind">{KIND_BADGE[topKind]}</span>}
                    </div>
                    <small>{lastName(p.name)}</small>
                    {fresh && <span className="wt-kp-jn">vừa xong</span>}
                  </button>
                );
              })}
              {Array.from({ length: empties }).map((_, i) => (
                <button className="wt-kp empty" key={`e${i}`} onClick={() => setGiving(true)}>
                  <div className="wt-kp-av"><span className="wt-kp-plus">🥔</span></div>
                  <small>{i === 0 ? "Cảm ơn ai đó?" : "—"}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="wt-kb-list">
              {d.feed.slice(0, 10).map((t) => (
                <div className="wt-kli" key={t.id}>
                  <Avatar name={t.sender.name} url={t.sender.avatarUrl} size={26} />
                  <b>{lastName(t.sender.name)}</b><span className="ar">→</span>
                  <Avatar name={t.receiver.name} url={t.receiver.avatarUrl} size={26} /><span className="rc">{lastName(t.receiver.name)}</span>
                  <span className="k">{KIND_BADGE[t.kind] ? `${KIND_BADGE[t.kind]} ` : ""}+{t.khoai}🥔 · {relTime(t.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CỘT PHẢI */}
        <div className="wt-right">
          <div className="card wt-card">
            <div className="wt-card-h">🌻 Người gieo khoai <span className="q">quý này</span></div>
            {d?.givingBoard.length ? d.givingBoard.slice(0, 5).map((g) => (
              <div className={`wt-rk-row${g.isMe ? " me" : ""}`} key={g.id}>
                <span className={`rk${g.rank <= 3 ? " top" : ""}`}>{g.rank}</span>
                <Avatar name={g.name} url={g.avatarUrl} size={26} />
                <span className="nm">{g.isMe ? "Bạn" : lastName(g.name)}</span>
                <span className="give tnum">{g.given} 🥔</span>
              </div>
            )) : <div className="wt-card-empty">Chưa ai cho đi quý này. Hãy là người đầu tiên! 🥔</div>}
          </div>

          <div className="card wt-card">
            <div className="wt-card-h">💬 Lời cảm ơn mới nhất <button className="wt-card-more" onClick={() => { setFeedTab("all"); setFeedOpen(true); }}>Tất cả →</button></div>
            {d?.feed.length ? d.feed.slice(0, 4).map((t) => {
              const h = heartOf(t);
              return (
                <div className="wt-fd-row" key={t.id}>
                  <Avatar name={t.sender.name} url={t.sender.avatarUrl} size={26} />
                  <div className="bd">
                    <div className="mt"><b>{lastName(t.sender.name)}</b> → <b>{lastName(t.receiver.name)}</b> <span className="k">{KIND_BADGE[t.kind] ? `${KIND_BADGE[t.kind]} ` : ""}+{t.khoai}🥔</span> <span className="tm">· {relTime(t.createdAt)}</span></div>
                    <div className="msg">{t.message}</div>
                    <div className="wt-fd-foot">
                      <VTags keys={t.valueTags} />
                      <button className={`wt-heart${h.hearted ? " on" : ""}`} onClick={() => toggleHeart(t.id)}>{h.hearted ? "❤️" : "🤍"} {h.count > 0 ? h.count : ""}</button>
                    </div>
                  </div>
                </div>
              );
            }) : <div className="wt-card-empty">Chưa có lời cảm ơn nào.</div>}
          </div>
        </div>
      </div>

      {/* ── Đổi quà (Individual + Squad + Green Field) ── */}
      <RewardsSection onChange={load} />

      {/* Modal 1 người trên board */}
      {person && (
        <div className="modal-overlay" onClick={() => setPerson(null)}>
          <div className="modal-panel wt-person" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPerson(null)} aria-label="Đóng">✕</button>
            <div className="wtp-head">
              <Avatar name={person.name} url={person.avatarUrl} size={52} />
              <div>
                <div className="wtp-name">{person.name}</div>
                <div className="wtp-sub">{person.team} · {person.quarterCount} lời cảm ơn quý này · {person.totalReceived} 🥔</div>
              </div>
            </div>
            <div className="wtp-thanks">
              {person.thanks.map((t) => (
                <div className="wtp-t" key={t.id}>
                  <div className="wtp-t-head"><b>{KIND_BADGE[t.kind] ? `${KIND_BADGE[t.kind]} ` : ""}{t.senderName}</b> <span className="wtf-k tnum">+{t.khoai}🥔</span> <span className="wtf-time">· {relTime(t.createdAt)}</span>{t.heartCount > 0 && <span className="wtf-heart">❤️ {t.heartCount}</span>}</div>
                  <div className="wtp-t-msg">{t.message}</div>
                  <VTags keys={t.valueTags} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Popup "Xem bảng" — xếp hạng 3 tab */}
      {rankOpen && d && (
        <div className="modal-overlay" onClick={() => setRankOpen(false)}>
          <div className="modal-panel wt-rankmodal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setRankOpen(false)} aria-label="Đóng">✕</button>
            <h3>🏆 Xếp hạng WiThanks</h3>
            <div className="wt-leadtabs">
              <button className={rankTab === "give" ? "on" : ""} onClick={() => setRankTab("give")}>🌻 Cho đi</button>
              <button className={rankTab === "loved" ? "on" : ""} onClick={() => setRankTab("loved")}>❤️ Được yêu thích</button>
              <button className={rankTab === "receive" ? "on" : ""} onClick={() => setRankTab("receive")}>🥔 Nhận</button>
            </div>
            <div className="wt-rankbody">
              {rankTab === "give" && (d.givingBoard.length ? d.givingBoard.map((g) => (
                <div className={`wt-rankrow${g.isMe ? " me" : ""}`} key={g.id}>
                  <span className={`rk${g.rank <= 3 ? " top" : ""}`}>{g.rank <= 3 ? ["🥇", "🥈", "🥉"][g.rank - 1] : g.rank}</span>
                  <Avatar name={g.name} url={g.avatarUrl} size={30} /><span className="nm">{g.isMe ? "Bạn" : g.name}</span>
                  <span className="val">{g.given} 🥔 cho đi</span>
                </div>
              )) : <div className="wt-card-empty">Chưa có dữ liệu quý này.</div>)}
              {rankTab === "receive" && (d.rankings.length ? d.rankings.map((r) => (
                <div className={`wt-rankrow${r.isMe ? " me" : ""}`} key={r.id}>
                  <span className={`rk${r.rank <= 3 ? " top" : ""}`}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                  <Avatar name={r.name} url={r.avatarUrl} size={30} /><span className="nm">{r.isMe ? "Bạn" : r.name} <small>· {r.team}</small></span>
                  <span className="val">{r.total} 🥔</span>
                </div>
              )) : <div className="wt-card-empty">Chưa có dữ liệu.</div>)}
              {rankTab === "loved" && (d.lovedThanks.length ? d.lovedThanks.map((t) => (
                <div className="wt-lovedrow" key={t.id}>
                  <span className="heart">❤️ {t.heartCount}</span>
                  <div className="bd"><div className="mt"><b>{lastName(t.sender.name)}</b> → <b>{lastName(t.receiver.name)}</b> {KIND_BADGE[t.kind] && <span>{KIND_BADGE[t.kind]}</span>}</div><div className="msg">{t.message}</div></div>
                </div>
              )) : <div className="wt-card-empty">Chưa có lời cảm ơn nào được thả tim.</div>)}
            </div>
            <div className="wt-ranknote">🌱 Mặc định <b>“Cho đi”</b> để tôn vinh sự cho đi. Khoai Admin không tính. “Được yêu thích” xếp theo số ❤️.</div>
          </div>
        </div>
      )}

      {/* Popup "Tất cả lời cảm ơn" */}
      {feedOpen && d && (
        <div className="modal-overlay" onClick={() => setFeedOpen(false)}>
          <div className="modal-panel wt-feedmodal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setFeedOpen(false)} aria-label="Đóng">✕</button>
            <h3>💬 Tất cả lời cảm ơn</h3>
            <div className="wt-leadtabs">
              <button className={feedTab === "all" ? "on" : ""} onClick={() => setFeedTab("all")}>Tất cả</button>
              <button className={feedTab === "super" ? "on" : ""} onClick={() => setFeedTab("super")}>💜 Super</button>
              <button className={feedTab === "special" ? "on" : ""} onClick={() => setFeedTab("special")}>🎁 Special</button>
            </div>
            <div className="wt-feedbody">
              {feedForTab.length ? feedForTab.map((t) => {
                const h = heartOf(t);
                return (
                  <div className={`wt-fcard${t.kind !== "thanks" ? " " + t.kind : ""}`} key={t.id}>
                    <div className="hd">
                      {KIND_BADGE[t.kind] && <span className={`kbadge ${t.kind}`}>{t.kind === "super" ? "SUPER 💜" : "SPECIAL 🎁"}</span>}
                      <Avatar name={t.sender.name} url={t.sender.avatarUrl} size={24} /><b>{lastName(t.sender.name)}</b>→<Avatar name={t.receiver.name} url={t.receiver.avatarUrl} size={24} /><b>{lastName(t.receiver.name)}</b>
                      <span className="k tnum">{t.khoai}🥔</span>
                    </div>
                    <div className="msg">{t.message}</div>
                    <div className="wt-fd-foot">
                      <VTags keys={t.valueTags} />
                      <span className="tm">{relTime(t.createdAt)}</span>
                      <button className={`wt-heart${h.hearted ? " on" : ""}`} onClick={() => toggleHeart(t.id)}>{h.hearted ? "❤️" : "🤍"} {h.count > 0 ? h.count : ""}</button>
                    </div>
                  </div>
                );
              }) : <div className="wt-card-empty">Chưa có lời cảm ơn nào.</div>}
            </div>
          </div>
        </div>
      )}

      {giving && d && al && (
        <GiveThanksModal
          allowance={al}
          balance={me!.balance}
          eligibility={me!.eligibility}
          valueTags={d.valueTags}
          onClose={() => setGiving(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
