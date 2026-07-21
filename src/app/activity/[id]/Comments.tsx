"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "../../Avatar";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  who: { id: string; name: string; avatarUrl: string | null; team: string };
}

function relTime(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} giờ`;
  return `${Math.round(hrs / 24)} ngày`;
}

export default function Comments({ activityId }: { activityId: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/activity/${activityId}/comments`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((j) => setComments(j.comments));
  }, [activityId]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const res = await fetch(`/api/activity/${activityId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    if (res.ok) {
      setComments((await res.json()).comments);
      setText("");
      taRef.current?.focus();
    }
  };

  const del = async (id: string) => {
    const res = await fetch(`/api/activity/${activityId}/comments?commentId=${id}`, { method: "DELETE" });
    if (res.ok) setComments((await res.json()).comments);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
  };

  const count = comments?.length ?? 0;

  return (
    <div className="comments">
      <div className="cm-head">💬 Bình luận {count > 0 && <span className="cm-count">{count}</span>}</div>

      <div className="cm-list">
        {comments === null ? (
          <div className="cm-empty">Đang tải…</div>
        ) : comments.length === 0 ? (
          <div className="cm-empty">Chưa có bình luận. Hãy là người đầu tiên cổ vũ! 🎉</div>
        ) : (
          comments.map((c) => (
            <div className="cm-item" key={c.id}>
              <Avatar name={c.who.name} url={c.who.avatarUrl} size={30} />
              <div className="cm-body">
                <div className="cm-meta">
                  <b>{c.who.name}</b>
                  <span className="cm-time">{relTime(c.createdAt)}</span>
                  {c.mine && (
                    <button className="cm-del" title="Xoá" onClick={() => del(c.id)}>✕</button>
                  )}
                </div>
                <div className="cm-text">{c.body}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cm-compose">
        <textarea
          ref={taRef}
          rows={2}
          placeholder="Viết bình luận… (⌘/Ctrl + Enter để gửi)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={1000}
        />
        <button className="cm-send" onClick={send} disabled={busy || !text.trim()}>
          {busy ? "…" : "Gửi"}
        </button>
      </div>
    </div>
  );
}
