import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import AppShell from "../AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; area?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");

  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { stravaAccount: true },
  });
  if (!emp) redirect("/");
  // Strava là tuỳ chọn: user có thể bỏ qua ở bước /connect và kết nối sau trong "Trang của tôi".

  // Deep-link ?tab=… (từ notification Lark) mở thẳng tab tương ứng; mặc định Wicer Home.
  const { tab, area } = await searchParams;
  const tabs = ["home", "move", "withanks", "wigrow"] as const;
  const initialTab = (tabs as readonly string[]).includes(tab ?? "") ? (tab as (typeof tabs)[number]) : "home";
  // Deep-link ?area=… (reload/chia sẻ link các khu chuyên biệt) mở đúng khu đó.
  const areas = ["records", "learn", "ai", "hrsetting"] as const;
  const initialArea = (areas as readonly string[]).includes(area ?? "") ? (area as (typeof areas)[number]) : null;

  return <AppShell meName={session.name} avatarUrl={emp.avatarUrl} isAdmin={emp.isAdmin} isHR={emp.isHR} initialTab={initialTab} initialArea={initialArea} />;
}
