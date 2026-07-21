import React from "react";

// ── Card dùng chung ─────────────────────────────────────────────────────────
// Bọc pattern ".card" (nền surface + viền + bo góc) để dùng nhất quán.
export default function Card({
  className = "",
  as: Tag = "section",
  children,
  ...rest
}: {
  className?: string;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`card${className ? " " + className : ""}`} {...rest}>
      {children}
    </Tag>
  );
}
