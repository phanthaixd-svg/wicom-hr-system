/* eslint-disable @next/next/no-img-element */
// Logo Wicom — dùng file gốc (đã cắt sát viền) tại public/wicom-mark.png.
// size = chiều CAO mong muốn (px); chiều rộng tự co theo tỷ lệ ~2:1 của logo.
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <img
      src="/wicom-mark.png"
      alt="Wicom"
      height={size}
      style={{ height: size, width: "auto", flex: "none", display: "block" }}
    />
  );
}
