# Known gaps and stubs

This is the honest inventory of what the delivery does **not** do. It is written for the next engineer, not for a demo audience. Nothing below is hidden behind a loading state or a fake success message: where behaviour is simulated, the UI says so in the sample-data strip, and this file explains the boundary.

The frontend is a complete, navigable interface. The data behind it is synthetic, and every write path is either in memory or behind a documented `TODO(compliance)` marker.

---

## 1. Runtime boundaries

| Area | Status | Where the boundary lives |
| --- | --- | --- |
| Authentication / SSO | Not implemented | No login route, no tokens, no server session. The role switcher is a demo control. |
| Authorization | Demo-only | `useSessionStore` reads a role from `localStorage`; `/app/audit` renders a no-permission state for `investigator`, but nothing is enforced server-side. |
| Persistence | None | Fixtures are compiled into the client. Decisions, notes, accepted candidates, tamper/restore and “mark ready” live in Zustand or React state and disappear on reload. |
| Live bank feed | None | Ingest reads a fixed sample batch; “Run sample ingest” returns canned results. |
| Database / SQLite | Not touched | The adapter never imports `core.db` and never writes to the Streamlit database. |
| Regulator transmission | None | Report previews are rendered text/HTML for review. Nothing is filed, queued or acknowledged. |
| Audit trail | Append-only in fixtures only | The audit page reads the fixture log. New actions are not appended to a durable or hash-chained store. |

## 2. Data and domain gaps

- **Synthetic corpus.** Six cases (`CS-2026-0142` … `CS-2026-0147`), a fixed alert set, one correlation run and one evidence chain. Account IDs, names, amounts and hashes are generated for the demo. No real customer data is present.
- **Scoring is fixture-defined.** `/app/score` shows calibrated risk, threshold bands, feature attribution and model metrics from `src/mocks/`. There is no live model inference in the browser and no model artefact served by the API. Threshold changes recompute display buckets, not real scores.
- **Correlation is fixture-defined.** Hub suppression and candidate formation read `mockCorrelation`. Accepting a candidate adds it to an in-memory queue; it does not create a case record or run the Python conversion pipeline.
- **Graph is a fixed topology.** Path finding and typology detectors operate on the fixture graph. There is no query over a transaction store, no temporal windowing and no pagination for large graphs.
- **Evidence chain is a demo chain.** Hashes are real SHA-256 values over canonical JSON, computed at build time and verified in the browser (or by the API). But the chain is a fixture, not a signed append-only ledger. Tamper/restore edits an in-memory override; it never writes a file. There is no external timestamping, no key custody, no WORM storage and no independent verifier.
- **No chain-level verification.** Each item’s hash and predecessor link are checked; the fixture chain does not include a signed root, so “verified” means “internally consistent”, not “provably untampered”. The UI wording reflects this.
- **Audit log is not hash-chained.** Rows are fixture records with actor, action and timestamp. There is no chained digest, no immutable sink and no tamper detection on audit rows.
- **Timestamps are display-only.** Console formatting is ₹ with lakh/crore grouping, IST and `DD MMM YYYY`; the underlying fixtures use ISO strings. Timezone conversion is presentation-level, not a bank time service.
- **No alert triage write-back.** Status chips and validation/quarantine panels are read-only except for local UI state.

## 3. Reporting gaps

The reporting page is deliberately conservative about compliance claims.

| Report | Status | Notes |
| --- | --- | --- |
| PFR / CPFIR-style | Preview only | Uses the field names and renderers from `core.report.render_pfr` when the API is running; otherwise the same typed payloads are rendered client-side. Validation warnings come from `validate_pfr`. Nothing is saved or transmitted. |
| STR-style | Preview only | Uses `core.report.render_str` / `validate_str` through the API. The narrative is fixture text assembled from the case, not an investigator-authored filing. |
| FMR | **Unavailable** | The source repository has no FMR renderer, field specification or validator. The UI states this and marks the panel `TODO(compliance)` rather than inventing a format. |
| Regulatory identifiers | **Not fabricated** | No acknowledgement numbers, filing references, BSR codes, regulator names or submission statuses are generated. Where a real system would need one, the interface says it is not available in this demo. |
| Report history | Fixture rows | “Mark ready” and history rows are in-memory. No versioning, no maker-checker on reports, no export to PDF/DOCX and no e-signature. |
| Eligibility rules | Demo logic | The case picker shows eligible/blocked states from fixture fields. Real eligibility depends on bank policy, jurisdiction and filing calendar, which are out of scope. |

## 4. Decision and workflow gaps

- Decision proposals are allowed only when a case is `INVESTIGATING`; this rule is enforced in the UI, not by a server.
- Maker-checker is simulated: the approver must be a lead/compliance role and must differ from the maker. There is no identity provider, so “different person” is a role/name comparison.
- Status changes, approvals, notes and SLA clocks are in memory. Reloading restores the fixture state.
- No notifications, task assignment, escalation timers, four-eyes on evidence export, or case locking.
- The case switcher and command palette search the fixture corpus only; there is no cross-case full-text index.

## 5. FastAPI adapter scope

`api/main.py` is a thin read/preview adapter, not a backend service.

- It serves a generated snapshot (`api/fixtures.json`) over the same contract as the mock layer.
- It delegates **only** report rendering/validation (`core.report`) and evidence canonicalisation (`core.evidence`). Everything else returns fixture data.
- It has no authentication, rate limiting, audit sink, database connection or write path to the Streamlit project.
- `POST /api/correlate/run`, `/api/correlate/accept`, `/api/ingest/sample`, `/api/evidence/*/tamper` and `/api/evidence/*/restore` mutate process memory only; restarting the process resets them.
- The adapter expects the source repository at `../fraxillion-streamlit`. If it is missing it still starts, but report previews fall back to snapshot text and the “delegated to Python core” claim becomes “fixture-only”.
- No OpenAPI client is generated; `src/lib/api.ts` is the contract and must be updated by hand if endpoints change.

## 6. Frontend and UX gaps

- **Virtualisation is applied to the dense tables**, but the graph canvas and some long lists are not virtualised. Very large fixture sets would need windowing.
- **Search is fixture-scoped.** The top bar search and `⌘/Ctrl+K` palette search cases, alerts, evidence and routes; there is no fuzzy ranking service, saved searches shared across users, or result highlighting inside documents.
- **No internationalisation.** Copy is English with Indian regulatory vocabulary. Currency and date formatting are fixed to ₹/IST/`DD MMM YYYY`; a multi-currency or multi-timezone deployment needs a formatting layer.
- **No PDF/print stylesheet** for reports or case files.
- **No offline or degraded-network design beyond error states.** TanStack Query retries are default; there is no offline queue.
- **No automated test suite.** Verification is `typecheck`, `lint`, `build`, a Lighthouse accessibility pass and manual browser checks. There are no unit, component or end-to-end tests in the delivery.
- **No visual regression baseline.** Screenshots in `docs/screens/` are documentation, not asserted snapshots.
- **Import is absent and export is narrow.** Tables export the currently loaded fixture rows to CSV, the audit page exports JSON and a report preview can be copied or downloaded as text. There is no signed evidence manifest, no case-file bundle and no import path.
- **Keyboard and screen-reader coverage** was checked with Lighthouse and manual tab order; it has not been tested with NVDA/JAWS/VoiceOver or with a formal WCAG 2.2 AA audit.
- **Mobile layout** is usable down to tablet width; the console is designed for desktop investigation work and does not have a dedicated phone workflow.
- **Reduced motion** is honoured for the landing atmosphere and transitions, but chart animation should be re-checked if new charts are added.

## 7. What a real deployment would need next

1. Identity: OIDC/SSO, server-side session, role claims, and enforcement on every endpoint.
2. Durable case/decision store with optimistic concurrency and an append-only audit sink.
3. Real ingest: connector, schema validation, quarantine workflow and replay.
4. Model serving with versioned artefacts, drift monitoring and explainability stored per decision.
5. Evidence: object storage with WORM/retention, signed manifests, external timestamping and an independent verifier.
6. Reporting: jurisdiction-specific field maps, maker-checker on filings, regulator gateway integration and acknowledgement tracking. FMR needs a specification before any UI is built.
7. Operations: tests, CI, observability, rate limits, backup/restore and a security review.
8. Compliance review of every label, claim and colour-coded severity before external use.

## 8. Files that are intentionally incomplete

- `api/main.py` — read/preview adapter; in-memory writes only.
- `api/fixtures.json` — generated snapshot; regenerate with `npm --prefix web run fixtures` after changing mocks.
- `src/mocks/index.ts` — the single synthetic source; not a database.
- `src/lib/api.ts` — mock/live switch; extend both branches when adding endpoints.
- Report FMR panel — `TODO(compliance)` placeholder by design.
