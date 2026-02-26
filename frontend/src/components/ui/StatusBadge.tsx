import clsx from "clsx";

interface StatusBadgeProps {
  status: string;
  labels: Record<string, string>;
  colors: Record<string, string>;
  className?: string;
}

export function StatusBadge({ status, labels, colors, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors[status] ?? "bg-gray-100 text-gray-700",
        className,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
