"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  FileSearch,
  FileText,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useGenerateReport, useReports } from "@/lib/queries";
import { CasePicker, NoCases, useCaseParam } from "@/components/console/case-picker";
import { useSessionStore } from "@/stores";
import { formatDateTimeIST, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HashValue } from "@/components/ui/data-display";
import {
  Callout,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";

export default function ReportsPage() {
  return <ReportsPageInner />;
}

function ReportsPageInner() {
  const { cases, caseId, setCaseId, isLoading } = useCaseParam();
  const actor = useSessionStore((s) => s.actor);
  const { data, isLoading: packLoading, isError, error, refetch } = useReports(caseId);
  const generate = useGenerateReport();

  if (isLoading) return <LoadingState title="Loading cases" rows={5} />;
  if (!caseId) return <NoCases description="Reports belong to a case. Create one from a correlation candidate first." />;

  const history = data?.history ?? [];
  const pfr = data?.pfr;
  const str = data?.str;

  function copy(text: string, label: string) {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Clipboard permission was denied"));
  }

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 07</Badge>}
        title="Reports"
        description="The PFR and STR are rendered from the case object by core.report and validated before they can be registered. FMR has no renderer in the repository and stays TODO(compliance)."
        actions={
          <>
            <CasePicker cases={cases} caseId={caseId} onChange={setCaseId} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/cases/${caseId}`}>
                <FileSearch className="size-3.5" /> Case workspace
              </Link>
            </Button>
          </>
        }
      />

      {packLoading ? (
        <LoadingState title="Compiling report pack" rows={6} />
      ) : isError || !data ? (
        <ErrorState
          title="Reports unavailable"
          description={(error as Error | null)?.message ?? "The report pack could not be built."}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <Panel className="flex flex-wrap items-center gap-3 px-4 py-3">
            <StatusBadge status={data.status} />
            <span className="text-[11.5px] text-ink-2">
              {data.eligible
                ? "The case is DECIDED or FILED, so both filings can be generated."
                : "The case is not yet DECIDED."}
            </span>
            <Badge tone={data.eligible ? "verified" : "medium"} size="sm" className="ml-auto">
              {data.eligible ? "eligible" : "blocked"}
            </Badge>
          </Panel>

          {!data.eligible ? (
            <Callout tone="warning" title="Reports are locked">
              {data.blockedReason ?? "Propose a decision and have a different user approve it."}
            </Callout>
          ) : null}

          <div className="grid items-start gap-3 xl:grid-cols-12">
            <div className="space-y-3 xl:col-span-8">
              <Tabs defaultValue="pfr">
                <TabsList>
                  <TabsTrigger value="pfr">
                    <FileText className="size-3.5" /> PFR
                    {pfr && pfr.errors.length ? (
                      <Badge tone="critical" size="sm" className="ml-1">{pfr.errors.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="str">
                    <FileCode2 className="size-3.5" /> STR
                    {str && str.errors.length ? (
                      <Badge tone="critical" size="sm" className="ml-1">{str.errors.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="fmr">FMR</TabsTrigger>
                </TabsList>

                <TabsContent value="pfr" className="mt-3">
                  <ReportPreview
                    title="Preliminary Fraud Report"
                    regime="PFR"
                    content={pfr?.content ?? null}
                    errors={pfr?.errors ?? []}
                    eligible={data.eligible}
                    pending={generate.isPending}
                    onGenerate={() => generate.mutate({ caseId, regime: "PFR", actor })}
                    onCopy={copy}
                  />
                </TabsContent>
                <TabsContent value="str" className="mt-3">
                  <ReportPreview
                    title="Suspicious Transaction Report"
                    regime="STR"
                    content={str?.content ?? null}
                    errors={str?.errors ?? []}
                    eligible={data.eligible}
                    pending={generate.isPending}
                    onGenerate={() => generate.mutate({ caseId, regime: "STR", actor })}
                    onCopy={copy}
                  />
                </TabsContent>
                <TabsContent value="fmr" className="mt-3">
                  <Panel>
                    <PanelHeader
                      title="Fraud Monitoring Report"
                      description="Not implemented in the Python repository."
                      actions={<Badge tone="outline" size="sm">unavailable</Badge>}
                    />
                    <div className="px-4 py-4">
                      <Callout tone="neutral" title="TODO(compliance)">
                        {data.fmr.todo}
                      </Callout>
                      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
                        No field specification, renderer or validator exists for FMR. The console does not
                        invent a format or a reference number for it.
                      </p>
                    </div>
                  </Panel>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-3 xl:col-span-4">
              <Panel className="grid grid-cols-3 divide-x divide-border">
                <div className="px-3 py-3"><Metric label="PFR" value={pfr?.content ? "ready" : "—"} /></div>
                <div className="px-3 py-3"><Metric label="STR" value={str?.content ? "ready" : "—"} /></div>
                <div className="px-3 py-3"><Metric label="Registered" value={formatNumber(history.length)} /></div>
              </Panel>

              <Panel>
                <PanelHeader title="Registered filings" description="Files saved under exports/" />
                {history.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] text-ink-3">
                    Nothing has been generated yet. Generating validates the document, writes it to exports/
                    and inserts a row with its SHA-256.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {history.map((entry) => (
                      <li key={entry.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge tone="outline" size="sm">{entry.regime}</Badge>
                          <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-ink-2">
                            {entry.filename}
                          </span>
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${entry.filename}`}>
                            <a href={api.reportDownloadUrl(entry.id)}>
                              <Download className="size-3.5" />
                            </a>
                          </Button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <HashValue hash={entry.sha256} head={8} tail={6} label="Report SHA-256" />
                          <span className="ml-auto font-mono text-[9.5px] text-ink-3">
                            {formatDateTimeIST(entry.createdAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Callout tone="neutral" title="No submission">
                Registration writes a local file and records its hash. Nothing is transmitted to FIU-IND,
                RBI DAKSH or any other authority.
              </Callout>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReportPreview({
  title,
  regime,
  content,
  errors,
  eligible,
  pending,
  onGenerate,
  onCopy,
}: {
  title: string;
  regime: "PFR" | "STR";
  content: string | null;
  errors: string[];
  eligible: boolean;
  pending: boolean;
  onGenerate: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title={title}
        description={
          content
            ? `${content.length.toLocaleString("en-IN")} characters · validation ${errors.length ? "failed" : "passed"}`
            : "The document is rendered by the API on request."
        }
        actions={
          <>
            {content ? (
              <Button variant="outline" size="xs" onClick={() => onCopy(content, regime)}>
                <Copy className="size-3" /> Copy
              </Button>
            ) : null}
            <Button size="xs" onClick={onGenerate} disabled={!eligible || pending}>
              {pending ? <Loader2 className="size-3 animate-spin" /> : <ClipboardCheck className="size-3" />}
              Generate {regime}
            </Button>
          </>
        }
      />
      {!content ? (
        <div className="px-4 py-8 text-center text-[11.5px] text-ink-3">
          {eligible
            ? `No ${regime} preview is available. Generate it to validate and register the document.`
            : `The ${regime} is not rendered until the case is DECIDED.`}
        </div>
      ) : (
        <>
          {errors.length > 0 ? (
            <div className="border-b border-border bg-critical-soft px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                <TriangleAlert className="size-3.5 text-critical" aria-hidden />
                {errors.length} validation error{errors.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[11px] text-ink-2">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border-b border-border bg-verified-soft px-4 py-2 text-[11px] text-ink-2">
              <CheckCircle2 className="mr-1.5 inline size-3.5 text-verified" aria-hidden />
              Validator returned no errors.
            </div>
          )}
          <pre className="scrollbar-thin max-h-[560px] overflow-auto bg-surface-2 p-4 font-mono text-[11px] leading-relaxed text-ink-2">
            {content}
          </pre>
        </>
      )}
    </Panel>
  );
}
