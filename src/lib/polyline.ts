// Giải mã Google encoded polyline + dựng path SVG tuyến gọn (cho thumbnail bảng tin).

export function decodePolyline(str: string): number[][] {
  let index = 0, lat = 0, lng = 0;
  const coords: number[][] = [];
  while (index < str.length) {
    let b: number, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

// Giảm mẫu mảng điểm về tối đa n điểm (giữ điểm đầu/cuối) — payload nhỏ.
function downsamplePts(pts: number[][], n: number): number[][] {
  if (pts.length <= n) return pts;
  const out: number[][] = [];
  const step = (pts.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

// encoded polyline -> chuỗi 'd' vừa khung wxh (giữ tỉ lệ, canh giữa, bắc lên trên).
export function encodedToSvgPath(encoded: string | null | undefined, w = 96, h = 64, pad = 5): string | null {
  if (!encoded) return null;
  let pts: number[][];
  try { pts = decodePolyline(encoded); } catch { return null; }
  if (pts.length < 2) return null;
  pts = downsamplePts(pts, 64);

  let minLa = Infinity, maxLa = -Infinity, minLo = Infinity, maxLo = -Infinity;
  for (const [la, lo] of pts) {
    if (la < minLa) minLa = la; if (la > maxLa) maxLa = la;
    if (lo < minLo) minLo = lo; if (lo > maxLo) maxLo = lo;
  }
  // Kinh độ co lại theo vĩ độ để hình không méo.
  const cos = Math.cos(((minLa + maxLa) / 2) * Math.PI / 180) || 1;
  const spanLo = (maxLo - minLo) * cos || 1e-6;
  const spanLa = (maxLa - minLa) || 1e-6;
  const scale = Math.min((w - 2 * pad) / spanLo, (h - 2 * pad) / spanLa);
  const offX = (w - spanLo * scale) / 2;
  const offY = (h - spanLa * scale) / 2;
  return pts.map((p, i) => {
    const x = offX + (p[1] - minLo) * cos * scale;
    const y = offY + (maxLa - p[0]) * scale;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
