import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={cn("size-7", className)}
      role="img"
      aria-label="Fraxillion mark"
    >
      <rect x="1.5" y="1.5" width="10.5" height="10.5" rx="2.5" fill="currentColor" />
      <rect x="15" y="1.5" width="10.5" height="10.5" rx="2.5" fill="currentColor" opacity="0.38" />
      <rect x="1.5" y="15" width="10.5" height="10.5" rx="2.5" fill="currentColor" opacity="0.38" />
      <path d="M12 6.75h3M6.75 12v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      <rect x="15" y="15" width="10.5" height="10.5" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label="Fraxillion v2 home"
    >
      <LogoMark className="text-accent transition-transform duration-200 group-hover:rotate-90" />
      {!compact ? (
        <span className="text-[17px] font-semibold tracking-[-0.035em]">
          fraxillion
          <span className="ml-0.5 align-super font-mono text-[8px] font-normal tracking-normal text-ink-3">v2</span>
        </span>
      ) : null}
    </Link>
  );
}
