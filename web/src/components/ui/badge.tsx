import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 text-ink-2",
        accent: "border-accent/25 bg-accent-soft text-accent-ink",
        critical: "border-critical/25 bg-critical-soft text-critical",
        high: "border-high/25 bg-high-soft text-high",
        medium: "border-medium/25 bg-medium-soft text-medium",
        low: "border-low/25 bg-low-soft text-low",
        cleared: "border-cleared/25 bg-cleared-soft text-cleared",
        verified: "border-verified/25 bg-verified-soft text-verified",
        mismatch: "border-mismatch/30 bg-mismatch-soft text-mismatch",
        pending: "border-pending/25 bg-pending-soft text-pending",
        outline: "border-border-strong bg-transparent text-ink-2",
      },
      size: {
        sm: "px-1.5 text-[10px]",
        md: "",
        lg: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export const SEVERITY_TONE: Record<Severity, NonNullable<BadgeProps["tone"]>> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

const SEVERITY_MARK: Record<Severity, string> = {
  CRITICAL: "M12 2 2 22h20L12 2Zm0 6v6m0 3v.5",
  HIGH: "M12 3 2.5 20h19L12 3Zm0 6v6m0 3v.5",
  MEDIUM: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5m0 3v.5",
  LOW: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8v.5",
};

export function SeverityBadge({
  severity,
  showIcon = true,
  className,
}: {
  severity: Severity;
  showIcon?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={className}>
      {showIcon ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3" aria-hidden>
          <path d={SEVERITY_MARK[severity]} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {severity.charAt(0) + severity.slice(1).toLowerCase()}
    </Badge>
  );
}

const CASE_STATUS_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  NEW: "outline",
  TRIAGE: "medium",
  INVESTIGATING: "low",
  DECIDED: "accent",
  FILED: "verified",
  CLOSED: "neutral",
  PENDING: "pending",
  APPROVED: "verified",
  REJECTED: "mismatch",
  READY_FOR_REVIEW: "accent",
  DRAFT: "neutral",
  UNAVAILABLE: "outline",
  VERIFIED: "verified",
  MISMATCH: "mismatch",
  UNIQUE: "neutral",
  DUPLICATE: "pending",
  QUARANTINED: "critical",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge tone={CASE_STATUS_TONE[status] ?? "neutral"} className={cn("capitalize", className)}>
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
