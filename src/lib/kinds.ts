import { prisma } from "./db";

// Môn/hoạt động do Admin tự thêm (cầu lông, bóng bàn…). Tách khỏi 7 môn Strava (SPORTS + ConversionRule).
export interface KindLite {
  id: string;
  key: string;
  nameVi: string;
  icon: string;
  mode: string; // 'km' | 'session'
  rateVnd: number;
  capPerDayVnd: number | null;
  requireProof: boolean;
  active: boolean;
  sortOrder: number;
}

// Chuẩn hoá tên -> key không dấu (vd "Cầu lông" -> "cau-long").
export function slugifyKind(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Toàn bộ kind (kể cả tắt) cho trang admin.
export async function getAllKinds(): Promise<KindLite[]> {
  const rows = await prisma.activityKind.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map(toLite);
}

// Kind đang bật (cho form gửi tay).
export async function getActiveKinds(): Promise<KindLite[]> {
  const rows = await prisma.activityKind.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toLite);
}

// Map theo key để tra nhanh (icon/tên/tỷ lệ) khi hiển thị hoạt động gửi tay.
export async function getKindMap(): Promise<Record<string, KindLite>> {
  const rows = await getAllKinds();
  const m: Record<string, KindLite> = {};
  for (const r of rows) m[r.key] = r;
  return m;
}

// Quy đổi 1 hoạt động gửi tay ra tiền theo kind (mode session = cố định/buổi, km = theo quãng đường).
export function computeKindAmount(kind: KindLite | undefined, distanceKm: number): number {
  if (!kind || !kind.active) return 0;
  if (kind.mode === "km") return Math.round(distanceKm * kind.rateVnd);
  return kind.rateVnd; // session
}

function toLite(r: {
  id: string; key: string; nameVi: string; icon: string; mode: string;
  rateVnd: number; capPerDayVnd: number | null; requireProof: boolean; active: boolean; sortOrder: number;
}): KindLite {
  return {
    id: r.id, key: r.key, nameVi: r.nameVi, icon: r.icon, mode: r.mode,
    rateVnd: r.rateVnd, capPerDayVnd: r.capPerDayVnd, requireProof: r.requireProof,
    active: r.active, sortOrder: r.sortOrder,
  };
}
