import { X } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onClose: () => void;
}

export function ErrorAlert({ message, onClose }: ErrorAlertProps) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
      {message}
      <button onClick={onClose} className="ml-2 text-red-400 hover:text-red-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
