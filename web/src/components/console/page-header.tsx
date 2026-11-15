import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-col gap-4", className)}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[26px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{meta}</div> : null}
    </div>
  );
}

export function SampleBadge() {
  return (
    <Badge tone="medium" size="sm">
      <span className="size-1 rounded-full bg-current" aria-hidden />
      Sample data
    </Badge>
  );
}
