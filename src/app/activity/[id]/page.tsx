import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import ActivityDetail from "./ActivityDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { avatarUrl: true, isAdmin: true },
  });
  return <ActivityDetail id={id} meName={session.name} avatarUrl={emp?.avatarUrl ?? null} isAdmin={emp?.isAdmin ?? false} />;
}
