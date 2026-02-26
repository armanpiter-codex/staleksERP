"use client";

import { Modal } from "./Modal";
import clsx from "clsx";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRM_CLASSES = {
  danger: "bg-staleks-error text-white hover:opacity-90",
  primary: "bg-staleks-lime text-staleks-sidebar hover:opacity-90",
};

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Подтвердить",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium",
              CONFIRM_CLASSES[confirmVariant],
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  );
}
