"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Circle,
  Database,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useLoadDataset, useResetDataset, useWorkflowState } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Callout, Panel } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlays";

function ResetButton() {
  const [open, setOpen] = React.useState(false);
  const reset = useResetDataset();

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Reset the database"
        title="Reset database"
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Reset the database?"
            description="Every table is emptied and generated exports and evidence files are deleted. The schema stays in place. This cannot be undone."
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutate(undefined, { onSuccess: () => setOpen(false) })
              }
            >
              {reset.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepStrip({ steps }: { steps: { id: string; label: string; done: boolean; href: string }[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border bg-surface-2/60 px-4 py-2">
      <span className="font-mono text-[10px] tabular-nums text-ink-3">
        {done}/{steps.length}
      </span>
      <ol className="flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-1.5">
            {step.done ? (
              <Check className="size-3 text-verified" aria-hidden />
            ) : (
              <Circle className="size-2.5 text-border-strong" aria-hidden />
            )}
            <Link
              href={step.href}
              className={cn(
                "text-[10.5px] underline-offset-2 hover:underline",
                step.done ? "text-ink-3 line-through decoration-border" : "text-ink-2",
              )}
            >
              {step.label}
            </Link>
            {index < steps.length - 1 ? <span className="text-border-strong" aria-hidden>·</span> : null}
          </li>
        ))}
      </ol>
      <ResetButton />
    </div>
  );
}

/**
 * The guide is rendered once by the console shell. It reads the live workflow
 * state from the API, so the "next step" always reflects what the database
 * actually contains rather than a hard-coded script.
 */
export function WorkflowGuide() {
  const { data, isLoading, isError } = useWorkflowState();
  const load = useLoadDataset();

  if (isLoading || isError || !data) return null;

  if (!data.loaded) {
    return (
      <Panel className="mb-3 overflow-hidden border-accent/30">
        <div className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">The database is empty</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">
              Nothing is preloaded. Load the synthetic corpus (5,005 transactions and 300 alerts)
              when you are ready to work through the seven segments.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" disabled={load.isPending} onClick={() => load.mutate()}>
              {load.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Database className="size-3.5" />
              )}
              {load.isPending ? "Loading…" : "Load sample data"}
            </Button>
            <ResetButton />
          </div>
        </div>
        <StepStrip steps={data.steps} />
      </Panel>
    );
  }

  const next = data.nextStep;

  return (
    <Panel className="mb-3 overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent-soft text-accent-ink">
          <ArrowRight className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">Next step</p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink">{next.title}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{next.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link href={next.href}>
              {next.action} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
      <StepStrip steps={data.steps} />
      {data.pendingDecisions > 0 ? (
        <div className="border-t border-border px-4 py-2">
          <Callout tone="warning" title="Maker-checker is waiting">
            {data.pendingDecisions} decision{data.pendingDecisions === 1 ? "" : "s"} pending. Switch to
            a different acting role in the user menu so the checker name differs from the maker.
          </Callout>
        </div>
      ) : null}
    </Panel>
  );
}
