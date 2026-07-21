import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const OK_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
};

// Tải bằng chứng cho hoạt động gửi tay. Lưu vào public/uploads (demo).
// ⚠️ Production (Vercel serverless FS tạm thời) nên chuyển sang S3/R2 — xem README.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no-file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too-large", maxMb: 8 }, { status: 400 });
  const ext = OK_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "bad-type" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const fname = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, fname), buf);

  return NextResponse.json({ ok: true, url: `/uploads/${fname}` });
}
