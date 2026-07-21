"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Modal dùng chung cho toàn app ──────────────────────────────────────────
// Thay cho pattern lặp lại "modal-overlay + modal-panel + modal-close" ở ~13 chỗ.
// Xử lý chuẩn: Escape (đóng đúng lớp trên cùng khi lồng nhau), khoá cuộn nền
// (đếm tham chiếu để modal lồng nhau không mở khoá sớm), click nền để đóng.

// Stack các modal đang mở — Escape chỉ đóng modal trên cùng.
const escStack: Array<() => void> = [];
let scrollLocks = 0;

function lockScroll() {
  if (scrollLocks === 0) document.body.style.overflow = "hidden";
  scrollLocks++;
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = "";
}

export default function Modal({
  onClose,
  panelClassName = "",
  className = "",
  labelledBy,
  closeOnBackdrop = true,
  children,
}: {
  onClose: () => void;
  /** Class biến thể cho panel, vd "gt-panel", "profile-panel". */
  panelClassName?: string;
  /** Class thêm cho overlay. */
  className?: string;
  labelledBy?: string;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Render qua portal ra <body> để modal không bị "nhốt" trong stacking context
  // của phần tử cha (vd .m4-side dùng position:sticky) làm header đè lên popup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = () => closeRef.current();
    escStack.push(handler);
    lockScroll();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escStack[escStack.length - 1] === handler) {
        e.stopPropagation();
        handler();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      const i = escStack.indexOf(handler);
      if (i >= 0) escStack.splice(i, 1);
      document.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`modal-overlay${className ? " " + className : ""}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`modal-panel${panelClassName ? " " + panelClassName : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
