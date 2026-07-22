"use client";

import { useEffect, useState } from "react";

// JSSDK của Lark quốc tế (larksuite). Nếu Lark báo sai URL, thay bằng đúng link trong
// tài liệu "Web App / H5" của app trong Developer Console — code vẫn tự fallback về nút login.
const JSSDK_URL =
  process.env.NEXT_PUBLIC_LARK_JSSDK_URL ||
  "https://lf16-scmcdn-sg.feishucdn.com/goofy/lark/op/h5-js-sdk-1.5.35.js";

// Có đang chạy TRONG Lark không? (webview Lark/Feishu gắn dấu hiệu trong userAgent)
function inLark(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Lark|Feishu/i.test(navigator.userAgent);
}

interface H5Win {
  h5sdk?: { ready: (cb: () => void) => void; error?: (cb: (e: unknown) => void) => void };
  tt?: { requestAuthCode: (o: { appId: string; success: (r: { code: string }) => void; fail: (e: unknown) => void }) => void };
}

// Khi app mở trong Lark: tự lấy code đăng nhập → đổi session → vào thẳng, không cần bấm gì.
// Ngoài Lark (trình duyệt thường): không làm gì, để nút "Đăng nhập với Lark" hoạt động như cũ.
export default function LarkAutoLogin({ appId }: { appId: string }) {
  const [status, setStatus] = useState<"idle" | "trying" | "failed">("idle");

  useEffect(() => {
    if (!appId || !inLark()) return;
    setStatus("trying");
    let done = false;

    const start = () => {
      const w = window as unknown as H5Win;
      if (!w.h5sdk || !w.tt) { setStatus("failed"); return; }
      w.h5sdk.error?.(() => setStatus("failed"));
      w.h5sdk.ready(() => {
        w.tt!.requestAuthCode({
          appId,
          success: async (res) => {
            try {
              const r = await fetch("/api/auth/lark/silent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: res.code }),
              });
              const j = await r.json();
              if (j.ok) { done = true; window.location.href = j.next || "/dashboard"; }
              else setStatus("failed");
            } catch { setStatus("failed"); }
          },
          fail: () => setStatus("failed"),
        });
      });
    };

    // Nạp JSSDK (chỉ 1 lần).
    const existing = document.getElementById("lark-h5-sdk");
    if (existing) { start(); }
    else {
      const s = document.createElement("script");
      s.id = "lark-h5-sdk";
      s.src = JSSDK_URL;
      s.onload = start;
      s.onerror = () => setStatus("failed");
      document.head.appendChild(s);
    }

    const t = setTimeout(() => { if (!done) setStatus((v) => (v === "trying" ? "failed" : v)); }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  if (status === "trying") return <div className="demo-note">🔐 Đang tự đăng nhập qua Lark…</div>;
  return null;
}
