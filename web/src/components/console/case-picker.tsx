"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { FolderSearch } from "lucide-react";
import { useCases } from "@/lib/queries";
import { SimpleSelect } from "@/components/ui/field";
import { EmptyState, Panel } from "@/components/ui/misc";
import type { CaseSummary } from "@/types";

/**
 * Case selection for the global segments. The URL is the source of truth so a
 * link such as /app/evidence?case=CS-2026-0001 survives a refresh and can be
 * shared. Reading the query string on the client (instead of useSearchParams)
 * keeps these segments usable when the database is empty and avoids the
 * static-render Suspense bailout. When no case exists yet the page is told so
 * and can guide the user back to Correlation.
 */
export function useCaseParam(): {
  cases: CaseSummary[];
  caseId: string | null;
  setCaseId: (id: string) => void;
  isLoading: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const [param, setParam] = React.useState<string | null>(null);
  const { data, isLoading } = useCases();
  const cases = React.useMemo(() => data ?? [], [data]);

  React.useEffect(() => {
    function read() {
      setParam(new URLSearchParams(window.location.search).get("case"));
    }
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [pathname]);

  const caseId = param && cases.some((c) => c.caseId === param) ? param : cases[0]?.caseId ?? null;

  const setCaseId = React.useCallback(
    (id: string) => {
      const next = new URLSearchParams(window.location.search);
      next.set("case", id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      setParam(id);
    },
    [pathname, router],
  );

  return { cases, caseId, setCaseId, isLoading };
}

export function CasePicker({
  cases,
  caseId,
  onChange,
}: {
  cases: CaseSummary[];
  caseId: string | null;
  onChange: (id: string) => void;
}) {
  if (cases.length === 0) return null;
  return (
    <SimpleSelect
      value={caseId ?? cases[0]?.caseId ?? ""}
      onValueChange={onChange}
      label="Select case"
      className="w-full max-w-xs"
      options={cases.map((c) => ({
        value: c.caseId,
        label: `${c.caseId} · ${c.status}`,
      }))}
    />
  );
}

export function NoCases({ description }: { description?: string }) {
  return (
    <Panel>
      <EmptyState
        icon={FolderSearch}
        title="No case exists yet"
        description={
          description ??
          "Correlate the ingested alerts and accept a candidate. A case is created only when you accept one."
        }
        action={
          <a
            href="/app/correlate"
            className="inline-flex h-8 items-center gap-2 rounded-sm bg-accent px-3 text-[13px] font-medium text-accent-fg hover:bg-accent-hover"
          >
            Open Correlate
          </a>
        }
      />
    </Panel>
  );
}
