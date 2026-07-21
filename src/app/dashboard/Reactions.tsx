"use client";

import { useEffect, useRef, useState } from "react";
import { REACT_EMOJIS, REACT_LABEL, type ReactionGroup } from "@/lib/reactions";

// Cảm xúc kiểu Strava kudos: 5 icon giới hạn, bấm nhiều lần để tăng count.
// variant "feed": chip gọn trong thẻ. variant "detail": chip + danh sách người thả (cạnh bình luận).
export default function Reactions({ activityId, initial, variant }: { activityId: string; initial: ReactionGroup[]; variant: "feed" | "detail" }) {
  const [groups, setGroups] = useState<ReactionGroup[]>(initial ?? []);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => setGroups(initial ?? []), [initial]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const add = (emoji: string) => {
    // Cập nhật lạc quan +1 ngay; đồng bộ lại theo phản hồi request mới nhất (seq).
    setGroups((gs) => {
      const g = gs.find((x) => x.emoji === emoji);
      if (g) return gs.map((x) => (x.emoji === emoji ? { ...x, count: x.count + 1, mine: true, mineCount: x.mineCount + 1, people: x.mine ? x.people : x.people + 1 } : x));
      return [...gs, { emoji, count: 1, names: [], people: 1, mine: true, mineCount: 1 }].sort((a, b) => REACT_EMOJIS.indexOf(a.emoji) - REACT_EMOJIS.indexOf(b.emoji));
    });
    const my = ++seq.current;
    fetch(`/api/activity/${activityId}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && my === seq.current) setGroups(j.reactions); })
      .catch(() => {});
  };

  const total = groups.reduce((n, g) => n + g.count, 0);

  return (
    <div className={`rx rx-${variant}`} ref={wrapRef}>
      <div className="rx-row">
        {groups.map((g) => (
          <button key={g.emoji} className={`rx-chip${g.mine ? " mine" : ""}`} onClick={() => add(g.emoji)} title={g.names.join(", ")}>
            <span className="e">{g.emoji}</span><b className="tnum">{g.count}</b>
          </button>
        ))}
        <div className="rx-add">
          <button className="rx-trigger" onClick={() => setOpen((o) => !o)} aria-label="Thả cảm xúc — di chuột để chọn">
            <span className="rx-like">👍</span>
            {!groups.length && <span className="rx-t-tx">Cổ vũ</span>}
          </button>
          <div className={`rx-pop${open ? " open" : ""}`}>
            {REACT_EMOJIS.map((e) => (
              <button key={e} className="rx-popbtn" title={REACT_LABEL[e]} onClick={() => { add(e); setOpen(false); }}>{e}</button>
            ))}
          </div>
        </div>
      </div>

      {variant === "detail" && total > 0 && (
        <div className="rx-people">
          {groups.map((g) => (
            <span key={g.emoji} className={`rx-pl${g.mine ? " mine" : ""}`}><b>{g.emoji}</b> {g.names.join(", ")}</span>
          ))}
        </div>
      )}
    </div>
  );
}
