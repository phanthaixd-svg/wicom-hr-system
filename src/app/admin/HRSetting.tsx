"use client";

import { useState } from "react";
import CampaignsTab from "./CampaignsTab";
import GeneralTab from "./GeneralTab";
import RulesTab from "./RulesTab";
import KindsTab from "./KindsTab";
import ApprovalsTab from "./ApprovalsTab";
import EmployeesTab from "./EmployeesTab";
import WiThanksTab from "./WiThanksTab";
import CardsTab from "./CardsTab";

type TabKey = "employees" | "withanks" | "cards" | "campaigns" | "rules" | "kinds" | "approvals" | "general";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "employees", label: "Nhân sự", icon: "👥" },
  { key: "withanks", label: "Quà & Khoai", icon: "🥔" },
  { key: "cards", label: "Wicer Card", icon: "🎴" },
  { key: "campaigns", label: "Chiến dịch gây quỹ", icon: "🎯" },
  { key: "rules", label: "Quy đổi hoạt động", icon: "🧮" },
  { key: "kinds", label: "Môn tự thêm", icon: "🏸" },
  { key: "approvals", label: "Duyệt hoạt động tay", icon: "✅" },
  { key: "general", label: "Cài đặt chung", icon: "⚙️" },
];

// Panel HR Setting — nhúng thẳng trong AppShell (giữ nguyên rail + sidebar + header trên cùng).
export default function HRSetting({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<TabKey>("employees");

  return (
    <div className="wrap hrset">
      <header className="page-head">
        <h1 className="page-title">⚙️ HR Setting</h1>
        <p className="page-sub">Cấu hình toàn bộ hệ thống HR — nhân sự & phân quyền, khoai & quà, Wicer Card, vận động gây quỹ.</p>
      </header>

      <div className="settabs" role="tablist" aria-label="Nhóm cấu hình">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`settab${tab === t.key ? " on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="hrset-body">
        {tab === "employees" && <EmployeesTab canGrantRoles={isAdmin} />}
        {tab === "withanks" && <WiThanksTab />}
        {tab === "cards" && <CardsTab />}
        {tab === "campaigns" && <CampaignsTab />}
        {tab === "rules" && <RulesTab />}
        {tab === "kinds" && <KindsTab />}
        {tab === "approvals" && <ApprovalsTab />}
        {tab === "general" && <GeneralTab />}
      </div>
    </div>
  );
}
