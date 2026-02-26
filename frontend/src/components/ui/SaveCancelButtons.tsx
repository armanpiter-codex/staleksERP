import { Check, Loader2 } from "lucide-react";
import clsx from "clsx";

interface SaveCancelButtonsProps {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  size?: "sm" | "md";
  saveLabel?: string;
}

export function SaveCancelButtons({
  onSave,
  onCancel,
  saving,
  size = "md",
  saveLabel = "Сохранить",
}: SaveCancelButtonsProps) {
  const sz = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={onSave}
        disabled={saving}
        className={clsx(
          "flex items-center gap-1.5 rounded-lg bg-staleks-lime font-medium text-staleks-sidebar hover:opacity-90 disabled:opacity-50",
          sz,
        )}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        {saveLabel}
      </button>
      <button
        onClick={onCancel}
        className={clsx(
          "rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50",
          sz,
        )}
      >
        Отмена
      </button>
    </div>
  );
}
