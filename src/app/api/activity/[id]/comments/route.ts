import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { larkNotifyEnabled, notifyComment } from "@/lib/larkNotify";

export const dynamic = "force-dynamic";

async function listComments(activityId: string, meId: string) {
  const rows = await prisma.comment.findMany({
    where: { activityId },
    orderBy: { createdAt: "asc" },
    include: { employee: { select: { id: true, name: true, avatarUrl: true, team: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    mine: c.employeeId === meId,
    who: { id: c.employee.id, name: c.employee.name, avatarUrl: c.employee.avatarUrl, team: c.employee.team ?? "Wicom" },
  }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ comments: await listComments(id, session.employeeId) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body = "";
  try {
    body = String((await req.json()).body ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (body.length > 1000) body = body.slice(0, 1000);

  const act = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, employee: { select: { id: true, name: true, larkOpenId: true } } },
  });
  if (!act) return NextResponse.json({ error: "notfound" }, { status: 404 });

  await prisma.comment.create({ data: { activityId: id, employeeId: session.employeeId, body } });

  // Bắn Lark cho chủ hoạt động (bỏ qua nếu tự bình luận bài của mình).
  if (act.employee.id !== session.employeeId && larkNotifyEnabled() && act.employee.larkOpenId) {
    void notifyComment({
      ownerOpenId: act.employee.larkOpenId,
      commenterName: session.name,
      activityName: act.name || act.type,
      activityId: act.id,
      body,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, comments: await listComments(id, session.employeeId) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "missing-id" }, { status: 400 });

  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!c) return NextResponse.json({ error: "notfound" }, { status: 404 });
  // Chỉ tác giả hoặc admin được xoá.
  if (c.employeeId !== session.employeeId && !session.isAdmin)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true, comments: await listComments(id, session.employeeId) });
}
