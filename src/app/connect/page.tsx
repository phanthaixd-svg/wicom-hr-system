import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Logo from "../Logo";

const ERRORS: Record<string, string> = {
  denied: "Bạn đã từ chối cấp quyền Strava. Cần cấp quyền để tham gia gây quỹ.",
  scope: "Vui lòng tích chọn quyền đọc hoạt động khi cấp quyền Strava.",
  state: "Phiên không hợp lệ, vui lòng thử lại.",
  strava: "Có lỗi khi kết nối Strava. Vui lòng thử lại.",
  noathlete: "Không lấy được thông tin vận động viên từ Strava.",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { stravaAccount: true },
  });
  if (emp?.stravaAccount && !emp.stravaAccount.revokedAt) redirect("/dashboard");

  const { error } = await searchParams;
  const firstName = session.name.split(" ").slice(-1)[0];

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <Logo size={40} />
          <span style={{ textAlign: "left" }}>
            <b>Move for Wishare</b>
            <small>Xin chào, {session.name}</small>
          </span>
        </div>
        <div className="steps">
          <i className="on" />
          <i className="on" />
          <i />
        </div>
        <div className="avatar-demo">◈</div>
        <h2>Kết nối Strava</h2>
        <p className="s">
          {firstName} ơi, cấp quyền để hệ thống tự nhận hoạt động tập luyện và quy đổi thành quỹ.
        </p>
        {error && <div className="err">{ERRORS[error] ?? "Đã có lỗi xảy ra."}</div>}
        <div className="perm">
          <h4>Move for Wishare sẽ được phép</h4>
          <li>Đọc hoạt động của bạn (quãng đường, thời gian, môn)</li>
          <li>Nhận hoạt động mới tự động qua Strava</li>
          <li>Không đăng bài, không sửa dữ liệu của bạn</li>
        </div>
        <a className="btn btn-strava" href="/api/strava/connect">
          ⛰️ Cấp quyền với Strava
        </a>
        <div className="demo-note">Bạn có thể ngắt kết nối bất cứ lúc nào trong phần Cài đặt.</div>
      </div>
    </div>
  );
}
