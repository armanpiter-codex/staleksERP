"use client";

import { useCallback, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FeedbackForm } from "./FeedbackForm";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-staleks-lime text-gray-800 shadow-lg hover:bg-staleks-lime/80 transition-all hover:scale-105 active:scale-95"
        title="Обратная связь"
      >
        <MessageSquarePlus className="h-6 w-6" />
      </button>

      {/* Modal */}
      {open && (
        <Modal title="Обратная связь" onClose={handleClose} size="md">
          <FeedbackForm onSuccess={handleClose} />
        </Modal>
      )}
    </>
  );
}
