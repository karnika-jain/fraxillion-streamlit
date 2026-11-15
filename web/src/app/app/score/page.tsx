"use client";

import * as React from "react";
import Link from "next/link";
import {
  BrainCircuit,
  CircleHelp,
  Gauge,
  Network,
  SlidersHorizontal,
} from "lucide-react";
import { CasePicker, NoCases, useCaseParam } from "@/components/console/case-picker";
import { useCase, useEvalMetrics, useRisk } from "@/lib/queries";
import { stageHref } from "@/lib/case-links";
import { cn, formatDateTimeIST, formatINRCompact, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import {
  ConfusionMatrix,
  FeatureImportanceChart,
  ThresholdChart,
} from "@/components/charts";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/field";
import { RiskDial } from "@/components/ui/data-display";
import {
  Callout,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/misc";

type ModelName = "RandomForest" | "LogisticRegression";

export default function ScorePage() {
  return <ScorePageInner />;
}

function ScorePageInner() {
  const { cases, caseId, setCaseId, isLoading } = useCaseParam();
  const [model, setModel] = React.useState<ModelName>("RandomForest");
  const risk = useRisk(caseId, model);
  const detail = useCase(caseId);
  const metrics = useEvalMetrics();

  if (isLoading) return <LoadingState title="Loading cases" rows={5} />;
  if (!caseId) return <NoCases description="Scoring needs a persisted case. Correlate alerts and accept a candidate first." />;

  const selectedMetrics = metrics.data?.models[model] ?? metrics.data?.models.RandomForest;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 03</Badge>}
        title="ML Score"
        description="The probability is computed on request by the trained model in models/. The reasons below come from the same feature vector that produced the score."
        actions={
          <>
            <CasePicker cases={cases} caseId={caseId} onChange={setCaseId} />
            <SimpleSelect
              value={model}
              onValueChange={(v) => setModel(v as ModelName)}
              label="Model"
              className="w-[190px]"
              options={[
                { value: "RandomForest", label: "Random forest" },
                { value: "LogisticRegression", label: "Logistic regression" },
              ]}
            />
          </>
        }
      />

      <div className="grid items-start gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-5">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Case probability"
              description={risk.data ? `Scored ${formatDateTimeIST(risk.data.scoredAt)}` : "Reading the model"}
              actions={risk.data ? <SeverityBadge severity={risk.data.band} /> : null}
            />
            {risk.isLoading ? (
              <LoadingState rows={3} />
            ) : risk.isError || !risk.data ? (
              <ErrorState
                title="Scoring failed"
                description={(risk.error as Error | null)?.message ?? "The model could not score this case."}
                onRetry={() => risk.refetch()}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5">
                  <RiskDial
                    score={risk.data.score}
                    band={risk.data.band}
                    label={`${risk.data.model} · case risk`}
                    caption={`≥ 0.85 critical · ≥ 0.70 high · ≥ 0.40 medium`}
                  />
                  <div className="text-right">
                    <p className="font-mono text-[11px] text-ink-3">{risk.data.caseId}</p>
                    <StatusBadge status={detail.data?.status ?? "NEW"} className="mt-1" />
                    <p className="mt-2 text-[11px] text-ink-3">
                      {detail.data ? formatINRCompact(detail.data.amount) : "—"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
                    Why this score
                  </p>
                  {risk.data.reasons.length === 0 ? (
                    <p className="mt-1.5 text-[11.5px] text-ink-3">No positive drivers were returned.</p>
                  ) : (
                    <ol className="mt-2 space-y-1.5">
                      {risk.data.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-2 text-[11.5px] text-ink-2">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                          {reason}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Case facts" description="Inputs the model actually reads" />
            {detail.isLoading || !detail.data ? (
              <LoadingState rows={3} />
            ) : (
              <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">
                <div className="px-4 py-3"><Metric label="Alerts" value={formatNumber(detail.data.alertCount)} /></div>
                <div className="px-4 py-3"><Metric label="Transactions" value={formatNumber(detail.data.transactions.length)} /></div>
                <div className="px-4 py-3"><Metric label="Value" value={formatINRCompact(detail.data.amount)} /></div>
                <div className="px-4 py-3"><Metric label="Evidence" value={formatNumber(detail.data.evidenceCount)} /></div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
              <Button asChild variant="outline" size="xs">
                <Link href={stageHref("graph", caseId)}>
                  <Network className="size-3" /> Open money trail
                </Link>
              </Button>
              <Button asChild variant="ghost" size="xs">
                <Link href={`/app/cases/${caseId}`}>
                  <Gauge className="size-3" /> Case workspace
                </Link>
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-7">
          <Panel>
            <PanelHeader
              title={model === "RandomForest" ? "Random forest metrics" : "Logistic regression metrics"}
              description="Read from models/eval_metrics.json, the same artefact the Python app used."
              actions={
                metrics.data ? (
                  <Badge tone="outline" size="sm">
                    {formatNumber(metrics.data.dataset.test_rows)} test rows
                  </Badge>
                ) : null
              }
            />
            {metrics.isLoading ? (
              <LoadingState rows={4} />
            ) : metrics.isError || !metrics.data || !selectedMetrics ? (
              <ErrorState
                title="Model metrics unavailable"
                description="models/eval_metrics.json is missing or unreadable."
                onRetry={() => metrics.refetch()}
              />
            ) : (
              <>
                <div className="grid grid-cols-3 divide-x divide-y divide-border sm:grid-cols-6 sm:divide-y-0">
                  {[
                    ["Accuracy", selectedMetrics.accuracy],
                    ["Precision", selectedMetrics.precision],
                    ["Recall", selectedMetrics.recall],
                    ["F1", selectedMetrics.f1],
                    ["ROC AUC", selectedMetrics.roc_auc],
                    ["PR AUC", selectedMetrics.pr_auc],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="px-3 py-3">
                      <p className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-ink-3">{label}</p>
                      <p className="mt-1 font-mono text-[16px] tabular-nums text-ink">
                        {Number(value).toFixed(3)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-4 py-2 text-[10.5px] text-ink-3">
                  {formatNumber(metrics.data.dataset.total_rows)} rows ·{" "}
                  {metrics.data.dataset.fraud_rate_pct.toFixed(2)}% fraud ·{" "}
                  {metrics.data.dataset.split} · trained in {metrics.data.training_seconds.toFixed(1)}s
                </div>
              </>
            )}
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Threshold trade-off" description="Precision, recall and F1 by cut-off" />
              <div className="p-3">
                {selectedMetrics ? (
                  <ThresholdChart model={selectedMetrics} height={240} />
                ) : (
                  <p className="px-2 py-6 text-[11px] text-ink-3">No threshold curve available.</p>
                )}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Confusion matrix" description="Held-out test split" />
              <div className="p-3">
                {selectedMetrics ? (
                  <ConfusionMatrix matrix={selectedMetrics.confusion_matrix} />
                ) : (
                  <p className="px-2 py-6 text-[11px] text-ink-3">No matrix available.</p>
                )}
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader
              title="Global feature importance"
              description="Fitted on the training split; not specific to this case."
              actions={
                <Button asChild variant="ghost" size="xs">
                  <Link href="/app/score">
                    <CircleHelp className="size-3" /> How to read
                  </Link>
                </Button>
              }
            />
            <div className="p-3">
              {metrics.data ? (
                <FeatureImportanceChart importances={metrics.data.feature_importances} height={260} />
              ) : (
                <p className="px-2 py-6 text-[11px] text-ink-3">Feature importances unavailable.</p>
              )}
            </div>
          </Panel>

          {risk.data && risk.data.band === "LOW" ? (
            <Callout tone="neutral" title="Low band is not a clearance">
              A low probability does not close the case. The decision and its maker-checker approval are
              recorded separately in the case workspace.
            </Callout>
          ) : null}
        </div>
      </div>

      <Panel className="flex flex-wrap items-center gap-3 px-4 py-3">
        <SlidersHorizontal className="size-4 text-ink-3" aria-hidden />
        <p className="text-[11.5px] text-ink-2">
          The score is recomputed on every request; switching model re-runs the same feature vector.
        </p>
        <span className={cn("ml-auto font-mono text-[10px]", model === "RandomForest" ? "text-accent" : "text-ink-3")}>
          <BrainCircuit className="mr-1 inline size-3" aria-hidden />
          {model}
        </span>
      </Panel>
    </div>
  );
}
