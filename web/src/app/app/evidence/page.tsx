"use client";

import Link from "next/link";
import { FileSearch, FolderLock, ShieldCheck } from "lucide-react";
import { useEvidence } from "@/lib/queries";
import { CasePicker, NoCases, useCaseParam } from "@/components/console/case-picker";
import { EvidenceChain } from "@/components/console/evidence-chain";
import { useSessionStore } from "@/stores";
import { formatDateTimeIST, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Callout,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
} from "@/components/ui/misc";

export default function EvidencePage() {
  return <EvidencePageInner />;
}

function EvidencePageInner() {
  const { cases, caseId, setCaseId, isLoading } = useCaseParam();
  const actor = useSessionStore((s) => s.actor);
  const evidence = useEvidence(caseId);
  const items = evidence.data ?? [];
  const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  const missing = items.filter((item) => !item.exists).length;

  if (isLoading) return <LoadingState title="Loading cases" rows={5} />;
  if (!caseId) return <NoCases description="Evidence is attached to a case. Create one from a correlation candidate first." />;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 06</Badge>}
        title="Evidence"
        description="Files are sealed into an append-only SHA-256 chain. Verification reads the bytes on disk and the stored metadata; it never repairs or rewrites anything."
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

      <Panel className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3"><Metric label="Chain links" value={formatNumber(items.length)} /></div>
        <div className="px-4 py-3"><Metric label="Bytes sealed" value={formatNumber(totalBytes)} /></div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Files on disk</p>
          <p className="mt-1.5 text-2xl font-medium tracking-[-0.03em] text-ink">
            {formatNumber(items.length - missing)}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">{missing} missing</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Latest seal</p>
          <p className="mt-1.5 text-[11px] text-ink-2">
            {items.length ? formatDateTimeIST(items[items.length - 1]!.createdAt) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">{caseId}</p>
        </div>
      </Panel>

      {evidence.isLoading ? (
        <LoadingState title="Loading evidence" rows={4} />
      ) : evidence.isError ? (
        <ErrorState
          title="Evidence unavailable"
          description={(evidence.error as Error | null)?.message ?? "The evidence list could not be read."}
          onRetry={() => evidence.refetch()}
        />
      ) : (
        <EvidenceChain caseId={caseId} items={items} actor={actor} />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Callout tone="neutral" title="How verification works">
          <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed">
            <li>1. The chain checks every row in insertion order, across all cases.</li>
            <li>2. Each file&apos;s SHA-256 must match the hash stored when it was sealed.</li>
            <li>3. Each row&apos;s previous-hash pointer must match the previous row&apos;s item hash.</li>
          </ul>
        </Callout>
        <Callout tone="warning" title="Tamper demonstration">
          <p className="text-[11.5px] leading-relaxed">
            Altering a file appends bytes to the copy in evidence_files/ and keeps a .demo-original
            backup. Verify to see the mismatch, then Restore to return the original bytes. The database
            hash is never edited, so the failure is real rather than simulated in the UI.
          </p>
        </Callout>
      </div>

      {items.length === 0 ? (
        <Panel className="flex flex-wrap items-center gap-3 px-4 py-3">
          <FolderLock className="size-4 text-ink-3" aria-hidden />
          <p className="text-[11.5px] text-ink-2">
            This case has no evidence. Use “Attach sample note” above, or upload a file in the API.
          </p>
          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-ink-3">
            <ShieldCheck className="size-3" aria-hidden /> appending creates link #{items.length + 1}
          </span>
        </Panel>
      ) : null}
    </div>
  );
}
