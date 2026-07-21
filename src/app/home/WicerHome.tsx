"use client";

import { useEffect, useState } from "react";
import Passport, { type PassportMe } from "./Passport";
import Avatar from "../Avatar";
import GiveThanksModal from "../withanks/GiveThanksModal";
import SubmitActivity from "../me/SubmitActivity";
import CardCollectionModal from "./CardCollectionModal";
import Modal from "@/components/ui/Modal";

interface Ring { pct: number; done: boolean; kmLeft: number; target: number }
interface Rings { move: Ring; thanks: { done: boolean }; grow: { done: boolean; hidden: boolean } }
interface Me extends PassportMe {
  rings: Rings;
  collection: { count: number; total: number; recent: { emoji: string; rarity: string; category: string }[] };
}
interface Thx { id: string; khoai: number; message: string; giver: string; avatarUrl: string | null }
interface CardT { drawn: boolean; emoji?: string; message?: string; category?: string; rarity?: string; rewardKhoai?: number }
interface HomeData {
  me: Me;
  today: { newThanks: Thx[]; celebrate: { anniversary: number | null; birthday: boolean }; card: CardT };
  ritual: { thankedToday: boolean; movedToday: boolean; ideaToday: boolean };
  nudges: { givingRemaining: number | null; givingResetsWeekly: boolean; pendingRedemptions: number; activeGoals: number };
  pulse: {
    birthdaysWeek: { id: string; name: string; avatarUrl: string | null }[];
    annivWeek: { id: string; name: string; avatarUrl: string | null; years: number }[];
    newMembers: { id: string; name: string; avatarUrl: string | null; team: string }[];
    activeToday: { id: string; name: string; avatarUrl: string | null }[];
    honor: { topThanks: { name: string; total: number } | null; topMove: { name: string; km: number } | null; idea: string | null };
  };
}

const RARITY_VI: Record<string, string> = { common: "Thường", rare: "Hiếm ✦", legendary: "Huyền thoại 🌟" };
const CULTURE_LINES = [
  "Điều nhỏ tạo nên văn hoá lớn.",
  "Khoẻ cho mình · Sẻ chia cho cộng đồng.",
  "Ghi nhận từ những điều nhỏ nhất.",
  "Học tập & cải tiến không ngừng.",
];

function greetWord() {
  const h = new Date().getHours();
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function WicerHome() {
  const [d, setD] = useState<HomeData | null>(null);
  const [giving, setGiving] = useState<null | { unlimited: boolean; canGiveNow: number | null; perPersonDay: number | null; weekRemaining: number | null; monthRemaining: number | null }>(null);
  const [card, setCard] = useState<CardT | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showColl, setShowColl] = useState(false);

  const load = () => fetch("/api/wicer-home", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((data: HomeData | null) => {
    setD(data);
    if (data) setCard(data.today.card);
  });
  useEffect(() => { load(); }, []);

  const openGive = async () => {
    const j = await fetch("/api/withanks", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
    if (j?.me?.allowance) setGiving(j.me.allowance);
  };
  const flipCard = async () => {
    if (flipping) return;
    setFlipping(true);
    const j = await fetch("/api/wicer-home/card", { method: "POST" }).then((r) => (r.ok ? r.json() : null));
    setFlipping(false);
    if (j?.card) { setCard({ drawn: true, ...j.card }); load(); }
  };
  const flipFromCollection = async () => {
    if (!card?.drawn) await flipCard();
    setShowCard(true);
  };

  if (!d) return <div className="wrap"><div className="act-empty" style={{ display: "block" }}>Đang tải Wicer Home…</div></div>;

  const me = d.me;
  const line = CULTURE_LINES[new Date().getDate() % CULTURE_LINES.length];
  const dateStr = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const hasThanks = d.today.newThanks.length > 0;
  const ritualDone = [d.ritual.thankedToday, d.ritual.movedToday].filter(Boolean).length;

  return (
    <div className="wrap wh-wrap">
      <div className="wh-grid">
        {/* ───────── CỘT TRÁI ───────── */}
        <aside className="wh-left">
          <Passport me={me} />

          {/* Vòng tròn tuần */}
          <div className="card wh-rings">
            <div className="wh-rings-head">
              <div className="wh-rings-t">🔵 Vòng tròn tuần này</div>
              <span className="wh-streak">🔥 {me.streakWeeks} tuần liên tiếp</span>
            </div>
            <div className="wh-dials">
              <Dial rc="#22b07d" pct={me.rings.move.pct} icon="💪" label={me.rings.move.done ? "Move · ✓" : `Move · ${me.rings.move.pct}%`} />
              <Dial rc="#e0a500" pct={me.rings.thanks.done ? 100 : 0} icon="🥔" label={me.rings.thanks.done ? "Thanks · ✓" : "Thanks · 0%"} />
              <Dial rc="#0070FA" pct={me.rings.grow.done ? 100 : 0} icon="💡" label="WiGrow · sắp có" dim />
            </div>
            <div className="wh-rings-hint">
              {me.rings.move.done && me.rings.thanks.done
                ? "🎉 Bạn đã khép các vòng tuần này — quá tuyệt!"
                : me.rings.move.kmLeft > 0
                  ? `🔵 Còn ${me.rings.move.kmLeft}km nữa là khép vòng Move tuần này.`
                  : "🔵 Tặng 1 khoai để khép vòng Thanks tuần này."}
            </div>
          </div>

          {/* Bộ sưu tập thẻ */}
          <div className="card wh-coll">
            <div className="wh-coll-head"><b>🎴 Bộ sưu tập thẻ</b><small className="tnum">{me.collection.count} / {me.collection.total}</small></div>
            <div className="wh-gallery">
              {Array.from({ length: 5 }).map((_, i) => {
                const c = me.collection.recent[i];
                return <span key={i} className={`wh-gcard${c ? (c.rarity === "legendary" || c.rarity === "rare" ? " rare" : "") : " empty"}`}>{c?.emoji ?? ""}</span>;
              })}
            </div>
            {card?.drawn ? (
              <button className="wh-coll-cta" onClick={() => setShowCard(true)}>🎴 Xem thẻ hôm nay: {card.emoji} →</button>
            ) : (
              <button className="wh-coll-cta" onClick={flipFromCollection} disabled={flipping}>🎁 {flipping ? "Đang lật…" : "Lật thẻ cảm hứng hôm nay →"}</button>
            )}
            <button className="wh-coll-all" onClick={() => setShowColl(true)}>📚 Xem tất cả {me.collection.count} thẻ của tôi →</button>
          </div>
        </aside>

        {/* ───────── CỘT PHẢI ───────── */}
        <div className="wh-right">
          {/* ① Chào */}
          <div className="wh-greet">
            <h2>{greetWord()}, {me.name.split(" ").slice(-1)[0]} 👋</h2>
            <p>“{line}” · {dateStr}</p>
          </div>

          {/* ② Cho tôi hôm nay */}
          <div className="card wh-hero">
            <h3 className="wh-h3">🎁 Cho tôi hôm nay</h3>
            {hasThanks ? (
              <>
                <p className="sub">Bạn có lời cảm ơn mới — mở ra xem nhé!</p>
                <div className="wh-thanks">
                  {d.today.newThanks.map((t) => (
                    <div className="wh-thx" key={t.id}>
                      <Avatar name={t.giver} url={t.avatarUrl} size={38} />
                      <div className="wh-thx-body">
                        <div className="wh-thx-h"><b>{t.giver}</b> cảm ơn bạn <span className="wh-k tnum">+{t.khoai}🥔</span></div>
                        <div className="wh-thx-msg">{t.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="sub">Hôm nay chưa có lời cảm ơn mới — nhưng luôn có một điều tích cực dành cho bạn 🌿</p>
                <WicerCardStage card={card} flipping={flipping} onFlip={flipCard} />
              </>
            )}

            {(d.today.celebrate.anniversary || d.today.celebrate.birthday) && (
              <div className="wh-celebrate">
                {d.today.celebrate.birthday && <>🎂 Chúc mừng sinh nhật bạn hôm nay! </>}
                {d.today.celebrate.anniversary && <>🎉 Hôm nay tròn <b>{d.today.celebrate.anniversary} năm</b> bạn gia nhập Wicom!</>}
              </div>
            )}
          </div>

          {/* ③ Nghi thức 2 phút */}
          <div className="card wh-ritual">
            <h3 className="wh-h3">⚡ Nghi thức 2 phút</h3>
            <p className="sub">Vài việc siêu nhanh, xong là nhích vòng tròn.</p>
            <div className="wh-rit-row">
              <button className={`wh-rit${d.ritual.thankedToday ? " done" : ""}`} onClick={openGive}>
                <span className="k">🥔 Cảm ơn 1 người</span>
                <span className="s">{d.ritual.thankedToday ? "Đã cảm ơn hôm nay ✓" : "Gửi lời cảm ơn ngay"}</span>
              </button>
              <div className={`wh-rit${d.ritual.movedToday ? " done" : ""}`}>
                <span className="k">💪 Ghi nhận vận động</span>
                <span className="s">{d.ritual.movedToday ? "Đã có hoạt động hôm nay ✓" : <SubmitActivity onDone={load} />}</span>
              </div>
              <div className="wh-rit dim">
                <span className="k">💡 Thả 1 ý tưởng</span>
                <span className="s">WiGrow · sắp ra mắt</span>
              </div>
            </div>
            <div className="wh-rit-prog">Hôm nay: <b>{ritualDone}/2</b> {ritualDone === 2 ? "✓ hoàn thành" : ""}</div>
          </div>

          {/* ⑤ Việc cần làm */}
          <div className="card wh-todo">
            <h3 className="wh-h3">✅ Việc cần làm của tôi</h3>
            <ul className="wh-todo-list">
              {d.nudges.givingRemaining != null && d.nudges.givingRemaining > 0 && (
                <li><span className="dot" style={{ background: "#e0a500" }} /> Bạn còn <b>{d.nudges.givingRemaining} 🥔</b> để tặng{d.nudges.givingResetsWeekly ? " — reset cuối tuần này" : ""} <button className="wh-go" onClick={openGive}>Tặng ngay →</button></li>
              )}
              {d.nudges.pendingRedemptions > 0 && (
                <li><span className="dot" style={{ background: "#33A3DC" }} /> {d.nudges.pendingRedemptions} đơn đổi quà đang chờ HR duyệt</li>
              )}
              {d.nudges.activeGoals > 0 && (
                <li><span className="dot" style={{ background: "#22b07d" }} /> Bạn đang theo <b>{d.nudges.activeGoals} mục tiêu</b> cá nhân</li>
              )}
              {(d.nudges.givingRemaining ?? 0) === 0 && d.nudges.pendingRedemptions === 0 && d.nudges.activeGoals === 0 && (
                <li className="wh-todo-empty">🎉 Không có việc gì cần làm — bạn đang rất ổn!</li>
              )}
            </ul>
          </div>

          {/* ⑥ Nhịp công ty */}
          <div className="card wh-pulse">
            <h3 className="wh-h3">🫶 Nhịp công ty</h3>
            <div className="wh-pulse-grid">
              <PulseCell title="🎂 Sinh nhật tuần này" people={d.pulse.birthdaysWeek} empty="Không có sinh nhật tuần này" action={d.pulse.birthdaysWeek.length ? "Gửi lời chúc + 🥔 →" : undefined} onAction={openGive} />
              <PulseCell title="🏃 Đang khoẻ cùng bạn" people={d.pulse.activeToday} empty="Chưa ai vận động hôm nay" action={d.pulse.activeToday.length ? `${d.pulse.activeToday.length} người đã vận động hôm nay` : undefined} />
              <PulseCell title="🎉 Kỷ niệm ngày vào công ty" people={d.pulse.annivWeek} empty="Không có kỷ niệm tuần này" action={d.pulse.annivWeek.length ? `Chúc mừng thâm niên 🥔 →` : undefined} onAction={openGive} />
              <div className="wh-pcell">
                <div className="wh-pcell-h">🏆 Vinh danh tuần</div>
                <div className="wh-honor">
                  <span>🥔 Được cảm ơn nhất: <b>{d.pulse.honor.topThanks?.name ?? "—"}</b>{d.pulse.honor.topThanks ? ` (${d.pulse.honor.topThanks.total}🥔)` : ""}</span>
                  <span>💪 Quán quân Move: <b>{d.pulse.honor.topMove?.name ?? "—"}</b>{d.pulse.honor.topMove ? ` (${d.pulse.honor.topMove.km}km)` : ""}</span>
                  <span>💡 Ý tưởng tuần: <b>WiGrow sắp ra mắt</b></span>
                </div>
              </div>
            </div>
            {d.pulse.newMembers.length > 0 && (
              <div className="wh-newmem">👋 Thành viên mới: {d.pulse.newMembers.map((m) => `${m.name} (${m.team})`).join(" · ")}</div>
            )}
          </div>

          {/* ⑦ Tiện ích nhanh */}
          <div className="card wh-util">
            <h3 className="wh-h3">🧰 Tiện ích nhanh <span className="wh-soon">phần lớn sắp ra mắt</span></h3>
            <div className="wh-util-grid">
              <div className="wh-ut"><div className="n">—</div><small>📅 Ngày phép</small></div>
              <div className="wh-ut"><div className="n">💰</div><small>Bảng lương</small></div>
              <div className="wh-ut"><div className="n">🎁</div><small>Phúc lợi</small></div>
              <div className="wh-ut"><div className="n">🎓</div><small>Học tập</small></div>
            </div>
            <div className="wh-aibox">✨ Wicer AI: “Tôi còn bao nhiêu ngày phép?” — sắp ra mắt</div>
          </div>
        </div>
      </div>

      {giving && <GiveThanksModal allowance={giving} onClose={() => setGiving(null)} onDone={load} />}

      {showColl && <CardCollectionModal onClose={() => setShowColl(false)} />}

      {showCard && card?.drawn && (
        <Modal onClose={() => setShowCard(false)} panelClassName="wh-card-modal">
            <h3 style={{ margin: "0 0 12px" }}>🎴 Wicer Card hôm nay</h3>
            <div className={`wh-wc-front rarity-${card.rarity}`}>
              {card.rarity !== "common" && <span className="wh-wc-rare">{card.rarity === "legendary" ? "HUYỀN THOẠI 🌟" : "HIẾM ✦"}</span>}
              <div className="wh-wc-emoji">{card.emoji}</div>
              <div className="wh-wc-msg">“{card.message}”</div>
              <div className="wh-wc-foot">
                <span className="wh-wc-cat">#{card.category}</span>
                {card.rewardKhoai ? <span className="wh-wc-reward tnum">+{card.rewardKhoai} 🥔 · đã thêm vào bộ sưu tập</span> : <span className="wh-wc-reward">đã thêm vào bộ sưu tập</span>}
              </div>
            </div>
            <p className="sub" style={{ marginTop: 12, textAlign: "center" }}>Mỗi ngày một lá — quay lại mai để lật lá mới nhé!</p>
        </Modal>
      )}
    </div>
  );
}

function Dial({ rc, pct, icon, label, dim }: { rc: string; pct: number; icon: string; label: string; dim?: boolean }) {
  return (
    <div className={`wh-dial${dim ? " dim" : ""}`}>
      <div className="wh-d" style={{ background: `conic-gradient(${rc} ${pct}%, var(--surface-2) 0)` }}><span>{icon}</span></div>
      <small>{label}</small>
    </div>
  );
}

function WicerCardStage({ card, flipping, onFlip }: { card: CardT | null; flipping: boolean; onFlip: () => void }) {
  const drawn = card?.drawn;
  return (
    <div className="wh-wc-stage">
      {!drawn ? (
        <button className="wh-wc-back" onClick={onFlip} disabled={flipping}>
          <div className="wl">🎴</div>
          <b>Wicer Card</b>
          <small>{flipping ? "Đang lật…" : "Lật thẻ hôm nay"}<br />1 lá / ngày</small>
        </button>
      ) : (
        <div className={`wh-wc-front rarity-${card!.rarity}`}>
          {card!.rarity !== "common" && <span className="wh-wc-rare">{card!.rarity === "legendary" ? "HUYỀN THOẠI 🌟" : "HIẾM ✦"}</span>}
          <div className="wh-wc-emoji">{card!.emoji}</div>
          <div className="wh-wc-msg">“{card!.message}”</div>
          <div className="wh-wc-foot">
            <span className="wh-wc-cat">#{card!.category}</span>
            {card!.rewardKhoai ? <span className="wh-wc-reward tnum">+{card!.rewardKhoai} 🥔 · đã thêm vào bộ sưu tập</span> : <span className="wh-wc-reward">đã thêm vào bộ sưu tập</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PulseCell({ title, people, empty, action, onAction }: {
  title: string; people: { id: string; name: string; avatarUrl: string | null }[]; empty: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="wh-pcell">
      <div className="wh-pcell-h">{title}</div>
      {people.length > 0 ? (
        <div className="wh-avrow">{people.slice(0, 4).map((p) => <Avatar key={p.id} name={p.name} url={p.avatarUrl} size={26} />)}{people.length > 4 && <span className="wh-more">+{people.length - 4}</span>}</div>
      ) : (
        <div className="wh-pcell-empty">{empty}</div>
      )}
      {action && (onAction ? <button className="wh-pcell-act" onClick={onAction}>{action}</button> : <div className="wh-pcell-act as-text">{action}</div>)}
    </div>
  );
}
