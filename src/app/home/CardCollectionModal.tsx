"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

interface Card {
  cardId: string; emoji: string; message: string; category: string; background: string | null; rarity: string; rewardKhoai: number;
  owned: boolean; copies: number; favorite: boolean; firstISO: string | null;
}
interface Stats {
  collected: number; total: number; khoaiFromCards: number; favorites: number; removed: number;
  legendary: { c: number; t: number }; rare: { c: number; t: number }; common: { c: number; t: number };
}
interface CollData { stats: Stats; cards: Card[]; bin: Card[] }

const RARITY_LABEL: Record<string, string> = { legendary: "HUYỀN THOẠI", rare: "HIẾM", common: "THƯỜNG" };

// Nền thẻ: URL ảnh (/uploads… hoặc http) → ảnh phủ; ngược lại coi là chuỗi CSS màu/gradient.
export function bgStyle(bg: string | null): React.CSSProperties | undefined {
  if (!bg) return undefined;
  if (bg.startsWith("/") || bg.startsWith("http")) return { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" };
  return { background: bg };
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function CardCollectionModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<CollData | null>(null);
  const [showBin, setShowBin] = useState(false);

  const load = () => fetch("/api/wicer-home/collection", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setData);
  useEffect(() => {
    load();
  }, []);

  const act = (cardId: string, action: "fav" | "remove" | "restore") =>
    fetch("/api/wicer-home/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, action }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) load(); })
      .catch(() => {});

  const toggleFav = (cardId: string) => {
    setData((d) => d && { ...d, cards: d.cards.map((c) => (c.cardId === cardId ? { ...c, favorite: !c.favorite } : c)) });
    act(cardId, "fav");
  };
  const removeCard = (cardId: string) => { if (confirm("Bỏ thẻ này khỏi bộ sưu tập của bạn? (có thể khôi phục ở thùng rác)")) act(cardId, "remove"); };
  const restoreCard = (cardId: string) => act(cardId, "restore");

  const cards = data?.cards ?? [];
  const bin = data?.bin ?? [];
  const s = data?.stats;
  const pct = s && s.total > 0 ? Math.round((s.collected / s.total) * 100) : 0;
  const favorites = cards.filter((c) => c.owned && c.favorite);
  const byRarity = (r: string) => cards.filter((c) => c.rarity === r);

  return (
    <Modal onClose={onClose} panelClassName="cc-modal" className="cc-overlay">
        {/* Hero */}
        <div className="cc-hero">
          <div className="cc-hero-glow" />
          <div className="cc-hero-in">
            <div className="cc-hero-l">
              <div className="cc-kicker">BỘ SƯU TẬP</div>
              <h2>🎴 Wicer Card của tôi</h2>
              <p>Mỗi ngày một lá cảm hứng. Sưu tầm đủ bộ và ghim lại những lá ý nghĩa nhất với bạn ⭐</p>
            </div>
            <div className="cc-ring" style={{ ["--p" as string]: `${pct}` }}>
              <div className="cc-ring-in"><b className="tnum">{s?.collected ?? 0}<i>/{s?.total ?? 0}</i></b><small>đã sưu tầm</small></div>
            </div>
          </div>
          <div className="cc-chips">
            <span className="cc-chip leg">🌟 Huyền thoại <b className="tnum">{s?.legendary.c ?? 0}/{s?.legendary.t ?? 0}</b></span>
            <span className="cc-chip rare">✦ Hiếm <b className="tnum">{s?.rare.c ?? 0}/{s?.rare.t ?? 0}</b></span>
            <span className="cc-chip common">🌿 Thường <b className="tnum">{s?.common.c ?? 0}/{s?.common.t ?? 0}</b></span>
            <span className="cc-chip khoai">🥔 Khoai từ thẻ <b className="tnum">{s?.khoaiFromCards ?? 0}</b></span>
          </div>
        </div>

        {!data ? (
          <div className="act-empty" style={{ display: "block" }}>Đang mở bộ sưu tập…</div>
        ) : (
          <div className="cc-body">
            {favorites.length > 0 && (
              <Section title="⭐ Thẻ ý nghĩa nhất với tôi" sub="Những lá bạn đã ghim" cards={favorites} onFav={toggleFav} onRemove={removeCard} />
            )}
            <Section title="🌟 Huyền thoại" sub="Cực hiếm — thưởng khoai lớn" cards={byRarity("legendary")} onFav={toggleFav} onRemove={removeCard} />
            <Section title="✦ Hiếm" sub="Khó gặp — có thưởng khoai" cards={byRarity("rare")} onFav={toggleFav} onRemove={removeCard} />
            <Section title="🌿 Thường" sub="Cảm hứng mỗi ngày" cards={byRarity("common")} onFav={toggleFav} onRemove={removeCard} />

            {bin.length > 0 && (
              <section className="cc-sec cc-bin">
                <div className="cc-sec-head">
                  <h3>🗑️ Thẻ đã ẩn</h3>
                  <span className="cc-sec-count tnum">{bin.length}</span>
                  <button className="cc-bin-toggle" onClick={() => setShowBin((v) => !v)}>{showBin ? "Ẩn đi" : "Xem & khôi phục"}</button>
                </div>
                {showBin && (
                  <div className="cc-grid">
                    {bin.map((c) => (
                      <div className={`cc-card owned rarity-${c.rarity} cc-removed`} key={c.cardId} style={bgStyle(c.background)}>
                        {c.background && <span className="cc-bg-scrim" />}
                        <div className="cc-emoji">{c.emoji}</div>
                        <div className="cc-msg">“{c.message}”</div>
                        <div className="cc-foot">
                          <span className="cc-cat">#{c.category}</span>
                          <button className="cc-restore" onClick={() => restoreCard(c.cardId)}>↩ Khôi phục</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
    </Modal>
  );
}

function Section({ title, sub, cards, onFav, onRemove }: { title: string; sub: string; cards: Card[]; onFav: (id: string) => void; onRemove: (id: string) => void }) {
  if (cards.length === 0) return null;
  const owned = cards.filter((c) => c.owned).length;
  return (
    <section className="cc-sec">
      <div className="cc-sec-head">
        <h3>{title}</h3>
        <span className="cc-sec-count tnum">{owned}/{cards.length}</span>
        <span className="cc-sec-sub">{sub}</span>
      </div>
      <div className="cc-grid">
        {cards.map((c) => <CardTile key={c.cardId} c={c} onFav={onFav} onRemove={onRemove} />)}
      </div>
    </section>
  );
}

function CardTile({ c, onFav, onRemove }: { c: Card; onFav: (id: string) => void; onRemove: (id: string) => void }) {
  if (!c.owned) {
    return (
      <div className="cc-card locked" title="Chưa sưu tầm được — lật thẻ mỗi ngày để tìm nhé!">
        <div className="cc-lock">❔</div>
        <small>Chưa sưu tầm</small>
        {c.rarity !== "common" && <span className="cc-lock-rare">{RARITY_LABEL[c.rarity]}</span>}
      </div>
    );
  }
  const hasBg = !!c.background;
  return (
    <div className={`cc-card owned rarity-${c.rarity}${c.favorite ? " fav" : ""}${hasBg ? " has-bg" : ""}`} style={bgStyle(c.background)}>
      {hasBg && <span className="cc-bg-scrim" />}
      <div className="cc-card-actions">
        <button className={`cc-star${c.favorite ? " on" : ""}`} onClick={() => onFav(c.cardId)}
          title={c.favorite ? "Bỏ ghim thẻ ý nghĩa" : "Ghim là thẻ ý nghĩa nhất"} aria-label="Ghim thẻ ý nghĩa">
          {c.favorite ? "⭐" : "☆"}
        </button>
        <button className="cc-remove" onClick={() => onRemove(c.cardId)} title="Bỏ thẻ khỏi bộ sưu tập" aria-label="Bỏ thẻ">✕</button>
      </div>
      {c.rarity !== "common" && <span className="cc-badge">{RARITY_LABEL[c.rarity]}</span>}
      <div className="cc-emoji">{c.emoji}</div>
      <div className="cc-msg">“{c.message}”</div>
      <div className="cc-foot">
        <span className="cc-cat">#{c.category}</span>
        <span className="cc-meta">
          {c.copies > 1 && <span className="cc-copies tnum">×{c.copies}</span>}
          {c.firstISO && <span className="cc-since">{fmtDate(c.firstISO)}</span>}
        </span>
      </div>
    </div>
  );
}
