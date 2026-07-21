import React from "react";

// ── Field dùng chung ────────────────────────────────────────────────────────
// Bọc pattern ".fld": nhãn (+ gợi ý/đếm ký tự tuỳ chọn) đặt trên control.
// Dùng <label> khi có 1 control để bấm nhãn focus được; dùng <div> khi nhóm nút.
export default function Field({
  label,
  hint,
  aside,
  as: Tag = "label",
  className = "",
  children,
}: {
  label?: React.ReactNode;
  /** Chữ phụ nhỏ cạnh nhãn (vd "tối đa 3"). */
  hint?: React.ReactNode;
  /** Nội dung căn phải trên hàng nhãn (vd bộ đếm ký tự). */
  aside?: React.ReactNode;
  as?: "label" | "div";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={`fld${className ? " " + className : ""}`}>
      {(label || aside) && (
        <span className="fld-lb">
          {label}
          {hint && <small className="fld-hint">{hint}</small>}
          {aside && <span className="fld-aside">{aside}</span>}
        </span>
      )}
      {children}
    </Tag>
  );
}
