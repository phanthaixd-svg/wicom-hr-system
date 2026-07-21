"use client";

import { useEffect } from "react";
import ActivityView from "../activity/[id]/ActivityView";

// Modal xem chi tiết hoạt động ngay tại trang, không điều hướng.
export default function ActivityModal({ id, onClose }: { id: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel wrap" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <ActivityView id={id} idPrefix={`m-${id}`} />
      </div>
    </div>
  );
}
