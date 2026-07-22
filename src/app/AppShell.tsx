"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import Dashboard from "./dashboard/Dashboard";
import MyPage from "./me/MyPage";
import WiThanks from "./withanks/WiThanks";
import WicerHome from "./home/WicerHome";
import HRSetting from "./admin/HRSetting";
import ActivityView from "./activity/[id]/ActivityView";

// Hub "Wicer Board" — 4 tab hằng ngày (1 chạm).
type Tab = "home" | "move" | "withanks" | "wigrow";
// Khu chuyên biệt ở sidebar (records/learn/ai/hrsetting) + "me" = Trang của tôi (mở từ menu avatar)
// + "activity" = xem chi tiết 1 hoạt động (mở từ link Lark). null = đang ở Wicer Board (hub).
type Area = "records" | "learn" | "ai" | "me" | "hrsetting" | "activity";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "home", icon: "🧭", label: "Wicer Home" },
  { key: "move", icon: "💪", label: "Move4Wishare" },
  { key: "withanks", icon: "🥔", label: "WiThanks" },
  { key: "wigrow", icon: "🌱", label: "Wigrow" },
];

// Menu trái (không còn tiêu đề nhóm). Wicer Board mở lại hub 4 tab.
const NAV: { key: "board" | Area; icon: string; label: string; soon?: boolean }[] = [
  { key: "board", icon: "🗂️", label: "Wicer Board" },
  { key: "records", icon: "🗄️", label: "Wicer Records" },
  { key: "learn", icon: "🎓", label: "Wicer Learn", soon: true },
  { key: "ai", icon: "✨", label: "Wicer AI", soon: true },
];

const AREA_INFO: Record<"records" | "learn" | "ai", { icon: string; title: string; desc: string }> = {
  records: { icon: "🗄️", title: "Wicer Records", desc: "Trang đang hoàn thiện. Đây sẽ là nơi lưu trữ hồ sơ nhân sự của bạn." },
  learn: { icon: "🎓", title: "Wicer Learn", desc: "Nơi học tập chung — tổ chức & triển khai các khoá học online của Wicer. Sắp ra mắt." },
  ai: { icon: "✨", title: "Wicer AI", desc: "Nơi Wicer setup AI: tài liệu (docs) & các phần liên quan tới trợ lý AI nội bộ. Sắp ra mắt." },
};

const WIGROW_INFO = {
  icon: "🌱",
  title: "Wigrow",
  desc: "Văn hoá học tập & cải tiến không ngừng — nơi mọi Wicer đề xuất ý tưởng, được ghi nhận và đổi thành khoai. Sắp ra mắt.",
};

export default function AppShell({
  meName,
  avatarUrl,
  isAdmin,
  isHR = false,
  initialTab = "home",
  initialArea = null,
  initialActivityId = null,
}: {
  meName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isHR?: boolean;
  initialTab?: Tab;
  initialArea?: Area | null;
  initialActivityId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [area, setArea] = useState<Area | null>(initialActivityId ? "activity" : initialArea);
  const [activityId, setActivityId] = useState<string | null>(initialActivityId);
  const [navOpen, setNavOpen] = useState(false);
  // Lazy-mount: chỉ dựng panel của tab đã được mở (tránh nạp dữ liệu 3 tab cùng lúc khi vừa vào).
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>([initialTab]));

  const inHub = area === null;
  const canHRSetting = isAdmin || isHR;

  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
    return () => document.body.classList.remove("nav-open");
  }, [navOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Đồng bộ URL ⇄ trạng thái (History API) — để thanh địa chỉ luôn phản ánh đúng trang. ──
  const urlFor = (a: Area | null, t: Tab, act: string | null): string => {
    if (a === "me") return "/me";
    if (a === "activity") return `/activity/${act ?? ""}`;
    if (a === "hrsetting" || a === "records" || a === "learn" || a === "ai") return `/dashboard?area=${a}`;
    return t === "home" ? "/dashboard" : `/dashboard?tab=${t}`;
  };
  const pushUrl = (a: Area | null, t: Tab, act: string | null) => {
    const next = urlFor(a, t, act);
    if (typeof window !== "undefined" && window.location.pathname + window.location.search !== next) {
      window.history.pushState({ a, t, act }, "", next);
    }
  };
  // Back/Forward trình duyệt → khôi phục đúng trạng thái.
  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname;
      const sp = new URLSearchParams(window.location.search);
      const mAct = p.match(/^\/activity\/(.+)$/);
      if (p === "/me") { setArea("me"); }
      else if (mAct) { setActivityId(decodeURIComponent(mAct[1])); setArea("activity"); }
      else {
        const a = sp.get("area");
        if (a === "hrsetting" || a === "records" || a === "learn" || a === "ai") setArea(a as Area);
        else {
          setArea(null);
          const t = sp.get("tab");
          const valid = (["home", "move", "withanks", "wigrow"] as const).includes(t as Tab) ? (t as Tab) : "home";
          setTab(valid);
          setVisited((s) => (s.has(valid) ? s : new Set(s).add(valid)));
        }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Prefetch: khi vào thẳng Wicer Board, sau ~1.5s nạp ngầm 2 tab còn lại để bấm sang là hiện ngay
  // (không phải chờ tải dữ liệu lúc bấm). Không prefetch nếu vào thẳng Trang của tôi / chi tiết hoạt động.
  useEffect(() => {
    if (initialArea !== null || initialActivityId) return;
    const id = setTimeout(() => setVisited(new Set<Tab>(["home", "move", "withanks"])), 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gotoHub = (t?: Tab) => {
    const nextTab = t ?? tab;
    setArea(null);
    if (t) setTab(t);
    setVisited((s) => (s.has(nextTab) ? s : new Set(s).add(nextTab)));
    setNavOpen(false);
    pushUrl(null, nextTab, activityId);
    window.scrollTo({ top: 0 });
  };
  const gotoArea = (a: Area) => {
    setArea(a);
    setNavOpen(false);
    pushUrl(a, tab, activityId);
    window.scrollTo({ top: 0 });
  };
  const onNav = (key: "board" | Area) => (key === "board" ? gotoHub() : gotoArea(key));

  return (
    <div className="app-shell">
      {/* RAIL — chuyển workspace */}
      <aside className="rail" aria-label="Chuyển workspace">
        <div className="rail-mark" title="Wicom"><Logo size={20} /></div>
        <div className="rail-apps">
          <button className="rail-app active" title="HR System" aria-current="page">HR</button>
          <button className="rail-app" title="Sắp có">✦</button>
          <button className="rail-app" title="Thêm workspace">＋</button>
        </div>
        <div className="rail-foot">
          <button className="rail-app" title="Trợ giúp">?</button>
        </div>
      </aside>

      {/* SIDEBAR */}
      <nav className="sidebar" aria-label="Điều hướng">
        <button className="sb-head sb-home" onClick={() => gotoHub()} title="Về Wicer Board">
          <div className="sb-logo">HR</div>
          <div><b>HR System</b><small>Wicom Workspace</small></div>
        </button>
        <div className="sb-group">
          {NAV.map((s) => {
            const active = s.key === "board" ? inHub : area === s.key;
            return (
              <a
                key={s.key}
                className={`sb-item${active ? " active" : ""}`}
                onClick={() => onNav(s.key)}
                role="button"
                tabIndex={0}
              >
                <span className="ic">{s.icon}</span> {s.label}
                {s.soon && <span className="sb-soon">Sắp có</span>}
              </a>
            );
          })}
          {canHRSetting && (
            <a className={`sb-item sb-hr${area === "hrsetting" ? " active" : ""}`} onClick={() => gotoArea("hrsetting")} role="button" tabIndex={0}>
              <span className="ic">⚙️</span> HR Setting
            </a>
          )}
        </div>
      </nav>
      <div className={`drawer-bg${navOpen ? " show" : ""}`} onClick={() => setNavOpen(false)} />

      {/* MAIN */}
      <div className="maincol">
        <header className="wb-top">
          <div className="top-in">
            <button className="hamb" onClick={() => setNavOpen((v) => !v)} aria-label="Mở menu" aria-expanded={navOpen}>☰</button>
            <button className="wb-brand" onClick={() => gotoHub()} title="Về Wicer Board">
              <Logo size={28} />
              <div className="wb-brand-tx">
                Wicer
                <small>Wicom · HR System</small>
              </div>
            </button>
            <div className="top-spacer" />
            <UserMenu meName={meName} avatarUrl={avatarUrl} isAdmin={canHRSetting} onGoMe={() => gotoArea("me")} />
          </div>

          {inHub && (
            <nav className="wb-tabbar" aria-label="Wicer Board">
              {TABS.map((t) => (
                <a
                  key={t.key}
                  className={`wb-tab${tab === t.key ? " active" : ""}`}
                  onClick={() => gotoHub(t.key)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="wb-tab-ic">{t.icon}</span> {t.label}
                </a>
              ))}
            </nav>
          )}
        </header>

        {inHub ? (
          <>
            {visited.has("home") && (
              <div className="wb-panel" hidden={tab !== "home"}>
                <WicerHome />
              </div>
            )}
            {visited.has("move") && (
              <div className="wb-panel" hidden={tab !== "move"}>
                <Dashboard />
              </div>
            )}
            {visited.has("withanks") && (
              <div className="wb-panel" hidden={tab !== "withanks"}>
                <WiThanks />
              </div>
            )}
            {tab === "wigrow" && (
              <div className="wb-ph">
                <div className="wbph-card">
                  <div className="wbph-ic">{WIGROW_INFO.icon}</div>
                  <h2>{WIGROW_INFO.title}</h2>
                  <p className="lead">{WIGROW_INFO.desc}</p>
                </div>
              </div>
            )}
          </>
        ) : area === "me" ? (
          <div className="wb-panel"><MyPage /></div>
        ) : area === "hrsetting" ? (
          <div className="wb-panel">{canHRSetting ? <HRSetting isAdmin={isAdmin} /> : null}</div>
        ) : area === "activity" ? (
          <div className="wb-panel">
            <div className="wrap">
              <div className="toolbar" style={{ marginBottom: 4 }}>
                <a className="conn" onClick={() => gotoHub("move")} role="button" tabIndex={0}>← Về Bảng tin</a>
              </div>
              <ActivityView id={activityId ?? ""} idPrefix="page" />
            </div>
          </div>
        ) : (
          <div className="wb-ph">
            <div className="wbph-card">
              <div className="wbph-ic">{AREA_INFO[area as "records" | "learn" | "ai"].icon}</div>
              <h2>{AREA_INFO[area as "records" | "learn" | "ai"].title}</h2>
              <p className="lead">{AREA_INFO[area as "records" | "learn" | "ai"].desc}</p>
              <button className="btn-cancel" style={{ marginTop: 18 }} onClick={() => gotoHub()}>← Về Wicer Board</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
