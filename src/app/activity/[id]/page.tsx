import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import AppShell from "../../AppShell";

export const dynamic = "force-dynamic";

// Link chi tiết hoạt động (mở từ Lark) — nay hiển thị trong shell đầy đủ (rail + sidebar + header),
// giống mọi trang khác thay vì header cũ rời rạc.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { avatarUrl: true, isAdmin: true, isHR: true },
  });
  return (
    <AppShell
      meName={session.name}
      avatarUrl={emp?.avatarUrl ?? null}
      isAdmin={emp?.isAdmin ?? false}
      isHR={emp?.isHR ?? false}
      initialActivityId={id}
    />
  );
}
