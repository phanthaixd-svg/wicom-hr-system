"use client";

import { useEffect, useMemo, useState } from "react";
import { bgStyle } from "../home/CardCollectionModal";
import Modal from "@/components/ui/Modal";

interface Card {
  id: string; message: string; emoji: string; background: string | null; category: string;
  rarity: string; rewardKhoai: number; active: boolean; sortOrder: number; draws: number;
}

const RARITY_LABEL: Record<string, string> = { common: "Thường", rare: "Hiếm", legendary: "Huyền thoại" };
const CATEGORY_PRESETS = ["Biết ơn", "Sức khoẻ", "Văn hoá", "Cải tiến", "Special"];
const GRADIENTS = [
  { key: "navy", css: "linear-gradient(135deg,#215579,#0A2338)" },
  { key: "blue", css: "linear-gradient(135deg,#33A3DC,#1A4565)" },
  { key: "mint", css: "linear-gradient(135deg,#18E4A2,#1f9d6b)" },
  { key: "gold", css: "linear-gradient(135deg,#FFC45F,#e0a500)" },
  { key: "purple", css: "linear-gradient(135deg,#a58bff,#7A5AF8)" },
  { key: "sunset", css: "linear-gradient(135deg,#FC4C02,#E08A2E)" },
  { key: "rose", css: "linear-gradient(135deg,#f7b7f0,#c86ad6)" },
];

type Draft = { id?: string; message: string; emoji: string; background: string; category: string; rarity: string; rewardKhoai: number; active: boolean; sortOrder: number };
const EMPTY: Draft = { message: "", emoji: "🌿", background: "", category: "Văn hoá", rarity: "common", rewardKhoai: 0, active: true, sortOrder: 100 };

export default function CardsTab() {
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const res = await fetch("/api/admin/cards", { cache: "no-store" });
    if (res.ok) { const j = await res.json(); setCards(j.cards); setCategories(j.categories); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const catOptions = useMemo(() => [...new Set([...CATEGORY_PRESETS, ...categories])], [categories]);

  const startNew = () => { setErr(""); setDraft({ ...EMPTY, sortOrder: (cards.at(-1)?.sortOrder ?? 90) + 10 }); };
  const startEdit = (c: Card) => { setErr(""); setDraft({ id: c.id, message: c.message, emoji: c.emoji, background: c.background ?? "", category: c.category, rarity: c.rarity, rewardKhoai: c.rewardKhoai, active: c.active, sortOrder: c.sortOrder }); };

  const upload = async (file: File) => {
    setBusy(true); setErr("");
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) setDraft((d) => d && { ...d, background: j.url });
    else setErr(j.error === "too-large" ? "Ảnh quá lớn (>8MB)." : "Tải ảnh thất bại.");
  };

  const save = async () => {
    if (!draft) return;
    setErr("");
    if (!draft.message.trim()) return setErr("Cần nội dung thẻ.");
    setBusy(true);
    const isEdit = !!draft.id;
    const payload = { message: draft.message, emoji: draft.emoji, background: draft.background, category: draft.category, rarity: draft.rarity, rewardKhoai: draft.rewardKhoai, active: draft.active, sortOrder: draft.sortOrder };
    const res = await fetch("/api/admin/cards", {
      method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: draft.id, patch: payload } : payload),
    });
    setBusy(false);
    if (res.ok) { setDraft(null); load(); }
    else { const j = await res.json().catch(() => ({})); setErr(j.message || "Lưu thất bại."); }
  };

  const del = async (c: Card) => {
    if (!confirm(c.draws > 0 ? `Thẻ này đã có ${c.draws} bản trong bộ sưu tập thành viên → sẽ được ẩn (không xoá hẳn). Tiếp tục?` : "Xoá hẳn thẻ này?")) return;
    setBusy(true);
    const res = await fetch("/api/admin/cards", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setDraft(null); load(); if (j.softDeleted) alert(j.message); }
    else alert("Xoá thất bại.");
  };

  if (loading) return <div className="loading">Đang tải…</div>;

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <div className="ct-head">
          <div>
            <h3 style={{ fontSize: 14, margin: 0 }}>🎴 Wicer Card <span className="pill" style={{ marginLeft: 6 }}>{cards.length}</span></h3>
            <p style={{ color: "var(--ink-2)", fontSize: 12.5, margin: "4px 0 0" }}>Thẻ cảm hứng nhân viên lật mỗi ngày. Gồm nội dung + nền (tuỳ chọn), gắn loại & độ hiếm (chi phối tỉ lệ ra thẻ + thưởng khoai).</p>
          </div>
          <button className="btn-save-goal" onClick={startNew}>+ Thêm thẻ</button>
        </div>

        <div className="ct-grid">
          {cards.map((c) => (
            <div key={c.id} className={`ct-card rarity-${c.rarity}${c.active ? "" : " inactive"}${c.background ? " has-bg" : ""}`} style={bgStyle(c.background)} onClick={() => startEdit(c)} role="button" title="Bấm để sửa">
              {c.background && <span className="cc-bg-scrim" />}
              {c.rarity !== "common" && <span className="cc-badge">{RARITY_LABEL[c.rarity].toUpperCase()}</span>}
              {!c.active && <span className="ct-off">Đã ẩn</span>}
              <div className="cc-emoji">{c.emoji}</div>
              <div className="cc-msg">“{c.message}”</div>
              <div className="cc-foot">
                <span className="cc-cat">#{c.category}</span>
                <span className="cc-meta">
                  {c.rewardKhoai > 0 && <span className="cc-copies tnum">+{c.rewardKhoai}🥔</span>}
                  {c.draws > 0 && <span className="cc-since">{c.draws} bản</span>}
                </span>
              </div>
            </div>
          ))}
          {cards.length === 0 && <div className="act-empty" style={{ display: "block" }}>Chưa có thẻ nào. Bấm “+ Thêm thẻ”.</div>}
        </div>
      </div>

      {/* Editor */}
      {draft && (
        <Modal onClose={() => setDraft(null)} panelClassName="ct-editor">
            <h3 style={{ marginBottom: 14 }}>{draft.id ? "Sửa thẻ" : "Thẻ mới"}</h3>

            <div className="ct-form">
              <div className="ct-form-l">
                <label className="fld"><span>Nội dung thẻ</span>
                  <textarea rows={3} value={draft.message} maxLength={400} placeholder="Câu cảm hứng / thông điệp…" onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
                </label>
                <div className="gf-row">
                  <label className="fld" style={{ maxWidth: 90 }}><span>Emoji</span>
                    <input value={draft.emoji} maxLength={4} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} />
                  </label>
                  <label className="fld"><span>Loại thẻ (tag)</span>
                    <input list="ct-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Văn hoá / Special…" />
                    <datalist id="ct-cats">{catOptions.map((c) => <option key={c} value={c} />)}</datalist>
                  </label>
                </div>
                <div className="gf-row">
                  <label className="fld"><span>Độ hiếm</span>
                    <select value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: e.target.value })}>
                      <option value="common">Thường (hay gặp)</option>
                      <option value="rare">Hiếm (ít gặp)</option>
                      <option value="legendary">Huyền thoại (cực hiếm)</option>
                    </select>
                  </label>
                  <label className="fld" style={{ maxWidth: 120 }}><span>Thưởng khoai</span>
                    <input type="number" min={0} value={draft.rewardKhoai} onChange={(e) => setDraft({ ...draft, rewardKhoai: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                  <label className="fld" style={{ maxWidth: 100 }}><span>Thứ tự</span>
                    <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} />
                  </label>
                </div>

                <div className="fld">
                  <span>Nền (tuỳ chọn)</span>
                  <div className="ct-bgs">
                    <button className={`ct-bg none${!draft.background ? " on" : ""}`} onClick={() => setDraft({ ...draft, background: "" })} title="Không nền">∅</button>
                    {GRADIENTS.map((g) => (
                      <button key={g.key} className={`ct-bg${draft.background === g.css ? " on" : ""}`} style={{ background: g.css }} onClick={() => setDraft({ ...draft, background: g.css })} title={g.key} />
                    ))}
                    <label className="ct-bg upload" title="Tải ảnh nền">📷
                      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                    </label>
                  </div>
                  {draft.background?.startsWith("/") && <div className="ct-bg-note">Ảnh: {draft.background}</div>}
                </div>

                <label className="goal-remind-toggle">
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                  <span>Đang hoạt động (xuất hiện trong bộ bài để nhân viên lật)</span>
                </label>

                {err && <div className="submit-err">{err}</div>}

                <div className="ct-actions">
                  {draft.id && <button className="ct-del" onClick={() => del(cards.find((c) => c.id === draft.id)!)} disabled={busy}>🗑 Xoá</button>}
                  <div style={{ flex: 1 }} />
                  <button className="btn-cancel" onClick={() => setDraft(null)}>Huỷ</button>
                  <button className="btn-save-goal" onClick={save} disabled={busy}>{busy ? "Đang lưu…" : draft.id ? "Lưu" : "Tạo thẻ"}</button>
                </div>
              </div>

              {/* Live preview */}
              <div className="ct-preview">
                <span className="ct-preview-lb">Xem trước</span>
                <div className={`cc-card owned rarity-${draft.rarity}${draft.background ? " has-bg" : ""}`} style={bgStyle(draft.background || null)}>
                  {draft.background && <span className="cc-bg-scrim" />}
                  {draft.rarity !== "common" && <span className="cc-badge">{RARITY_LABEL[draft.rarity].toUpperCase()}</span>}
                  <div className="cc-emoji">{draft.emoji || "🌿"}</div>
                  <div className="cc-msg">“{draft.message || "Nội dung thẻ…"}”</div>
                  <div className="cc-foot"><span className="cc-cat">#{draft.category || "Loại"}</span>{draft.rewardKhoai > 0 && <span className="cc-copies tnum">+{draft.rewardKhoai}🥔</span>}</div>
                </div>
              </div>
            </div>
        </Modal>
      )}
    </>
  );
}
