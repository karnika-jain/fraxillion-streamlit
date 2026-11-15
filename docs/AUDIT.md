# Source audit and segment mapping

This document records what exists in the Fraxillion repository and how each part was carried into the new frontend. The repository itself was read only and was not modified.

## 1. Baseline

The source is a seven-segment Streamlit prototype. Streamlit's automatic page navigation is derived from:

```text
app.py                  Home / landing + console shell
pages/1_Ingest.py       Segment 1 · Alert & Transaction Ingestion
pages/2_Correlate.py    Segment 2 · Alert Correlation
pages/3_Score.py        Segment 3 · ML Risk Assessment
pages/4_Graph.py        Segment 4 · Graph Money Trail
pages/5_Cases.py        Segment 6 · Investigation & Case Workspace
pages/6_Evidence.py     Segment 5 · Evidence Management & Hash Chaining
pages/7_Reports.py      Segment 7 · Regulatory Reporting
```

The source README describes the seven functional stages in this order: ingest, correlate, ML score, graph, evidence, decision/workflow, reporting. The Streamlit sidebar itself is ordered by page filename, with `5_Cases` before `6_Evidence`; the new console keeps that visible order.

The source also contains `core/` modules for ingest, correlation, features, scoring, graph analysis, evidence, workflow and reporting, a SQLite database, synthetic CSV data, trained model artifacts, tests and generated report files.

## 2. Route and segment map

| Source | Source behaviour | New route | What was preserved | What changed / is substituted |
| --- | --- | --- | --- | --- |
| `app.py` landing mode | Stripe-styled hero, proof telemetry, workflow, CTA into console | `/` | Public landing → console flow, seven-stage explanation, synthetic-data disclaimer | Rebuilt from scratch with its own copy, palette, typography, layout and motion; no copied Stripe copy/logos/fonts. |
| `app.py` console mode | Counts, evaluation walkthrough and navigation entry | `/app` | Overview workload, queues, SLA, recent activity | Expanded into an operational overview with queue, SLA, case focus, quality gates and workflow rail. |
| `1_Ingest.py` | One-click sample transactions / clean alerts / dirty alerts, custom CSV/JSON preview, ingest result metrics, rejected-row quarantine, database reset | `/app/ingest` | Validation, dedupe, quarantine, batch metrics, alert inspection, sample data context | Sample batch is a typed fixture instead of a SQLite write. Custom upload, raw-file persistence and database reset are not wired. The UI states this. |
| `2_Correlate.py` | Hub threshold and max case size sliders, run correlation, dropped hubs, skipped oversized clusters, candidate review, accept as formal case | `/app/correlate` | Parameters, hub suppression, oversized suppression, candidate cards, accept flow | Correlation is deterministic fixture data (or a fixture-filtering API call). Acceptance is in-memory and does not create a SQLite case. |
| `3_Score.py` | Model comparison metrics, threshold slider, confusion matrix, feature importance, live case scoring with top drivers | `/app/score` | Calibrated case score, model comparison, threshold exploration, confusion matrix, feature attribution, high-risk band context | Case scores and evaluation metrics are fixtures generated from the source model artifacts. The browser does not run `core.score.score_case` or load joblib/sklearn. |
| `4_Graph.py` | Focus by case or account, 1–2 hop ego graph, max nodes, PyVis canvas, fan-out/fan-in/pass-through detectors, snapshot save | `/app/graph` | Case focus, directed money flow, typology detectors, relation legend, path finding | React Flow replaces PyVis. The graph is a typed fixture; no server-side GraphML or snapshot file is written. |
| `5_Cases.py` | Case list, finite state machine transitions, linked alerts/transactions, risk section, graph, read-only evidence, maker decision form, checker approval, case audit | `/app/cases` (queue) and `/app/cases/[caseId]` (Case 360) | Case 360 sections, FSM status, linked alerts/transactions, risk, graph preview, evidence preview, decision form, maker-checker gate, rationale minimum, audit trail | Reads are fixtures. Transition and decision actions are in-memory UI demonstrations; no SQLite write. A case only accepts a proposed decision while `INVESTIGATING`; approval requires lead/compliance and a checker different from the maker. |
| `6_Evidence.py` | Case selector, upload/seal, ledger, SHA-256 chain verification, ZIP bundle export, disk tamper/restore demo | `/app/evidence` | Chain viewer, SHA-256 hashes, genesis, verification, mismatch/restore demo, policy and retention boundary | File bytes and custody are synthetic. Tamper/restore changes an in-memory disk hash. No upload or ZIP bundle exists. The live API path calls the Python canonicaliser and performs the same chain walk. |
| `7_Reports.py` | Eligibility gate (`DECIDED`/`FILED`), PFR render + validation, STR render + validation, history, mark filed | `/app/reports` | Eligibility gate, PFR/CPFIR and STR field names, renderer previews, validation errors, submission boundary, history | The live API calls the real Python renderers and validators. Fixture mode uses their generated previews. FMR is explicitly unavailable. No save-to-exports or regulator filing. |
| Case audit section in `5_Cases.py` | Per-case audit trail table | `/app/audit` | Actor, action, object, details and timestamp | Promoted to a bank-wide, restricted view with filters, row detail, hash/predecessor display and JSON export. It is fixture data; the frontend does not recompute the audit chain. |
| — | No route | `/design` | — | Added internal reference for tokens, primitives, states, overlays, charts and layout. |

## 3. Sidebar names and order

The new console intentionally keeps the source order and names, with the source page numbers visible as short labels:

| Short label | New label | Route |
| --- | --- | --- |
| OV | Overview | `/app` |
| 01 | Ingest | `/app/ingest` |
| 02 | Correlate | `/app/correlate` |
| 03 | ML Score | `/app/score` |
| 04 | Graph | `/app/graph` |
| 05 | Cases | `/app/cases` |
| 06 | Evidence | `/app/evidence` |
| 07 | Reports | `/app/reports` |
| AU | Audit log | `/app/audit` (Governance) |
| DS | Design system | `/design` (Reference) |

Audit remains visible so every segment is discoverable. The page itself renders a designed no-permission state for the investigator role; team lead and compliance can read it. This is a visibility demonstration, not real RBAC.

## 4. Python logic preserved through FastAPI

`api/main.py` is a thin adapter, not a reimplementation of the product. It serves the generated fixture snapshot and delegates where the Python prototype already has real logic.

### 4.1 Reports

`GET /api/cases/{case_id}/reports` builds a canonical case object from the fixture transactions, accounts, alerts and summary, then calls:

- `core.report.render_pfr(canonical)`
- `core.report.validate_pfr(text)`
- `core.report.render_str(canonical)`
- `core.report.validate_str(text)`

The response keeps the Python-rendered `preview` and `validationErrors`, and marks `validationSource` as `core.report.validate_*`. This was verified against the source repository with `CS-2026-0146`: PFR and STR previews validated with zero errors.

The adapter does **not** call `core.report.build_case_object`, because that reads the Streamlit SQLite database. It constructs the same documented shape from the fixture corpus so the source repository remains untouched.

### 4.2 Evidence

`POST /api/evidence/verify?case_id=...` uses `core.evidence.canonical(payload)` to canonicalise `{case_id, file_hash, prev_hash, kind}` and walks the chain from 64 zero characters, comparing:

1. the disk hash with the stored file hash;
2. `prev_hash` with the previous item's `item_hash`;
3. the recomputed SHA-256 with the stored `item_hash`.

`POST /api/evidence/{id}/tamper` and `/restore` change only an in-memory override. A live browser test confirmed: verify intact → tamper → verify fails with the item id → restore → verify intact.

### 4.3 Not delegated to Python

The following source logic is represented by fixtures or client-side behaviour, not by a call into `core`:

| Source logic | Why not called | Current representation |
| --- | --- | --- |
| `core.ingest.ingest_alerts/transactions` | Requires a live SQLite connection and writes records. | Typed fixture batch, validation result and quarantine rows. |
| `core.correlate.correlate/create_case` | Requires the source database; writes cases and links. | Deterministic correlation fixture; the API can filter hubs/size but cannot create a persisted case. |
| `core.features` / `core.score` | Requires joblib models, feature store and case rows. | Source model metrics and case scores are exported as fixtures. |
| `core.graph.build_graph/render_pyvis_html` | Requires the source transaction table. | Precomputed graph fixture rendered with React Flow. |
| `core.workflow` transitions, decisions, approvals | Writes to SQLite and is stateful. | In-memory Zustand demonstration with the same FSM and maker-checker constraints. |
| `core.workflow.get_audit_log` | Reads the source database. | Typed audit fixture with hash-shaped entries. |
| `core.evidence.add_evidence/export_bundle` | Writes files and ZIP archives. | Display-only evidence metadata and a browser tamper demo. |

## 5. Field-name and reporting audit

The report screen uses source field names rather than inventing a new schema.

**PFR / CPFIR-style fields shown:** `case_id`, `entity_code`, transaction rows, subject accounts, grounds of suspicion, source of alert. The generated preview is the repository's pipe-delimited format, including its `PFR:<flag>:<entity>:<DDMMYYYY>:<count>;` header and 48 fields per row.

**STR-style fields shown:** `ReportType`, `CaseId`, `SourceOfAlert`, `GroundsOfSuspicion`, `SuspicionDueToProceedsOfCrime`, `SuspicionDueToComplexTrans`, `SuspicionDueToNoEcoRationale`, `SuspicionOfFinancingOfTerrorism`, `AttemptedTransaction` and the indicator list. The preview is generated by the repository's XML renderer.

**FMR:** no renderer, field specification or validator exists in the source. The FMR tab therefore shows an explicit `TODO(compliance)` state, explains what is missing, and does not fabricate fields or validation.

No regulator acknowledgement, filing reference, submission identifier or “filed” success is invented. The report screen has an explicit submission-boundary panel and the console has a persistent synthetic-demonstration strip.

## 6. UI behaviour audit

- All data screens implement loading, empty, error and no-permission states. Role gates exist for Ingest and Correlate (investigator/lead), the audit log (lead/compliance) and decision approval (lead/compliance).
- The command palette searches cases, accounts, evidence hashes, alerts and navigation. It is opened with ⌘K or Ctrl+K.
- Tables use TanStack Table and virtualisation, support sorting/filtering/column visibility/pinning, and persist saved views in `localStorage`.
- The shell has a collapsible sidebar, mobile drawer, breadcrumb, case switcher, theme toggle and user menu.
- The case workspace enforces the rationale minimum and maker-checker identity before a decision can be approved.
- Currency uses the Indian numbering system (`₹12,46,836.60`), timestamps use IST explicitly, and dates use `DD MMM YYYY`.

## 7. Source files consulted

- `app.py`
- `pages/1_Ingest.py`
- `pages/2_Correlate.py`
- `pages/3_Score.py`
- `pages/4_Graph.py`
- `pages/5_Cases.py`
- `pages/6_Evidence.py`
- `pages/7_Reports.py`
- `core/report.py`
- `core/evidence.py`
- `core/workflow.py`
- `core/correlate.py`
- `core/graph.py`
- `core/ingest.py`
- `core/score.py`
- `README.md`
- `models/eval_metrics.json`
- Tests under `tests/`

No file inside the Streamlit repository was edited.
