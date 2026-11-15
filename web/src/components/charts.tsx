"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ModelMetrics, ThresholdPoint } from "@/types";
import { formatNumber } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  amount: "Amount",
  hour: "Hour of day",
  is_night: "Night window",
  txn_count_24h: "24h transaction count",
  distinct_beneficiaries_24h: "24h beneficiaries",
  account_age_days: "Account age",
  is_new_beneficiary: "New beneficiary",
  device_shared_count: "Shared device",
  amount_round: "Round amount",
  in_out_ratio_24h: "Pass-through ratio",
};

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] shadow-md">
      {label !== undefined ? (
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-3">{label}</p>
      ) : null}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="size-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono tabular-nums text-ink">
            {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Feature importances come straight from models/eval_metrics.json. */
export function FeatureImportanceChart({
  importances,
  height = 280,
}: {
  importances: Record<string, number>;
  height?: number;
}) {
  const data = Object.entries(importances)
    .map(([feature, value]) => ({
      feature,
      label: FEATURE_LABELS[feature] ?? feature,
      value: Math.round(value * 1000) / 10,
    }))
    .sort((a, b) => a.value - b.value);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v}%`}
            tickLine={false}
            axisLine={false}
            domain={[0, "dataMax"]}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={132}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-2)", fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: "var(--surface-3)" }} />
          <Bar dataKey="value" name="Importance" radius={[0, 3, 3, 0]} barSize={11} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={entry.feature} fill={i === data.length - 1 ? "var(--chart-1)" : "var(--chart-3)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Precision/recall/F1 across the stored decision thresholds. */
export function ThresholdChart({ model, height = 260 }: { model: ModelMetrics; height?: number }) {
  const data: ThresholdPoint[] = model.threshold_curve;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="threshold"
            tickFormatter={(v: number) => v.toFixed(1)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine x={0.5} stroke="var(--border-strong)" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="precision" name="Precision" stroke="var(--chart-1)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="recall" name="Recall" stroke="var(--chart-2)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="f1" name="F1" stroke="var(--chart-3)" strokeWidth={1.8} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const labels = ["Predicted normal", "Predicted fraud"];
  const rows = ["Actual normal", "Actual fraud"];
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div className="grid grid-cols-[96px_1fr_1fr] gap-px overflow-hidden rounded-md border border-border bg-border text-[11px]">
      <div className="bg-surface-2 p-2" />
      {labels.map((l) => (
        <div key={l} className="bg-surface-2 p-2 text-center font-medium text-ink-3">
          {l}
        </div>
      ))}
      {matrix.map((row, ri) => (
        <div key={ri} className="contents">
          <div className="bg-surface-2 p-2 font-medium text-ink-3">{rows[ri]}</div>
          {row.map((value, ci) => {
            const intensity = value / max;
            const isCorrect = ri === ci;
            return (
              <div
                key={ci}
                className="p-3 text-center font-mono text-[12px] tabular-nums"
                style={{
                  background: isCorrect
                    ? `color-mix(in srgb, var(--verified) ${Math.round(intensity * 26)}%, var(--surface))`
                    : `color-mix(in srgb, var(--critical) ${Math.round(intensity * 26)}%, var(--surface))`,
                  color: "var(--ink)",
                }}
              >
                {formatNumber(value)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
