import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("console-panel", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="label-mono mb-3">{eyebrow}</p> : null}
      <h2 className="text-display-md font-medium text-ink">{title}</h2>
      {description ? (
        <p className="mt-4 text-[15px] leading-7 text-ink-2 md:text-base">{description}</p>
      ) : null}
    </div>
  );
}

const calloutVariants = cva("flex gap-3 rounded-lg border px-3.5 py-3 text-[12.5px] leading-relaxed", {
  variants: {
    tone: {
      info: "border-low/25 bg-low-soft text-ink",
      warning: "border-medium/30 bg-medium-soft text-ink",
      critical: "border-critical/30 bg-critical-soft text-ink",
      success: "border-verified/30 bg-verified-soft text-ink",
      neutral: "border-border bg-surface-2 text-ink-2",
    },
  },
  defaultVariants: { tone: "info" },
});

const CALLOUT_ICON = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
  success: Info,
  neutral: Info,
} as const;

export function Callout({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: VariantProps<typeof calloutVariants>["tone"];
  title?: string;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = CALLOUT_ICON[tone ?? "info"];
  return (
    <div className={cn(calloutVariants({ tone }), className)} role={tone === "critical" ? "alert" : "status"}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 font-semibold text-ink">{title}</p> : null}
        {children}
      </div>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono text-[10px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}

export function Avatar({
  initials,
  className,
  tone = "accent",
}: {
  initials: string;
  className?: string;
  tone?: "accent" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        tone === "accent" ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-ink-2",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Progress({
  value,
  className,
  tone = "accent",
  label,
}: {
  value: number;
  className?: string;
  tone?: "accent" | "critical" | "medium" | "verified";
  label?: string;
}) {
  const colors = {
    accent: "bg-accent",
    critical: "bg-critical",
    medium: "bg-medium",
    verified: "bg-verified",
  } as const;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-3", className)} aria-hidden />;
}

export function LoadingState({
  title = "Loading",
  rows = 5,
  className,
}: {
  title?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 p-5", className)} role="status" aria-live="polite">
      <span className="sr-only">{title}</span>
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon ? (
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2 text-ink-3">
          <Icon className="size-5" strokeWidth={1.6} />
        </span>
      ) : null}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-3">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)} role="alert">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-critical/30 bg-critical-soft text-critical">
        <WifiOff className="size-5" strokeWidth={1.6} />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-3">
        {description ?? "The request did not complete. Check the API connection and retry."}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)} data-slot="metric">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <p className="mt-1.5 text-2xl font-medium tracking-[-0.03em] text-ink">{value}</p>
      {sub || trend ? (
        <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
          {trend}
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function InlineCode({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn("rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2", className)}>
      {children}
    </code>
  );
}
