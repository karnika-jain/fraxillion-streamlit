"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn, maskAccount, middleEllipsis } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/overlays";
import type { Severity } from "@/types";

export function HashValue({
  hash,
  head = 10,
  tail = 8,
  className,
  label = "SHA-256",
  showIcon = true,
  state = "verified",
}: {
  hash: string;
  head?: number;
  tail?: number;
  className?: string;
  label?: string;
  showIcon?: boolean;
  state?: "verified" | "mismatch" | "pending" | "none";
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const Icon = state === "mismatch" ? ShieldAlert : ShieldCheck;

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Clipboard permission was denied");
    }
  }

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      {showIcon && state !== "none" ? (
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            state === "mismatch"
              ? "text-mismatch"
              : state === "pending"
                ? "text-pending"
                : "text-verified",
          )}
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="truncate rounded-sm font-mono text-[11px] text-ink-2 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${label}. Click to ${revealed ? "hide" : "reveal"} the full value`}
        title={revealed ? "Hide full hash" : "Reveal full hash"}
      >
        {revealed ? hash : middleEllipsis(hash, head, tail)}
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            className="rounded-sm p-0.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="size-3 text-verified" /> : <Copy className="size-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>Copy full hash</TooltipContent>
      </Tooltip>
    </span>
  );
}

export function MaskedAccount({
  accountId,
  className,
  showLabel = false,
  compact = false,
}: {
  accountId: string;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(false);

  function toggle() {
    if (!revealed) {
      toast.info("Account revealed for this view only", {
        description: `${accountId} · nothing is written to the database.`,
      });
    }
    setRevealed((v) => !v);
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={toggle}
        className="rounded-sm font-mono text-[11px] text-ink-2 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${revealed ? "Mask" : "Reveal"} account ${accountId}`}
        title={`${revealed ? "Mask" : "Reveal"} account — reveal is logged`}
      >
        {revealed ? accountId : maskAccount(accountId)}
      </button>
      {!compact ? (
        <button
          type="button"
          onClick={toggle}
          className="rounded-sm p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={revealed ? "Hide account" : "Reveal account"}
        >
          {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </button>
      ) : null}
      {showLabel && revealed ? (
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">logged</span>
      ) : null}
    </span>
  );
}

const BAND_COLOR: Record<Severity, string> = {
  CRITICAL: "var(--critical)",
  HIGH: "var(--high)",
  MEDIUM: "var(--medium)",
  LOW: "var(--low)",
};

export function RiskDial({
  score,
  band,
  size = 112,
  label = "Case risk",
  showBand = true,
  caption = "model probability",
}: {
  score: number;
  band: Severity;
  size?: number;
  label?: string;
  showBand?: boolean;
  caption?: string;
}) {
  const stroke = size >= 96 ? 8 : 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0, Math.min(1, score));
  const color = BAND_COLOR[band];

  return (
    <div className="inline-flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-medium tabular-nums tracking-[-0.04em] text-ink"
            style={{ fontSize: size >= 96 ? 30 : 20 }}
          >
            {score.toFixed(2)}
          </span>
          {size >= 96 ? <span className="text-[9px] uppercase tracking-[0.1em] text-ink-3">probability</span> : null}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">{label}</p>
        {showBand ? (
          <p className="mt-1 text-sm font-semibold" style={{ color }}>
            {band.charAt(0) + band.slice(1).toLowerCase()} risk
          </p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-ink-3">{caption}</p>
      </div>
    </div>
  );
}
