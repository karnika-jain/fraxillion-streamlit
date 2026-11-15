# Design decisions

The console is for investigators who live in the product for a full shift. The landing page is for a bank evaluator who needs to understand the workflow in a few minutes. The same tokens and primitives serve both, but the information density is deliberately different.

## 1. Visual direction

**Warm paper, deep pine, no neon.** A fraud console should feel like an operations desk, not a trading terminal. The light palette uses a warm neutral page, opaque white surfaces, a single deep-pine accent and severity colours that stay distinct at small sizes. The dark palette is a designed green-black workspace with mint accents and muted severity fills, not a mechanically inverted light theme.

The landing page uses a soft sage/sand atmosphere behind the hero. It is visible, not dominant: the product visual and the copy remain the focus. The gradient is made from tokens and has a static fallback under reduced motion.

**No glassmorphism, no purple-blue clichés, no decorative CPU loops.** A subtle backdrop blur is used only on the sticky navigation. Cards are opaque, separated by one border and one restrained shadow. There is no card inside a card, no “AI sparkle” icon and no emoji used as an icon.

## 2. Tokens

All colours live in `web/src/styles/tokens.css`. Components consume semantic variables, never raw hex values.

| Token group | Purpose |
| --- | --- |
| `--bg`, `--bg-subtle` | Page canvas and atmospheric background |
| `--surface`, `--surface-2`, `--surface-3` | Panels, inset areas and controls |
| `--ink`, `--ink-2`, `--ink-3` | Primary, secondary and muted text |
| `--border`, `--border-strong` | Hairline and stronger separators |
| `--accent`, `--accent-hover`, `--accent-soft`, `--accent-ink` | Primary action and selected states |
| `--critical`, `--high`, `--medium`, `--low` | Severity |
| `--verified`, `--mismatch`, `--pending` | Integrity and workflow states |
| `--chart-*`, `--graph-*` | Data visualisation |
| `--hero-*` | Landing atmosphere |
| `--band-*` | Full-bleed landing statement band (deep pine in both themes) |
| `--shadow-*` | Elevation scale |

The light `--ink-3` was darkened from `#6d7973` to `#5f6b65` so muted text meets contrast on the page background. Dark `--ink-3` is `#85958d`.

**Severity is never colour alone.** `SeverityBadge` pairs a tinted surface with a label and, where space allows, an icon. Verified/mismatch/pending badges pair colour with text and an icon.

## 3. Typography

- **UI:** Geist Sans. It is a neutral neo-grotesque with good small-size legibility and a compact, modern rhythm.
- **Emphasis:** Instrument Serif italic. Used for one phrase in a display heading, never for body copy.
- **Identifiers, hashes and figures:** Geist Mono with tabular numerals.

The console uses a small type scale:

| Role | Size / treatment |
| --- | --- |
| Page title | 26px, semibold, tight tracking |
| Section title | 13–15px, semibold |
| Body | 11–12.5px, relaxed leading |
| Table text | 10–12px |
| Labels | 9.5–10px, uppercase, 0.07em tracking |
| Hash / code | 9.5–11px mono |

Small text is a conscious choice for a dense operations tool, but it is paired with high contrast, generous row height and a larger display scale on the landing page. The UI never drops below 9px.

## 4. Layout

### Console

```text
┌──────────────┬──────────────────────────────────────────────────────┐
│ Sidebar      │ Top bar: breadcrumb · search · case · alerts · user  │
│              ├──────────────────────────────────────────────────────┤
│ Workflow     │ Synthetic demonstration strip                         │
│ Governance   ├──────────────────────────────────────────────────────┤
│ Reference    │ Page header                                           │
│              │ ┌──────────────────────────────┐ ┌────────────────┐ │
│              │ │ Main content                 │ │ Context rail   │ │
│              │ │ tables · charts · forms      │ │ stage + risk   │ │
│              │ └──────────────────────────────┘ └────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────┘
```

- The sidebar is 248px expanded and 68px collapsed. It is keyboard-operable, has a visible focus ring, and every collapsed icon has a tooltip with the full label.
- The top bar is 60px. The case switcher and user menu include visible labels in their accessible names.
- The content max-width is 1560px, but the information hierarchy is driven by grids rather than a single centered column.
- The right context rail is a 300px column on wide screens and stacks below the main content on narrow screens. It holds the case context, stage stepper and evidence links, not decorative cards.
- Tables are virtualised, capped to a sensible height and expose column visibility, pinning, sorting and saved views.

### Landing

The landing page uses a wider marketing rhythm: 1224px container, 68px navigation, a centered hero, a full-width product visual, then alternating sections. The workflow section is a two-column selector/detail layout; the integrity section pairs a narrative with a real chain surface. The final CTA is contained rather than full-bleed.

## 5. Interaction and state design

- **Loading:** skeleton rows that preserve the final layout, never a centered spinner that collapses the page.
- **Empty:** explain why the surface is empty and offer the next action. “No alerts in this filter” is different from “No evidence sealed”.
- **Error:** name the failed read model, provide a retry button, and keep the rest of the shell usable.
- **No permission:** explains the role gate and how to switch roles in the demo; it does not pretend to be real IAM.
- **Destructive / high-stakes actions:** use a dialog or a two-step confirmation, not a toast-only success. Decision approval is separated from proposal.
- **Toasts:** Sonner, bottom-right, non-blocking. Long-running actions keep the button in a busy state and show the result in the surface that owns the action.
- **No auto-refresh loops.** Time-sensitive data uses explicit timestamps and relative labels; the demo does not simulate live ticking counters.

## 6. Case workflow and governance

The source state machine is preserved:

```text
NEW → TRIAGE → INVESTIGATING → DECIDED → FILED
                 ↘ CLOSED       ↘ CLOSED
```

The UI displays allowed transitions and blocks invalid ones. A decision can only be proposed while the case is `INVESTIGATING`. Approval requires a team lead or compliance officer and a checker whose identity differs from the maker. The rationale minimum is enforced in the form. In this build, the transition and approval are in-memory demonstrations; the screen says so.

## 7. Evidence

- Evidence is displayed read-only in the normal flow. Attaching is a separate action with an actor and acquisition note.
- The chain viewer shows file hash, previous hash, item hash, custody and verification state.
- Verification states are explicit: `VERIFIED`, `PENDING`, `MISMATCH`, and a banner names the failing item.
- The tamper demo changes one expected disk hash in memory. Restore returns it to the original value. The UI states that no file on disk is modified.
- The policy tab distinguishes tamper-evident from tamper-proof and calls out retention, legal hold, external timestamping and backup as unimplemented.

## 8. Reporting

- PFR/CPFIR and STR are the only formats the source repository supports. Their field names and renderer output are preserved.
- FMR is a first-class “not implemented” state with `TODO(compliance)`. It is not hidden and it is not invented.
- Eligibility is explicit: a case must be `DECIDED` or `FILED`. The blocked state explains the path back to the decision record.
- The report screen separates draft completeness, preview, validation, history and submission boundary. “Mark ready for sign-off” does not pretend to file anything.
- No regulator reference number or acknowledgement is fabricated.

## 9. Localisation

The console is India-first:

- Currency uses the Indian numbering system: `₹12,46,836.60` and compact `₹12.47 L` / `₹1.25 Cr`.
- Storage and display use IST. Date-time strings include `IST` explicitly.
- Dates use `DD MMM YYYY` (for example, `13 Nov 2026`).
- Relative times use “in 3 hours”, “yesterday” and “2 days ago” alongside an absolute timestamp in detail views.

## 10. Accessibility

Target: WCAG 2.2 AA.

- Semantic landmarks and heading order; skip link to `#main`.
- Visible focus ring from `--ring`.
- Icon-only buttons have explicit accessible names; visible labels are included in names where required by label-in-name.
- Hit targets are at least 24×24px for compact icon controls; carousel dots use 24×24px targets.
- Severity and status never rely on colour alone.
- Sidebar, dialogs, dropdowns, tabs, tooltips and the command palette use Radix primitives for focus management.
- Tables have row headers where appropriate, keyboard-selectable rows and an accessible empty state.
- Reduced motion disables non-essential animation.
- Lighthouse accessibility scored **1.00** for `/` and `/app` after the final fixes.

## 11. Theme

Light is the default on first load. A tiny inline script applies the persisted theme before paint to avoid a flash. The theme toggle updates `localStorage` and `document.documentElement.dataset.theme`. Charts and the graph read CSS variables, so both themes are intentionally designed rather than filtered versions of each other.

## 12. Deliberate exclusions

- No real authentication, SSO, IAM or session expiry.
- No live bank feed, core banking integration or Kafka pipeline.
- No regulator gateway, filing reference or acknowledgement.
- No real file upload or evidence store.
- No server-side persistence for decisions, accepted candidates or report readiness.
- No customer logos, quotes, ratings or production performance claims.
