"use client";

import React from "react";

// ── Button dùng chung ───────────────────────────────────────────────────────
// Chuẩn hoá các nút hành động (primary/secondary/ghost/danger) trong form & modal.
// Nút "bespoke" có thiết kế riêng (hero CTA, segment, refresh…) vẫn giữ class riêng.
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export default function Button({
  variant = "primary",
  size = "md",
  tone,
  className = "",
  type = "button",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  /** Sắc thái riêng cho primary: "super" (tím) / "special" (cam). */
  tone?: "super" | "special";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    "ui-btn",
    `ui-btn-${variant}`,
    size === "sm" ? "ui-btn-sm" : "",
    tone ? `ui-btn-${tone}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
