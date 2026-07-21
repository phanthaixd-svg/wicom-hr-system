"use client";

import { useEffect, useState } from "react";
import Avatar from "../Avatar";
import Modal from "@/components/ui/Modal";

interface Contributor { id: string; name: string; avatarUrl: string | null; khoai: number; isMain: boolean }
interface Reward {
  id: string; name: string; description: string | null; emoji: string | null; imageUrl: string | null;
  kind: "individual" | "squad" | "greenfield"; costKhoai: number; goalKhoai: number | null; maxMain: number | null;
  status: string; raised: number; pct: number; mainCount: number; myKhoai: number; myIsMain: boolean; contributors: Contributor[];
}
interface Redemption { id: string; rewardName: string; costKhoai: number; status: string; createdAt: string }
interface RewardsData { balance: number; rewards: Reward[]; redemptions: Redemption[] }

const lastName = (n: string) => n.split(" ").slice(-2).join(" ");

export default function RewardsSection({ onChange }: { onChange?: () => void }) {
  const [d, setD] = useState<RewardsData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Reward | null>(null);
  const [contribKhoai, setContribKhoai] = useState(50);
  const [asMain, setAsMain] = useState(false);
  const [err, setErr] = useState("");

  const load = () => fetch("/api/withanks/rewards", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    setD(j);
    if (j && detail) setDetail(j.rewards.find((r: Reward) => r.id === detail.id) ?? null);
  });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const redeem = async (r: Reward) => {
    if (!confirm(`Đổi "${r.name}" với ${r.costKhoai} 🥔?`)) return;
    setBusy(r.id);
    const res = await fetch("/api/withanks/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardId: r.id }) });
    setBusy(null);
    if (res.ok) { await load(); onChange?.(); }
    else { const j = await res.json().catch(() => ({})); alert(j.message || "Đổi thất bại."); }
  };

  const open = (r: Reward) => { setDetail(r); setErr(""); setAsMain(r.kind === "squad" && !r.myIsMain && (r.maxMain == null || r.mainCount < r.maxMain)); setContribKhoai(50); };

  const contribute = async () => {
    if (!detail) return;
    setErr("");
    if (contribKhoai < 1) return setErr("Số khoai góp phải ≥ 1.");
    if ((d?.balance ?? 0) < contribKhoai) return setErr("Không đủ khoai để góp.");
    setBusy(detail.id);
    const res = await fetch("/api/withanks/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardId: detail.id, khoai: contribKhoai, asMain }) });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (res.ok) { await load(); onChange?.(); }
    else setErr(j.message || "Góp thất bại.");
  };

  const groups: { key: Reward["kind"]; head: string; sub: string }[] = [
    { key: "individual", head: "🙋 Cá nhân", sub: "đổi bằng khoai của bạn" },
    { key: "squad", head: "👥 Amazing Squad", sub: "nhóm hưởng chung, có suất Main Contributor" },
    { key: "greenfield", head: "🌱 Green Field", sub: "cả văn phòng cùng góp" },
  ];

  return (
    <div className="card wt-rewards2">
      <div className="wt-rw-head">
        <div className="wt-title">🎁 Đổi quà bằng khoai</div>
        <span className="wt-rw-bal tnum">Số dư: {d?.balance ?? 0} 🥔</span>
      </div>

      {!d ? (
        <div className="act-empty" style={{ display: "block" }}>Đang tải…</div>
      ) : d.rewards.length === 0 ? (
        <div className="act-empty" style={{ display: "block" }}>Chưa có phần quà nào. Admin sẽ thêm sớm.</div>
      ) : (
        groups.map((g) => {
          const items = d.rewards.filter((r) => r.kind === g.key);
          if (items.length === 0) return null;
          return (
            <div key={g.key} className="rw-group">
              <div className="rw-subhead">{g.head} <small>— {g.sub}</small></div>
              <div className="rw-grid2">
                {items.map((r) => {
                  const afford = (d.balance ?? 0) >= r.costKhoai;
                  const accent = r.kind === "squad" ? "sq" : r.kind === "greenfield" ? "gf" : "ind";
                  return (
                    <div className={`rw-card2 ${accent}`} key={r.id} onClick={r.kind === "individual" ? undefined : () => open(r)} role={r.kind === "individual" ? undefined : "button"}>
                      <div className="rw-img2">{r.imageUrl ? <img src={r.imageUrl} alt="" /> : <span className="rw-emoji2">{r.emoji || "🎁"}</span>}
                        {r.kind !== "individual" && <span className={`rw-tag ${accent}`}>{r.kind === "squad" ? `Squad · ${r.maxMain} suất` : "Green Field"}</span>}
                      </div>
                      <div className="rw-body2">
                        <div className="rw-name2">{r.name}</div>
                        {r.kind === "individual" ? (
                          <>
                            {r.description && <div className="rw-desc2">{r.description}</div>}
                            <div className="rw-foot2">
                              <span className="rw-cost2 tnum">{r.costKhoai} 🥔</span>
                              <button className={`rw-btn2${afford ? " aff" : ""}`} disabled={!afford || busy === r.id} onClick={(e) => { e.stopPropagation(); redeem(r); }}>
                                {busy === r.id ? "…" : afford ? "Đổi" : `Thiếu ${r.costKhoai - (d.balance ?? 0)}🥔`}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rw-prog"><i className={accent} style={{ width: `${r.pct}%` }} /></div>
                            <div className="rw-foot2">
                              <span className={`rw-cost2 tnum ${accent}`}>{r.raised}/{r.goalKhoai} 🥔</span>
                              <button className={`rw-btn2 ${accent}`} onClick={(e) => { e.stopPropagation(); open(r); }}>
                                {r.status === "fulfilled" ? "Đã đủ ✓" : "Góp"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {d && d.redemptions.length > 0 && (
        <div className="wt-redlist">
          <div className="wt-redlist-h">Đã đổi gần đây</div>
          {d.redemptions.map((r) => (
            <div className="wt-red-row" key={r.id}>
              <span className={`status ${r.status === "fulfilled" ? "s-appr" : "s-pend"}`}>{r.status === "fulfilled" ? "Đã nhận" : "Chờ HR"}</span>
              <span className="wtred-nm">{r.rewardName}</span>
              <span className="wtred-cost tnum">−{r.costKhoai} 🥔</span>
            </div>
          ))}
        </div>
      )}

      {/* Popup chi tiết Squad / Green Field */}
      {detail && (
        <Modal onClose={() => setDetail(null)} panelClassName="rw-detail">
            <div className={`rwd-hero ${detail.kind === "squad" ? "sq" : "gf"}`}>
              <span className="rwd-tag">{detail.kind === "squad" ? `Amazing Squad · ${detail.maxMain} suất Main` : "Green Field"}</span>
              <span className="rwd-em">{detail.emoji || "🎁"}</span>
            </div>
            <div className="rwd-body">
              <h3>{detail.name}</h3>
              {detail.description && <p className="rwd-desc">{detail.description}</p>}
              <div className="rw-prog big"><i className={detail.kind === "squad" ? "sq" : "gf"} style={{ width: `${detail.pct}%` }} /></div>
              <div className="rwd-progline">
                <b className={detail.kind === "squad" ? "sq" : "gf"}>{detail.raised} / {detail.goalKhoai} 🥔</b>
                <span>{detail.status === "fulfilled" ? "Đã đạt mốc 🎉" : `còn ${Math.max(0, (detail.goalKhoai ?? 0) - detail.raised)}`}</span>
              </div>

              {detail.kind === "squad" ? (
                <div className="rwd-slots">
                  <div className="rwd-slot-h">SUẤT MAIN CONTRIBUTOR ({detail.mainCount}/{detail.maxMain})</div>
                  {detail.contributors.filter((c) => c.isMain).map((c) => (
                    <div className="rwd-slot main" key={c.id}><Avatar name={c.name} url={c.avatarUrl} size={24} /><span>{lastName(c.name)}</span><span className="role">MAIN · {c.khoai}🥔</span></div>
                  ))}
                  {Array.from({ length: Math.max(0, (detail.maxMain ?? 0) - detail.mainCount) }).map((_, i) => (
                    <div className="rwd-slot open" key={`o${i}`}>＋ Suất Main còn trống — góp &amp; giữ suất để được hưởng quà</div>
                  ))}
                  {detail.contributors.some((c) => !c.isMain) && (
                    <div className="rwd-gmers">🥔 {detail.contributors.filter((c) => !c.isMain).length} người góp thêm (không giữ suất Main)</div>
                  )}
                </div>
              ) : (
                <div className="rwd-slots">
                  <div className="rwd-slot-h">NGƯỜI GÓP NHIỀU NHẤT</div>
                  {detail.contributors.slice(0, 6).map((c) => (
                    <div className="rwd-slot" key={c.id}><Avatar name={c.name} url={c.avatarUrl} size={24} /><span>{lastName(c.name)}</span><span className="role gf">{c.khoai}🥔</span></div>
                  ))}
                  {detail.contributors.length === 0 && <div className="rwd-slot open">Chưa ai góp — hãy là người đầu tiên! 🌱</div>}
                </div>
              )}

              {detail.status !== "fulfilled" && (
                <div className="rwd-give">
                  <div className="rwd-give-row">
                    <input type="number" min={1} value={contribKhoai} onChange={(e) => setContribKhoai(Math.max(1, Number(e.target.value) || 1))} />
                    <span className="tnum">🥔 · ví {d?.balance ?? 0}</span>
                  </div>
                  {detail.kind === "squad" && (detail.myIsMain || detail.mainCount < (detail.maxMain ?? 0)) && (
                    <label className="rwd-mainopt">
                      <input type="checkbox" checked={asMain || detail.myIsMain} disabled={detail.myIsMain} onChange={(e) => setAsMain(e.target.checked)} />
                      <span>{detail.myIsMain ? "Bạn đang giữ suất Main ✓" : "Giữ suất Main (được hưởng quà)"}</span>
                    </label>
                  )}
                  {err && <div className="submit-err">{err}</div>}
                  <button className={`btn-save-goal rwd-give-btn ${detail.kind === "squad" ? "sq" : "gf"}`} onClick={contribute} disabled={busy === detail.id}>
                    {busy === detail.id ? "Đang góp…" : `Góp ${contribKhoai}🥔`}
                  </button>
                </div>
              )}
            </div>
        </Modal>
      )}
    </div>
  );
}
