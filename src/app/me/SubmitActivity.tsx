"use client";

import { useEffect, useRef, useState } from "react";

interface Kind { key: string; nameVi: string; icon: string; mode: string; rateVnd: number; requireProof: boolean }

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function SubmitActivity({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [kindKey, setKindKey] = useState("");
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/kinds", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { kinds: [] }))
      .then((j) => {
        setKinds(j.kinds ?? []);
        if (j.kinds?.[0]) setKindKey((prev) => prev || j.kinds[0].key);
      });
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const kind = kinds.find((k) => k.key === kindKey);

  const reset = () => {
    setName(""); setDurationMin(""); setDistanceKm(""); setOccurredAt(nowLocalInput());
    setNote(""); setProofUrl(null); setErr(""); setDone(false);
  };

  const upload = async (file: File) => {
    setUploading(true);
    setErr("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) setProofUrl((await res.json()).url);
    else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error === "too-large" ? "Ảnh quá lớn (tối đa 8MB)." : j.error === "bad-type" ? "Chỉ nhận ảnh (jpg/png/webp)." : "Tải ảnh thất bại.");
    }
  };

  const submit = async () => {
    setErr("");
    if (!kindKey) return setErr("Chọn bộ môn.");
    if (!durationMin && !distanceKm) return setErr("Nhập thời gian hoặc quãng đường.");
    if (kind?.requireProof && !proofUrl) return setErr("Môn này cần tải bằng chứng.");
    setBusy(true);
    const res = await fetch("/api/me/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kindKey,
        name: name.trim() || undefined,
        durationMin: Number(durationMin) || 0,
        distanceKm: Number(distanceKm) || 0,
        occurredAt,
        note: note.trim() || undefined,
        proofUrl,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      onDone();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.message || "Gửi thất bại. Thử lại nhé.");
    }
  };

  return (
    <>
      <button className="submit-act-btn" onClick={() => setOpen(true)}>+ Gửi hoạt động tay</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel submit-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>

            {done ? (
              <div className="submit-done">
                <div className="sd-ico">✅</div>
                <h3>Đã gửi!</h3>
                <p className="sub">Hoạt động của bạn đang chờ Admin duyệt. Được duyệt sẽ tự quy đổi vào quỹ.</p>
                <div className="submit-done-actions">
                  <button className="btn-save-goal" onClick={() => { reset(); }}>Gửi tiếp</button>
                  <button className="btn-cancel" onClick={() => setOpen(false)}>Đóng</button>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ marginBottom: 4 }}>Gửi hoạt động tay</h3>
                <p className="sub" style={{ marginBottom: 16 }}>
                  Dành cho môn Strava không ghi được (cầu lông, bóng bàn…). Kèm bằng chứng để Admin duyệt.
                </p>

                {kinds.length === 0 ? (
                  <div className="act-empty" style={{ display: "block" }}>
                    Admin chưa cấu hình môn nào. Nhờ Admin thêm trong “Hoạt động tự thêm” nhé.
                  </div>
                ) : (
                  <div className="submit-form">
                    <label className="fld">
                      <span>Bộ môn</span>
                      <select value={kindKey} onChange={(e) => setKindKey(e.target.value)}>
                        {kinds.map((k) => (
                          <option key={k.key} value={k.key}>{k.icon} {k.nameVi}</option>
                        ))}
                      </select>
                    </label>

                    <label className="fld">
                      <span>Tên buổi tập (tuỳ chọn)</span>
                      <input placeholder={kind ? `vd. ${kind.nameVi} chiều thứ 4` : ""} value={name} onChange={(e) => setName(e.target.value)} />
                    </label>

                    <div className="gf-row">
                      <label className="fld">
                        <span>Thời gian (phút)</span>
                        <input type="number" min={0} placeholder="vd. 45" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
                      </label>
                      <label className="fld">
                        <span>Quãng đường (km, nếu có)</span>
                        <input type="number" min={0} step="any" placeholder="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
                      </label>
                    </div>

                    <label className="fld">
                      <span>Thời điểm</span>
                      <input type="datetime-local" value={occurredAt} max={nowLocalInput()} onChange={(e) => setOccurredAt(e.target.value)} />
                    </label>

                    <label className="fld">
                      <span>Ghi chú (tuỳ chọn)</span>
                      <textarea rows={2} placeholder="Mô tả ngắn…" value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>

                    <div className="fld">
                      <span>Bằng chứng {kind?.requireProof ? "(bắt buộc)" : "(tuỳ chọn)"}</span>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) upload(f);
                        }}
                      />
                      {proofUrl ? (
                        <div className="proof-preview">
                          <img src={proofUrl} alt="Bằng chứng" />
                          <button className="proof-remove" onClick={() => setProofUrl(null)}>Bỏ ảnh</button>
                        </div>
                      ) : (
                        <button className="proof-upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          {uploading ? "Đang tải…" : "📷 Chọn ảnh (jpg/png, ≤8MB)"}
                        </button>
                      )}
                    </div>

                    {err && <div className="submit-err">{err}</div>}

                    <div className="goal-form-actions">
                      <button className="btn-cancel" onClick={() => setOpen(false)}>Huỷ</button>
                      <button className="btn-save-goal" onClick={submit} disabled={busy || uploading}>
                        {busy ? "Đang gửi…" : "Gửi để duyệt"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
