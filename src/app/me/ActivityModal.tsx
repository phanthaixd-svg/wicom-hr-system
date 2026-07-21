"use client";

import Modal from "@/components/ui/Modal";
import ActivityView from "../activity/[id]/ActivityView";

// Modal xem chi tiết hoạt động ngay tại trang, không điều hướng.
export default function ActivityModal({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose} panelClassName="wrap">
      <ActivityView id={id} idPrefix={`m-${id}`} />
    </Modal>
  );
}
