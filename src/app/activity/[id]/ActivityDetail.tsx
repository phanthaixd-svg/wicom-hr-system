"use client";

import AppHeader from "../../AppHeader";
import ActivityView from "./ActivityView";

export default function ActivityDetail({
  id,
  meName,
  avatarUrl,
  isAdmin,
}: {
  id: string;
  meName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}) {
  return (
    <>
      <AppHeader meName={meName} avatarUrl={avatarUrl} isAdmin={isAdmin} />
      <div className="wrap">
        <div className="toolbar" style={{ marginBottom: 4 }}>
          <a className="conn" href="/me">← Về Trang của tôi</a>
        </div>
        <ActivityView id={id} idPrefix="page" />
      </div>
    </>
  );
}
