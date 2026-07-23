"use client";

import { useState } from "react";
import CampaignsTab from "./CampaignsTab";
import GeneralTab from "./GeneralTab";
import RulesTab from "./RulesTab";
import KindsTab from "./KindsTab";
import ApprovalsTab from "./ApprovalsTab";
import EmployeesTab from "./EmployeesTab";
import WiThanksTab from "./WiThanksTab";
import EconomyTab from "./EconomyTab";
import CardsTab from "./CardsTab";

type SectionKey = "employees" | "withanks" | "economy" | "cards" | "campaigns" | "rules" | "kinds" | "approvals" | "general";
type GroupKey = "employees" | "move" | "withanks" | "cards";

interface Section { key: SectionKey; label: string; icon: string }
interface Group { key: GroupKey; label: string; icon: string; desc: string; sections: Section[] }

// Gom các mục cấu hình theo TÍNH NĂNG để HR không bị rối:
// Nhân sự (dữ liệu gốc) · Move4Wishare (vận động gây quỹ) · WiThanks · Wicer Card.
const GROUPS: Group[] = [
  {
    key: "employees", label: "Nhân sự", icon: "👥",
    desc: "Hồ sơ & phân quyền nhân sự — nguồn dữ liệu gốc, liên kết tới mọi tính năng khác.",
    sections: [{ key: "employees", label: "Danh sách nhân sự", icon: "👥" }],
  },
  {
    key: "move", label: "Move4Wishare", icon: "💪",
    desc: "Vận động gây quỹ: chiến dịch, quy đổi hoạt động, môn tự thêm, duyệt hoạt động tay & cài đặt chung.",
    sections: [
      { key: "campaigns", label: "Chiến dịch gây quỹ", icon: "🎯" },
      { key: "rules", label: "Quy đổi hoạt động", icon: "🧮" },
      { key: "kinds", label: "Môn tự thêm", icon: "🏸" },
      { key: "approvals", label: "Duyệt hoạt động tay", icon: "✅" },
      { key: "general", label: "Cài đặt chung", icon: "⚙️" },
    ],
  },
  {
    key: "withanks", label: "WiThanks", icon: "🥔",
    desc: "Khoai, quà đổi thưởng & quy tắc trao lời cảm ơn.",
    sections: [
      { key: "withanks", label: "Quà & Khoai", icon: "🥔" },
      { key: "economy", label: "Kinh tế khoai", icon: "📊" },
    ],
  },
  {
    key: "cards", label: "Wicer Card", icon: "🎴",
    desc: "Bộ sưu tập thẻ văn hoá — tạo, sửa, phân loại & phát hành thẻ.",
    sections: [{ key: "cards", label: "Quản lý thẻ", icon: "🎴" }],
  },
];

function renderSection(key: SectionKey, isAdmin: boolean) {
  switch (key) {
    case "employees": return <EmployeesTab canGrantRoles={isAdmin} />;
    case "withanks": return <WiThanksTab />;
    case "economy": return <EconomyTab />;
    case "cards": return <CardsTab />;
    case "campaigns": return <CampaignsTab />;
    case "rules": return <RulesTab />;
    case "kinds": return <KindsTab />;
    case "approvals": return <ApprovalsTab />;
    case "general": return <GeneralTab />;
  }
}

// Panel HR Setting — nhúng thẳng trong AppShell (giữ nguyên rail + sidebar + header trên cùng).
export default function HRSetting({ isAdmin }: { isAdmin: boolean }) {
  const [groupKey, setGroupKey] = useState<GroupKey>("employees");
  const [section, setSection] = useState<SectionKey>("employees");

  const group = GROUPS.find((g) => g.key === groupKey)!;
  const hasSub = group.sections.length > 1;

  const selectGroup = (g: Group) => {
    setGroupKey(g.key);
    setSection(g.sections[0].key);
  };

  return (
    <div className="wrap hrset">
      <header className="page-head">
        <h1 className="page-title">⚙️ HR Setting</h1>
        <p className="page-sub">Cấu hình hệ thống HR, gom theo từng tính năng để dễ quản lý.</p>
      </header>

      {/* Nhóm tính năng */}
      <div className="settabs" role="tablist" aria-label="Nhóm tính năng">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            role="tab"
            aria-selected={groupKey === g.key}
            className={`settab${groupKey === g.key ? " on" : ""}`}
            onClick={() => selectGroup(g)}
          >
            <span>{g.icon}</span>
            {g.label}
          </button>
        ))}
      </div>

      <p className="hrset-groupdesc">{group.desc}</p>

      {/* Mục con (chỉ hiện khi nhóm có nhiều mục, vd Move4Wishare) */}
      {hasSub && (
        <div className="subtabs" role="tablist" aria-label={`Mục cấu hình ${group.label}`}>
          {group.sections.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={section === s.key}
              className={`subtab${section === s.key ? " on" : ""}`}
              onClick={() => setSection(s.key)}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="hrset-body">{renderSection(section, isAdmin)}</div>
    </div>
  );
}
