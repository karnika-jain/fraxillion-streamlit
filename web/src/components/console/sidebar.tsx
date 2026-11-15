"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ExternalLink, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn, formatNumber, initials, ROLE_LABEL } from "@/lib/utils";
import { SEGMENTS } from "@/lib/navigation";
import { useDataset } from "@/lib/queries";
import { useUIStore, useSessionStore } from "@/stores";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, Kbd } from "@/components/ui/misc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/overlays";
import { API_MODE_LABEL } from "@/lib/api";

function NavLink({
  href,
  label,
  short,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  short: string;
  icon: React.ElementType;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
  const content = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-accent-soft font-medium text-accent-ink"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      {active ? (
        <span className="absolute -left-1 top-1.5 h-6 w-[2px] rounded-full bg-accent" aria-hidden />
      ) : null}
      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-ink-3")} strokeWidth={1.8} />
      {!collapsed ? (
        <>
          <span className="truncate">{label}</span>
          <span className="ml-auto font-mono text-[9px] tracking-[0.08em] text-ink-3">{short}</span>
        </>
      ) : null}
    </Link>
  );

  if (!collapsed) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">
        {label} · {short}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const role = useSessionStore((s) => s.role);
  const actor = useSessionStore((s) => s.actor);
  const { data: dataset } = useDataset();
  const workflow = SEGMENTS.filter((s) => s.group === "workflow");
  const governance = SEGMENTS.filter((s) => s.group === "governance");

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-[width,transform] duration-200 ease-out",
          collapsed ? "w-[68px]" : "w-[248px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Console navigation"
      >
        <div
          className={cn(
            "flex h-[60px] shrink-0 items-center border-b border-border px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Logo href="/app" compact={collapsed} />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={onMobileClose}
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-4">
          {!collapsed ? <p className="label-mono mb-2 px-2.5">Segments</p> : null}
          <div className="space-y-0.5">
            {workflow.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                short={item.short}
                icon={item.icon}
                collapsed={collapsed}
                onNavigate={onMobileClose}
              />
            ))}
          </div>

          <div className="my-4 h-px bg-border" />
          {!collapsed ? <p className="label-mono mb-2 px-2.5">Governance</p> : null}
          <div className="space-y-0.5">
            {governance.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                short={item.short}
                icon={item.icon}
                collapsed={collapsed}
                onNavigate={onMobileClose}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 space-y-2 border-t border-border p-2">
          {!collapsed ? (
            <div className="rounded-md border border-border bg-surface-2 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-1.5 rounded-full", dataset?.loaded ? "bg-verified" : "bg-border-strong")}
                  aria-hidden
                />
                <span className="text-[10.5px] font-medium text-ink-2">
                  {dataset?.loaded ? "Dataset loaded" : "Dataset empty"}
                </span>
              </div>
              {dataset?.loaded ? (
                <p className="mt-1 font-mono text-[9.5px] tabular-nums text-ink-3">
                  {formatNumber(dataset.transactions)} txns · {formatNumber(dataset.alerts)} alerts ·{" "}
                  {formatNumber(dataset.cases)} cases
                </p>
              ) : (
                <p className="mt-1 text-[9.5px] leading-relaxed text-ink-3">
                  Load the sample corpus from the guide above.
                </p>
              )}
              <p className="mt-1 truncate font-mono text-[9px] text-ink-3" title={API_MODE_LABEL}>
                {API_MODE_LABEL}
              </p>
            </div>
          ) : null}

          {collapsed ? (
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
          ) : (
            <ThemeToggle variant="full" />
          )}

          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-[11.5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0",
            )}
            onClick={onMobileClose}
          >
            <ExternalLink className="size-3.5" />
            {!collapsed ? "Back to landing page" : null}
          </Link>

          {!collapsed ? (
            <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
              <Avatar initials={initials(actor)} />
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-medium text-ink">{actor}</p>
                <p className="truncate text-[10px] text-ink-3">{ROLE_LABEL[role]}</p>
              </div>
              <span className="ml-auto">
                <Kbd>?</Kbd>
              </span>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function ConsoleBackLink() {
  return <ChevronLeft className="size-3.5" aria-hidden />;
}
