import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { computeGoalProgress } from "@/lib/goals";

export const dynamic = "force-dynamic";

const METRICS = ["km", "sessions", "minutes", "vnd"];
const PERIODS = ["week", "month", "quarter"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const goals = await computeGoalProgress(session.employeeId);
  return NextResponse.json({ goals });
}

interface GoalInput {
  sport?: string;
  metric?: string;
  target?: number;
  period?: string;
  label?: string | null;
  remindEveryDays?: number | null;
  remindHour?: number;
}

function sanitize(b: GoalInput) {
  const metric = METRICS.includes(b.metric ?? "") ? b.metric! : "km";
  const period = PERIODS.includes(b.period ?? "") ? b.period! : "week";
  const target = Math.max(0.1, Number(b.target) || 0);
  const sport = (b.sport || "all").slice(0, 40);
  const label = b.label ? String(b.label).slice(0, 60) : null;
  const remindEveryDays =
    b.remindEveryDays == null || Number(b.remindEveryDays) <= 0 ? null : Math.min(90, Math.round(Number(b.remindEveryDays)));
  const remindHour = Math.min(23, Math.max(0, Math.round(Number(b.remindHour ?? 8))));
  return { metric, period, target, sport, label, remindEveryDays, remindHour };
}

// Tạo goal mới.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: GoalInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const data = sanitize(body);
  if (data.target <= 0) return NextResponse.json({ error: "bad-target" }, { status: 400 });

  await prisma.goal.create({ data: { employeeId: session.employeeId, ...data } });
  const goals = await computeGoalProgress(session.employeeId);
  return NextResponse.json({ ok: true, goals });
}

// Cập nhật goal (theo id trong body).
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: GoalInput & { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "missing-id" }, { status: 400 });
  const existing = await prisma.goal.findUnique({ where: { id: body.id } });
  if (!existing || existing.employeeId !== session.employeeId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const data = sanitize(body);
  await prisma.goal.update({ where: { id: body.id }, data });
  const goals = await computeGoalProgress(session.employeeId);
  return NextResponse.json({ ok: true, goals });
}

// Xoá goal.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing-id" }, { status: 400 });
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== session.employeeId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.goal.delete({ where: { id } });
  const goals = await computeGoalProgress(session.employeeId);
  return NextResponse.json({ ok: true, goals });
}
