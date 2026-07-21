import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import AppShell from "../AppShell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/");

  // Admin HOẶC HR mới vào được HR Setting.
  const emp = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  if (!emp?.isAdmin && !emp?.isHR) redirect("/dashboard");

  // Mở thẳng khu HR Setting NHƯNG vẫn trong khung app (rail + sidebar + header trên cùng).
  return <AppShell meName={session.name} avatarUrl={emp.avatarUrl} isAdmin={emp.isAdmin} isHR={emp.isHR} initialArea="hrsetting" />;
}
