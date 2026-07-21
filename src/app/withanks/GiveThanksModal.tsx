"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "../Avatar";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface Member { id: string; name: string; avatarUrl: string | null; team: string | null }
interface Allowance { unlimited: boolean; canGiveNow: number | null; perPersonDay: number | null; weekRemaining: number | null; monthRemaining: number | null }
interface Eligibility { canSuper: boolean; superUsed: number; canSpecial: boolean; specialUsed: number; tenureDays: number; specialCost: number; specialTenureDays: number }
interface ValueTag { key: string; label: string; emoji: string }

type Tier = "thanks" | "super" | "special";
const SUPER_KHOAI = 30, SPECIAL_KHOAI = 100, MIN_SUPER = 80, MIN_SPECIAL = 80;

const NO_ELIG: Eligibility = { canSuper: false, superUsed: 0, canSpecial: false, specialUsed: 0, tenureDays: 0, specialCost: SPECIAL_KHOAI, specialTenureDays: 180 };

export default function GiveThanksModal({
  allowance, balance = 0, eligibility, valueTags = [], initialTier = "thanks", initialReceiver, onClose, onDone,
}: {
  allowance: Allowance; balance?: number; eligibility?: Eligibility; valueTags?: ValueTag[];
  initialTier?: Tier; initialReceiver?: Member | null; onClose: () => void; onDone: () => void;
}) {
  const showTiers = !!eligibility; // WicerHome quick-give không truyền → chỉ Thanks
  const elig = eligibility ?? NO_ELIG;
  const [tier, setTier] = useState<Tier>(initialTier);
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Record<string, Member>>(
    initialReceiver ? { [initialReceiver.id]: initialReceiver } : {},
  );
  const [khoai, setKhoai] = useState(3);
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/withanks/members", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((j) => setMembers(j.members ?? []));
  }, []);

  // Đóng danh sách tên khi bấm ra ngoài ô chọn.
  useEffect(() => {
    if (!listOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [listOpen]);

  const single = tier !== "thanks";
  const cap = allowance.perPersonDay ?? 5;
  const pickedList = Object.values(picked);
  // Lọc theo tìm kiếm + sắp xếp A→Z theo tên cho dễ tìm.
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members
      .filter((m) => !s || m.name.toLowerCase().includes(s) || (m.team ?? "").toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .slice(0, 60);
  }, [members, q]);

  const toggle = (m: Member) =>
    setPicked((p) => {
      if (single) return p[m.id] ? {} : { [m.id]: m }; // super/special: chỉ 1 người
      const n = { ...p };
      if (n[m.id]) delete n[m.id]; else n[m.id] = m;
      return n;
    });
  const toggleTag = (k: string) => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : t.length < 3 ? [...t, k] : t));
  const switchTier = (t: Tier) => { setTier(t); setErr(""); if (t !== "thanks") setPicked((p) => { const v = Object.values(p)[0]; return v ? { [v.id]: v } : {}; }); };

  const perKhoai = tier === "super" ? SUPER_KHOAI : tier === "special" ? SPECIAL_KHOAI : khoai;
  const totalCost = tier === "thanks" ? khoai * pickedList.length : perKhoai;
  const minMsg = tier === "thanks" ? 10 : tier === "super" ? MIN_SUPER : MIN_SPECIAL;
  const overBudget = tier === "thanks" && !allowance.unlimited && allowance.canGiveNow != null && totalCost > allowance.canGiveNow;
  const tierBlocked = (tier === "super" && !elig.canSuper) || (tier === "special" && !elig.canSpecial);

  const submit = async () => {
    setErr("");
    if (pickedList.length === 0) return setErr("Chọn người nhận.");
    if (tier === "thanks" && khoai > cap) return setErr(`Tối đa ${cap} khoai/người.`);
    if (message.trim().length < minMsg) return setErr(`Lời cảm ơn cần tối thiểu ${minMsg} ký tự (còn ${minMsg - message.trim().length}).`);
    if (overBudget) return setErr(`Vượt hạn mức. Bạn còn tặng được ${allowance.canGiveNow} khoai.`);
    if (tier === "special" && balance < SPECIAL_KHOAI) return setErr(`Special Gift cần ${SPECIAL_KHOAI}🥔 trong ví. Bạn có ${balance}🥔.`);
    setBusy(true);
    const res = await fetch("/api/withanks/give", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: tier, receiverIds: pickedList.map((m) => m.id), khoai, message: message.trim(), anonymous: tier === "special" ? false : anonymous, valueTags: tags }),
    });
    setBusy(false);
    if (res.ok) { setDone(true); onDone(); }
    else { const j = await res.json().catch(() => ({})); setErr(j.message || "Gửi thất bại."); }
  };

  const doneText = tier === "special" ? "Special Gift đã ghi nhận!" : tier === "super" ? "Đã gửi Super Thanks 💜" : "Đã gửi lời cảm ơn!";
  const doneSub = tier === "special" ? "HR sẽ liên hệ để chuẩn bị món quà thật. Cảm ơn vì đã trân trọng đồng đội 💛" : "Khoai đã được trao. Người nhận sẽ được Lark báo ngay.";

  return (
    <Modal onClose={onClose} panelClassName="gt-panel">
        {done ? (
          <div className="submit-done">
            <div className="sd-ico">{tier === "special" ? "🎁" : tier === "super" ? "💜" : "🥔"}</div>
            <h3>{doneText}</h3>
            <p className="sub">{doneSub}</p>
            <div className="submit-done-actions">
              <Button variant="primary" onClick={() => { setDone(false); setPicked({}); setMessage(""); setKhoai(3); setTags([]); setTier("thanks"); }}>Gửi tiếp</Button>
              <Button variant="secondary" onClick={onClose}>Đóng</Button>
            </div>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 12 }}>💌 Gửi lời cảm ơn</h3>

            {/* 3 nấc */}
            {showTiers && (
              <div className="gt-tiers">
                <button className={`gt-tier${tier === "thanks" ? " on" : ""}`} onClick={() => switchTier("thanks")}>
                  <span className="i">🥔</span><b>Thanks</b><small>≤{cap}/người/ngày</small>
                </button>
                <button className={`gt-tier sup${tier === "super" ? " on" : ""}`} onClick={() => switchTier("super")}>
                  <span className="i">💜</span><b>Super</b><small>1/tháng · 30🥔</small>
                </button>
                <button className={`gt-tier spc${tier === "special" ? " on" : ""}`} onClick={() => switchTier("special")}>
                  <span className="i">🎁</span><b>Special</b><small>1/năm · quà thật</small>
                </button>
              </div>
            )}

            {/* Gate theo nấc */}
            {tier === "super" && (
              <div className={`gt-gate sup${elig.canSuper ? "" : " blocked"}`}>
                💜 <b>Super Thanks</b> — tôn vinh 1 người bạn biết ơn nhất tháng này. Tặng 30🥔, không tính hạn mức thường.
                {!elig.canSuper && <span className="warn"> · Bạn đã dùng Super tháng này, tháng sau nhé!</span>}
              </div>
            )}
            {tier === "special" && (
              <>
                <div className="gt-philo">
                  <div className="q">&quot;Niềm vui từ tiền thoáng qua, kỷ niệm thì ở lại.&quot;</div>
                  <small>Google (Work Rules!): quà &amp; trải nghiệm khiến người ta vui hơn ~28% và đáng nhớ hơn so với tiền mặt. Special Gift = món quà thật + khoảnh khắc gặp nhau.</small>
                </div>
                <div className="gt-ritual">
                  {[["💝", "Chọn người"], ["✍️", "Viết thật lòng"], ["🎁", "Quà <500k"], ["📸", "Check-in"], ["✅", "HR hoàn"]].map(([e, t]) => (
                    <div className="gt-rstep" key={t}><span>{e}</span><small>{t}</small></div>
                  ))}
                </div>
                <div className={`gt-gate spc${elig.canSpecial ? "" : " blocked"}`}>
                  🎁 Trừ <b>{SPECIAL_KHOAI}🥔</b> (cam kết cá nhân) · chỉ NV ≥6 tháng · 1 lần/năm · Ví: <b>{balance}🥔</b>
                  {!elig.canSpecial && (
                    <span className="warn"> · {elig.tenureDays < elig.specialTenureDays ? "Cần gắn bó ≥6 tháng" : elig.specialUsed > 0 ? "Đã dùng năm nay" : `Cần ${SPECIAL_KHOAI}🥔`}</span>
                  )}
                </div>
              </>
            )}

            <div className="gt-form" style={{ marginTop: 12 }}>
              <div className="fld gt-picker">
                <span className="fld-lb">
                  {single ? "Người muốn tôn vinh" : "Người nhận"}
                  {pickedList.length > 0 && !single && <b className="fld-aside">{pickedList.length} người</b>}
                </span>
                {pickedList.length > 0 && (
                  <div className="gt-chips">
                    {pickedList.map((m) => (<button key={m.id} className="gt-chip" onClick={() => toggle(m)}>{m.name} ✕</button>))}
                  </div>
                )}
                <div className="gt-search" ref={pickRef}>
                  <span className="gt-search-ic" aria-hidden>🔍</span>
                  <input
                    className="gt-search-in"
                    placeholder={single ? "Bấm để chọn, hoặc gõ tên…" : "Bấm để chọn nhiều người, hoặc gõ tên…"}
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setListOpen(true); }}
                    onFocus={() => setListOpen(true)}
                  />
                  {listOpen && (
                    <div className="gt-memberlist">
                      {filtered.map((m) => (
                        <button
                          key={m.id}
                          className={`gt-member${picked[m.id] ? " on" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { toggle(m); if (single) setListOpen(false); }}
                        >
                          <Avatar name={m.name} url={m.avatarUrl} size={28} />
                          <span className="gm-name">{m.name}</span>
                          <span className="gm-team">{m.team ?? ""}</span>
                          <span className="gm-check">{picked[m.id] ? "✓" : ""}</span>
                        </button>
                      ))}
                      {filtered.length === 0 && <div className="cm-empty">Không tìm thấy “{q}”.</div>}
                    </div>
                  )}
                </div>
              </div>

              {tier === "thanks" && (
                <div className="gf-row">
                  <div className="fld">
                    <span>Số khoai / người 🥔</span>
                    <div className="gt-khoai-pick">
                      {[1, 2, 3, 4, 5].filter((n) => n <= cap).map((n) => (
                        <button key={n} className={`gt-dot${khoai === n ? " on" : ""}`} onClick={() => setKhoai(n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="fld">
                    <span>Tổng cộng</span>
                    <div className="gt-total tnum">{totalCost} 🥔</div>
                  </div>
                </div>
              )}

              <label className="fld">
                <span>Lời cảm ơn <b className={`gt-count${message.trim().length >= minMsg ? " ok" : ""}`}>{message.trim().length} / ≥{minMsg} ký tự</b></span>
                <textarea rows={tier === "thanks" ? 3 : 4} placeholder={tier === "special" ? "Điều bạn thật sự biết ơn ở người này suốt thời gian qua…" : "Cảm ơn bạn vì đã…"} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
              </label>

              {tier !== "special" && (
                <div className="fld">
                  <span>Gắn giá trị cốt lõi <small className="gt-hint">tối đa 3</small></span>
                  <div className="gt-vtags">
                    {valueTags.map((v) => (
                      <button key={v.key} className={`gt-vtag${tags.includes(v.key) ? " on" : ""}`} onClick={() => toggleTag(v.key)}>
                        {tags.includes(v.key) ? "✓ " : ""}{v.emoji} {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tier !== "special" && (
                <label className="goal-remind-toggle">
                  <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                  <span>🕶️ Gửi ẩn danh (board che tên; người nhận vẫn biết qua Lark)</span>
                </label>
              )}

              {err && <div className="submit-err">{err}</div>}

              <div className="goal-form-actions">
                <Button variant="secondary" onClick={onClose}>Huỷ</Button>
                <Button
                  variant="primary"
                  tone={tier === "super" ? "super" : tier === "special" ? "special" : undefined}
                  onClick={submit}
                  disabled={busy || pickedList.length === 0 || tierBlocked}
                >
                  {busy ? "Đang gửi…" : tier === "super" ? "Gửi Super Thanks 💜" : tier === "special" ? "Gửi Special Gift 🎁" : `Tặng ${totalCost} 🥔`}
                </Button>
              </div>
            </div>
          </>
        )}
    </Modal>
  );
}
