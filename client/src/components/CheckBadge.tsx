import { cn } from "@/lib/utils";

type CheckBadgeProps = {
  className?: string;
};

export function CheckBadge({ className }: CheckBadgeProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" className="fill-emerald-500" />
      <path
        d="M7.5 12.5l3 3 6-6"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
