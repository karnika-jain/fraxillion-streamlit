"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  LogOut,
  Menu,
  Search,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { useCases, useOverview } from "@/lib/queries";
import { ROLE_ACTOR, useSessionStore, useUIStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, Kbd } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownLabel,
  DropdownMenuTrigger,
  DropdownSeparator,
} from "@/components/ui/overlays";
import { segmentForPath } from "@/lib/navigation";
import { cn, formatRelative, initials, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/utils";

function Breadcrumbs() {
  const pathname = usePathname();
  const segment = segmentForPath(pathname);
  const caseMatch = pathname.match(/^\/app\/cases\/([^/]+)/);
  const parts: { label: string; href?: string }[] = [{ label: "Console", href: "/app" }];
  if (segment && segment.href !== "/app") parts.push({ label: segment.label, href: segment.href });
  if (caseMatch?.[1]) parts.push({ label: caseMatch[1], href: pathname });

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[12px] md:flex">
      {parts.map((p, i) => (
        <React.Fragment key={`${p.label}-${i}`}>
          {i > 0 ? <ChevronRight className="size-3 shrink-0 text-ink-3" aria-hidden /> : null}
          {p.href && i < parts.length - 1 ? (
            <Link href={p.href} className="truncate text-ink-3 transition-colors hover:text-ink">
              {p.label}
            </Link>
          ) : (
            <span className={cn("truncate", i === parts.length - 1 ? "font-medium text-ink" : "text-ink-3")}>
              {p.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

function CaseSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: cases } = useCases();
  const activeId = pathname.match(/^\/app\/cases\/([^/]+)/)?.[1];
  const active = cases?.find((c) => c.caseId === activeId) ?? cases?.[0];

  if (!cases?.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden max-w-[240px] gap-2 md:inline-flex"
          aria-label={`Select case${active ? ` — ${active.caseId}` : ""}`}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <span className="truncate font-mono text-[11px]">{active?.caseId ?? "Select case"}</span>
          <ChevronDown className="size-3 shrink-0 text-ink-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownLabel>Open case</DropdownLabel>
        {cases.slice(0, 8).map((c) => (
          <DropdownMenuItem
            key={c.caseId}
            onSelect={() => router.push(`/app/cases/${c.caseId}`)}
            className="items-start"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink">{c.caseId}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-0.5 truncate text-[11px] text-ink-3">{c.title}</p>
            </div>
            {c.caseId === active?.caseId ? <Check className="mt-0.5 size-3.5 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownSeparator />
        <DropdownMenuItem onSelect={() => router.push("/app/cases")}>
          <SlidersHorizontal className="size-3.5" /> View all cases
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notifications() {
  const { data } = useOverview();
  const alerts = data?.recentAlerts ?? [];
  const unlinked = data?.unlinkedAlerts ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Latest alerts, ${unlinked} not linked to a case`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden>
            <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5 1.5 5h-15S6 12 6 8Z" strokeLinejoin="round" />
            <path d="M10 19a2.5 2.5 0 0 0 4 0" strokeLinecap="round" />
          </svg>
          {unlinked > 0 ? (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-critical ring-2 ring-bg" aria-hidden />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2.5 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Latest alerts</p>
          <Badge tone={unlinked ? "critical" : "neutral"} size="sm">
            {unlinked} unlinked
          </Badge>
        </div>
        <p className="sr-only" aria-live="polite">
          {unlinked} alerts are not linked to a case.
        </p>
        {alerts.length === 0 ? (
          <p className="px-2.5 py-4 text-[11.5px] text-ink-3">No alerts in the database yet.</p>
        ) : (
          alerts.slice(0, 5).map((a) => (
            <DropdownMenuItem key={a.alertId} asChild>
              <Link href="/app/ingest" className="items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink">{a.alertId}</span>
                    <SeverityBadge severity={a.severity} showIcon={false} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-3">{a.rule}</p>
                </div>
                <span className="shrink-0 text-[10px] text-ink-3">{formatRelative(a.ts)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/ingest">
            Open alert queue <ChevronRight className="ml-auto size-3.5" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const role = useSessionStore((s) => s.role);
  const actor = useSessionStore((s) => s.actor);
  const setRole = useSessionStore((s) => s.setRole);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md p-0.5 pr-1.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${initials(actor)} — ${actor}, user menu`}
        >
          <Avatar initials={initials(actor)} />
          <div className="hidden text-left lg:block">
            <p className="text-[11.5px] font-medium leading-tight text-ink">{actor}</p>
            <p className="text-[10px] leading-tight text-ink-3">{ROLE_LABEL[role]}</p>
          </div>
          <ChevronDown className="hidden size-3 text-ink-3 lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2.5 py-2">
          <p className="text-[12px] font-medium text-ink">{actor}</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-3">
            No authentication. This name is written into maker, checker and audit fields.
          </p>
        </div>
        <DropdownSeparator />
        <DropdownLabel>Acting identity</DropdownLabel>
        {(Object.keys(ROLE_LABEL) as Array<keyof typeof ROLE_LABEL>).map((r) => (
          <DropdownMenuItem key={r} onSelect={() => setRole(r)} className="items-start">
            <Shield className="mt-0.5 size-3.5 text-ink-3" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink">
                {ROLE_LABEL[r]} · {ROLE_ACTOR[r]}
              </p>
              <p className="text-[10.5px] leading-snug text-ink-3">{ROLE_DESCRIPTION[r]}</p>
            </div>
            {role === r ? <Check className="mt-0.5 size-3.5 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" className="text-ink-2">
            <LogOut className="size-3.5" /> Leave console
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-3 backdrop-blur-md md:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu className="size-4" />
      </Button>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[11.5px] text-ink-3 transition-colors hover:border-border-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-56"
          aria-label="Search anything… K"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="hidden md:inline">Search anything…</span>
          <span className="ml-auto hidden items-center gap-0.5 md:flex" aria-hidden>
            <Kbd>
              <Command className="size-2.5" />
            </Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <CaseSwitcher />
        <Notifications />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
