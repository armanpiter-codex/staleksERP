import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface EmptyStateProps {
  text: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ text, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div className={clsx("py-12 text-center", className)}>
      {Icon && <Icon className="mx-auto mb-3 h-10 w-10 text-gray-300" />}
      <p className="text-sm text-gray-400">{text}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-medium text-staleks-sidebar hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
