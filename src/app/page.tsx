import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Logo from "./Logo";
import LarkAutoLogin from "./LarkAutoLogin";

const ERRORS: Record<string, string> = {
  state: "Phiên đăng nhập không hợp lệ, vui lòng thử lại.",
  tenant: "Tài khoản Lark này không thuộc tổ chức Wicom.",
  nouser: "Không lấy được thông tin tài khoản từ Lark.",
  lark: "Có lỗi khi kết nối Lark. Vui lòng thử lại.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    const emp = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      include: { stravaAccount: true },
    });
    redirect(emp?.stravaAccount && !emp.stravaAccount.revokedAt ? "/dashboard" : "/connect");
  }

  const { error } = await searchParams;

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <Logo size={40} />
          <span style={{ textAlign: "left" }}>
            <b>Move for Wishare</b>
            <small>Cổng vận động gây quỹ nội bộ</small>
          </span>
        </div>
        <div className="steps">
          <i className="on" />
          <i />
          <i />
        </div>
        <h2>Đăng nhập</h2>
        <p className="s">
          Dùng tài khoản Lark của Wicom để vào cổng. Chỉ nhân sự công ty mới truy cập được.
        </p>
        {error && <div className="err">{ERRORS[error] ?? "Đã có lỗi xảy ra."}</div>}
        {/* Mở trong Lark → tự đăng nhập (免登). Ngoài Lark → không hiện gì, dùng nút bên dưới. */}
        <LarkAutoLogin appId={process.env.LARK_CLIENT_ID ?? ""} />
        <a className="btn btn-lark" href="/api/auth/lark">
          <span className="ico-lark">L</span>Đăng nhập với Lark
        </a>
        <div className="demo-note">🔒 Truy cập an toàn qua SSO Lark của Wicom.</div>
      </div>
    </div>
  );
}
