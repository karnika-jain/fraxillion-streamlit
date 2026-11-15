"use client";

import * as React from "react";
import {
  Download,
  FileArchive,
  Fingerprint,
  Info,
  Link2,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { ChainVerification, EvidenceItem } from "@/types";
import { api } from "@/lib/api";
import {
  useAttachSampleEvidence,
  useRestoreEvidence,
  useTamperEvidence,
  useVerifyChain,
} from "@/lib/queries";
import { formatDateTimeIST, formatNumber } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HashValue } from "@/components/ui/data-display";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlays";

export function EvidenceChain({
  caseId,
  items,
  actor,
}: {
  caseId: string;
  items: EvidenceItem[];
  actor: string;
}) {
  const [verification, setVerification] = React.useState<ChainVerification | null>(null);
  const [details, setDetails] = React.useState<EvidenceItem | null>(null);
  const [tamperTarget, setTamperTarget] = React.useState<EvidenceItem | null>(null);

  const verify = useVerifyChain();
  const tamper = useTamperEvidence();
  const restore = useRestoreEvidence();
  const attach = useAttachSampleEvidence();

  const stateFor = (id: number): "VERIFIED" | "MISMATCH" | "PENDING" =>
    verification?.items.find((i) => i.id === id)?.state ?? "PENDING";

  function runVerify() {
    verify.mutate(undefined, { onSuccess: (result) => setVerification(result) });
  }

  function runTamper(item: EvidenceItem) {
    tamper.mutate(item.id, {
      onSuccess: () => {
        setVerification(null);
        setTamperTarget(null);
      },
    });
  }

  function runRestore(item: EvidenceItem) {
    restore.mutate(item.id, { onSuccess: () => setVerification(null) });
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="SHA-256 evidence chain"
        description="Each item hashes its file, the previous link and its own metadata. Verification rewrites nothing."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={runVerify} disabled={verify.isPending || items.length === 0}>
              <ShieldCheck className="size-3.5" />
              {verify.isPending ? "Verifying…" : "Verify chain"}
            </Button>
            {items.length > 0 ? (
              <Button asChild variant="ghost" size="icon-sm" aria-label="Export evidence bundle">
                <a href={api.evidenceBundleUrl(caseId)}>
                  <FileArchive className="size-4" />
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface-2 px-4 py-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-ink-3">
          <Link2 className="size-3.5" aria-hidden /> {items.length} link{items.length === 1 ? "" : "s"}
        </span>
        {verification ? (
          <>
            <Badge tone={verification.ok ? "verified" : "mismatch"} size="sm">
              {verification.ok ? "chain intact" : "tamper detected"}
            </Badge>
            <span className="text-ink-3">{verification.message}</span>
            <span className="ml-auto font-mono text-[10px] text-ink-3">{formatDateTimeIST(verification.at)}</span>
          </>
        ) : (
          <span className="text-ink-3">
            Not verified in this view yet. Verification checks every case in the global chain.
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Fingerprint}
          title="No evidence sealed for this case"
          description="Attach the sample note or upload a file. The first item starts the chain; later items link to its hash."
          action={
            <Button size="sm" onClick={() => attach.mutate({ caseId, actor })} disabled={attach.isPending}>
              <Plus className="size-3.5" /> {attach.isPending ? "Sealing…" : "Attach sample note"}
            </Button>
          }
        />
      ) : (
        <ol className="divide-y divide-border">
          {items.map((item) => {
            const state = stateFor(item.id);
            return (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-[10px] text-ink-3">
                  {item.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[12px] font-medium text-ink">{item.filename}</span>
                    <Badge tone="outline" size="sm">{item.kind}</Badge>
                    <StatusBadge status={state} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-3">
                    <HashValue hash={item.fileHash} state={state === "MISMATCH" ? "mismatch" : state === "VERIFIED" ? "verified" : "pending"} />
                    <span>{formatNumber(item.sizeBytes)} bytes</span>
                    <span>{formatDateTimeIST(item.createdAt)}</span>
                    {!item.exists ? (
                      <span className="inline-flex items-center gap-1 text-mismatch">
                        <TriangleAlert className="size-3" /> file missing
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Details for ${item.filename}`} onClick={() => setDetails(item)}>
                    <Info className="size-3.5" />
                  </Button>
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${item.filename}`}>
                    <a href={api.evidenceDownloadUrl(item.id)}>
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                  {state === "MISMATCH" ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => runRestore(item)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="size-3" /> Restore
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-critical"
                      onClick={() => setTamperTarget(item)}
                    >
                      <ShieldAlert className="size-3" /> Tamper
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2">
        <p className="text-[10px] text-ink-3">
          The chain is append-only: a new item extends the previous hash. Tampering changes the file on disk only.
        </p>
        {items.length > 0 ? (
          <Button size="xs" variant="outline" onClick={() => attach.mutate({ caseId, actor })} disabled={attach.isPending}>
            <Plus className="size-3" /> Attach another sample
          </Button>
        ) : null}
      </div>

      <Dialog open={details !== null} onOpenChange={(open) => !open && setDetails(null)}>
        {details ? (
          <DialogContent className="max-w-lg">
            <DialogHeader title={details.filename} description={`Evidence #${details.id} · ${details.kind}`} />
            <dl className="space-y-3 text-[12px]">
              <div>
                <dt className="text-ink-3">File SHA-256</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-2">{details.fileHash}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Previous link</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-2">{details.prevHash}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Item hash</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-2">{details.itemHash}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Stored path</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-2">{details.path}</dd>
              </div>
            </dl>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDetails(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={tamperTarget !== null} onOpenChange={(open) => !open && setTamperTarget(null)}>
        {tamperTarget ? (
          <DialogContent className="max-w-md">
            <DialogHeader
              title="Alter the file on disk?"
              description={`The API appends a byte block to ${tamperTarget.filename} and keeps a .demo-original backup. Verify afterwards to see the stored hash and disk hash diverge; Restore puts the original bytes back.`}
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setTamperTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={tamper.isPending}
                onClick={() => runTamper(tamperTarget)}
              >
                <ShieldAlert className="size-3.5" /> {tamper.isPending ? "Altering…" : "Alter file"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </Panel>
  );
}
