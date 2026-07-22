import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ⚠️ DEV ONLY — trang đăng nhập nhanh để test ở local (không cần Lark).
// Tự 404 trên production (Vercel) → không tồn tại trên staging/prod.
export default async function DevLoginPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const emps = await prisma.employee.findMany({
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, team: true, isAdmin: true, isHR: true, larkOpenId: true, khoaiBalance: true },
    take: 100,
  });

  const realOpenId = (o: string | null) => !!o && !o.startsWith("demo") && !o.startsWith("seed");

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>🛠️ Dev Login <span style={{ fontSize: 13, fontWeight: 400, color: "#c0392b" }}>(chỉ chạy ở local)</span></h1>
      <p style={{ color: "#555", fontSize: 14, marginTop: 0 }}>
        Bấm "Đăng nhập" để vào app như nhân sự đó — không cần Lark. Cột <b>Lark</b> cho biết nhân sự đã gắn <code>open_id</code> thật chưa (để nhận notification thật).
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
            <th style={{ padding: "8px 6px" }}>Nhân sự</th>
            <th style={{ padding: "8px 6px" }}>Quyền</th>
            <th style={{ padding: "8px 6px" }}>🥔</th>
            <th style={{ padding: "8px 6px" }}>Lark</th>
            <th style={{ padding: "8px 6px" }}></th>
          </tr>
        </thead>
        <tbody>
          {emps.map((e) => (
            <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "8px 6px" }}>
                <b>{e.name}</b>
                <div style={{ color: "#999", fontSize: 12 }}>{e.email ?? "—"}{e.team ? ` · ${e.team}` : ""}</div>
              </td>
              <td style={{ padding: "8px 6px", fontSize: 12 }}>
                {e.isAdmin ? "🛡️ Admin" : e.isHR ? "👔 HR" : "Member"}
              </td>
              <td style={{ padding: "8px 6px", fontVariantNumeric: "tabular-nums" }}>{e.khoaiBalance}</td>
              <td style={{ padding: "8px 6px" }}>
                {realOpenId(e.larkOpenId)
                  ? <span title={e.larkOpenId ?? ""} style={{ color: "#1f9d6b", fontSize: 12 }}>● thật</span>
                  : <span style={{ color: "#bbb", fontSize: 12 }}>○ demo</span>}
              </td>
              <td style={{ padding: "8px 6px", textAlign: "right" }}>
                <a href={`/api/dev/login?id=${e.id}`} style={{ background: "#1A4565", color: "#fff", padding: "6px 14px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                  Đăng nhập →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
