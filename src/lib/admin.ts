import { prisma } from "./db";
import { getSession } from "./session";
import type { Employee } from "@prisma/client";

// Bootstrap admin: email nằm trong ADMIN_EMAILS (phân tách bằng dấu phẩy) sẽ tự được cấp quyền admin khi đăng nhập.
// Dùng để "mồi" admin đầu tiên trên DB sạch (production) mà không phải chạy SQL tay.
export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

// Trả về Employee nếu phiên hiện tại là admin (kiểm tra cờ trong DB, không tin mỗi JWT).
export async function requireAdmin(): Promise<Employee | null> {
  const session = await getSession();
  if (!session) return null;
  const emp = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  return emp?.isAdmin ? emp : null;
}

// Trả về Employee nếu phiên là admin HOẶC HR — dùng gác quyền vào HR Setting.
// (Cấp/thu quyền cho người khác vẫn phải là admin thật — dùng requireAdmin cho việc đó.)
export async function requireHR(): Promise<Employee | null> {
  const session = await getSession();
  if (!session) return null;
  const emp = await prisma.employee.findUnique({ where: { id: session.employeeId } });
  return emp && (emp.isAdmin || emp.isHR) ? emp : null;
}
