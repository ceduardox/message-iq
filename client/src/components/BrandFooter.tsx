import { cn } from "@/lib/utils";

type BrandFooterProps = {
  className?: string;
};

export function BrandFooter({ className }: BrandFooterProps) {
  return (
    <footer className={cn("text-center text-xs text-slate-500", className)}>
      Developed by{" "}
      <a
        href="https://neraversestudio.com/es/"
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-emerald-400 transition-colors hover:text-cyan-400"
      >
        Neraverse Studios
      </a>
    </footer>
  );
}
