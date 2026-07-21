"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "../Avatar";
import Modal from "@/components/ui/Modal";
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
interface Member { id: string; name: string; avatarUrl: string | null; team: string | null }

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
  const [members, setMembers] = useState<Member[]>([]);
  const [view, setView] = useState<"board" | "kudos">("board");
  const [refreshing, setRefreshing] = useState(false);
  const [giving, setGiving] = useState(false);
  const [giveTo, setGiveTo] = useState<Member | null>(null);
  const [person, setPerson] = useState<BoardPerson | null>(null);
  const [kudo, setKudo] = useState<FeedItem | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [rankTab, setRankTab] = useState<"give" | "loved" | "receive">("give");
  const [feedTab, setFeedTab] = useState<"all" | "super" | "special">("all");
  const [hearts, setHearts] = useState<Record<string, { hearted: boolean; count: number }>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/withanks", { cache: "no-store" });
      if (r.ok) setD(await r.json());
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Danh sách nhân sự để phủ kín bảng vinh danh bằng avatar mờ (bấm để cảm ơn).
  useEffect(() => {
    fetch("/api/withanks/members", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((j) => setMembers(j.members ?? []));
  }, []);

  const vmap = useMemo(() => Object.fromEntries((d?.valueTags ?? []).map((v) => [v.key, v])), [d]);
  const heartOf = (t: { id: string; hearted: boolean; heartCount: number }) => hearts[t.id] ?? { hearted: t.hearted, count: t.heartCount };
  const toggleHeart = async (id: string) => {
    const res = await fetch("/api/withanks/heart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thanksId: id }) });
    if (res.ok) { const j = await res.json(); setHearts((h) => ({ ...h, [id]: { hearted: j.hearted, count: j.count } })); }
  };

  const me = d?.me;
  const al = me?.allowance;

  // Bảng vinh danh (view "board"): người đã được cảm ơn + avatar mờ của người chưa,
  // để bảng luôn "đầy" và ai cũng bấm gửi cảm ơn được.
  const receivers = d ? d.board.slice(0, 15) : [];
  const boardIds = useMemo(() => new Set(receivers.map((p) => p.id)), [receivers]);
  const TARGET_TILES = 25;
  const fadedMembers = useMemo(
    () => members.filter((m) => !boardIds.has(m.id) && m.id !== me?.id).slice(0, Math.max(0, TARGET_TILES - receivers.length)),
    [members, boardIds, me?.id, receivers.length],
  );

  const openGiveTo = (m: Member) => { setGiveTo(m); setGiving(true); };
  const openGive = () => { setGiveTo(null); setGiving(true); };

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
          <button className="wt-give-btn2" onClick={openGive}><span className="ic">💌</span> Gửi lời cảm ơn</button>
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

      {/* ── Bảng vinh danh + cột phải ── */}
      <div className="wt-grid2">
        <div className="wt-kboard">
          <div className="wt-kb-head">
            <b>🏆 Kudos Board</b>
            <button className={`wt-kb-refresh${refreshing ? " spinning" : ""}`} onClick={load} disabled={refreshing} title="Tải lời cảm ơn mới nhất">
              <span className="wt-kb-rico">↻</span> {refreshing ? "Đang tải…" : "Làm mới"}
            </button>
            <div className="seg wt-kb-seg">
              <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>◉ Người</button>
              <button className={view === "kudos" ? "active" : ""} onClick={() => setView("kudos")}>💬 Kudos</button>
            </div>
          </div>

          {!d ? (
            <div className="wt-kb-empty">Đang tải…</div>
          ) : view === "board" ? (
            <div className="wt-kb-people">
              {receivers.map((p) => {
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
              {fadedMembers.map((m) => (
                <button className="wt-kp faded" key={m.id} onClick={() => openGiveTo(m)} title={`Gửi lời cảm ơn tới ${m.name}`}>
                  <div className="wt-kp-av">
                    <Avatar name={m.name} url={m.avatarUrl} size={54} />
                    <span className="wt-kp-give">💌</span>
                  </div>
                  <small>{lastName(m.name)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="wt-kudos">
              {d.feed.length ? d.feed.slice(0, 20).map((t) => (
                <button className={`wt-kudo${t.kind !== "thanks" ? " " + t.kind : ""}`} key={t.id} onClick={() => setKudo(t)} title={`${lastName(t.sender.name)} → ${lastName(t.receiver.name)} · xem đầy đủ`}>
                  <div className="wt-kudo-top">
                    <div className="wt-kudo-avs">
                      <span className="wt-kudo-av s"><Avatar name={t.sender.name} url={t.sender.avatarUrl} size={26} /></span>
                      <span className="wt-kudo-av r"><Avatar name={t.receiver.name} url={t.receiver.avatarUrl} size={26} /></span>
                    </div>
                    <span className="wt-kudo-k tnum">{KIND_BADGE[t.kind] ? `${KIND_BADGE[t.kind]} ` : ""}+{t.khoai}🥔</span>
                  </div>
                  <div className="wt-kudo-msg">{t.message}</div>
                </button>
              )) : <div className="wt-kb-empty">Chưa có lời cảm ơn nào. Hãy là người mở đầu! 💌</div>}
            </div>
          )}
        </div>

        {/* CỘT PHẢI */}
        <div className="wt-right">
          <div className="card wt-card">
            <div className="wt-card-h">🌻 Người gieo khoai <span className="q">quý này</span>
              <button className="wt-card-more" onClick={() => { setRankTab("give"); setRankOpen(true); }}>Xem bảng →</button>
            </div>
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
        <Modal onClose={() => setPerson(null)} panelClassName="wt-person">
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
          <button className="wtp-give" onClick={() => { const p = person; setPerson(null); openGiveTo({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, team: p.team }); }}>💌 Gửi lời cảm ơn tới {lastName(person.name)}</button>
        </Modal>
      )}

      {/* Kudos chi tiết */}
      {kudo && (
        <Modal onClose={() => setKudo(null)} panelClassName="wt-kudomodal">
          <div className={`wt-kudomodal-top${kudo.kind !== "thanks" ? " " + kudo.kind : ""}`}>
            <div className="wt-kudo-avs big">
              <span className="wt-kudo-av s"><Avatar name={kudo.sender.name} url={kudo.sender.avatarUrl} size={56} /></span>
              <span className="wt-kudo-av r"><Avatar name={kudo.receiver.name} url={kudo.receiver.avatarUrl} size={56} /></span>
            </div>
            <div className="wt-kudomodal-nm"><b>{lastName(kudo.sender.name)}</b> gửi tới <b>{lastName(kudo.receiver.name)}</b></div>
            <div className="wt-kudomodal-badge">{KIND_BADGE[kudo.kind] ? `${KIND_BADGE[kudo.kind]} ` : ""}+{kudo.khoai} 🥔 · {relTime(kudo.createdAt)}</div>
          </div>
          <div className="wt-kudomodal-msg">“{kudo.message}”</div>
          <div className="wt-kudomodal-foot">
            <VTags keys={kudo.valueTags} />
            {(() => { const h = heartOf(kudo); return (
              <button className={`wt-heart${h.hearted ? " on" : ""}`} onClick={() => toggleHeart(kudo.id)}>{h.hearted ? "❤️" : "🤍"} {h.count > 0 ? h.count : ""}</button>
            ); })()}
          </div>
        </Modal>
      )}

      {/* Popup "Xem bảng" — xếp hạng 3 tab */}
      {rankOpen && d && (
        <Modal onClose={() => setRankOpen(false)} panelClassName="wt-rankmodal">
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
        </Modal>
      )}

      {/* Popup "Tất cả lời cảm ơn" */}
      {feedOpen && d && (
        <Modal onClose={() => setFeedOpen(false)} panelClassName="wt-feedmodal">
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
        </Modal>
      )}

      {giving && d && al && (
        <GiveThanksModal
          allowance={al}
          balance={me!.balance}
          eligibility={me!.eligibility}
          valueTags={d.valueTags}
          initialReceiver={giveTo}
          onClose={() => { setGiving(false); setGiveTo(null); }}
          onDone={load}
        />
      )}
    </div>
  );
}
