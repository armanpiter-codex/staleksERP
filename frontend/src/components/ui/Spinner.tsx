import { Loader2 } from "lucide-react";
import clsx from "clsx";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div className="flex justify-center py-16">
      <Loader2
        className={clsx("animate-spin text-staleks-lime", SIZE_CLASSES[size], className)}
      />
    </div>
  );
}
