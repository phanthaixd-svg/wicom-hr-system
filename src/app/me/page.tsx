import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import AppShell from "../AppShell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/");

  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { stravaAccount: true },
  });
  if (!emp) redirect("/");
  // Strava là tuỳ chọn — không ép kết nối; user tự kết nối trong ConnectApps của MyPage.

  // "Trang của tôi" (menu avatar) mở thẳng trang hồ sơ cá nhân (MyPage).
  return <AppShell meName={session.name} avatarUrl={emp.avatarUrl} isAdmin={emp.isAdmin} isHR={emp.isHR} initialArea="me" />;
}
