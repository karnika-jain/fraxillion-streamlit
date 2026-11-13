# Fraxillion Mini — 7-Segment Fraud Investigation Prototype

> ⚠️ **Honesty & Academic Disclaimer:**  
> **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. Report formats are simplified mock outputs and must not be submitted to real regulatory portals.**

---

## 1. What It Does

Fraxillion is an end-to-end prototype fraud investigation platform built for UPI transaction monitoring. It implements the entire lifecycle a commercial bank needs to handle modern digital financial fraud:

1. **Boundary Ingestion:** Ingests raw alerts and transactions, validating them with Pydantic v2, rejecting malformed rows with plain-English reasons, and idempotently deduplicating via SHA-256 keys.
2. **Alert Correlation:** Clusters related alerts into candidate investigation cases using graph-based attribute linkage (shared accounts, devices, and VPAs) with hub-cap exclusion to prevent high-degree merchants from causing runaway clusters.
3. **Machine Learning Risk Scoring:** Calculates case-level fraud risk probabilities with a calibrated Random Forest classifier, explaining top drivers using model feature weights and deterministic rule heuristics.
4. **Graph Money Trail:** Renders an interactive 2-hop PyVis ego network displaying transaction flow directions and highlighting money-laundering patterns (rapid nocturnal fan-out, fan-in pooling, pass-through layering).
5. **Case Workspace & Workflow Governance:** Manages case progression across a formal finite state machine (`NEW` $\to$ `TRIAGE` $\to$ `INVESTIGATING` $\to$ `DECIDED` $\to$ `FILED`) and enforces the Maker-Checker (Four-Eyes) governance rule.
6. **Tamper-Evident Evidence Ledger:** Cryptographically seals attached case files into a continuous SHA-256 hash chain (`prev_hash` $\to$ `item_hash`), detecting any single-byte disk tampering immediately upon verification.
7. **Regulatory Reporting:** Compiles the canonical case object into mock RBI DAKSH PFR (48-field pipe-delimited format) and FIU-IND FINGate STR (XML format) with rigorous pre-export boundary validation.

---

## 2. Quick Start for Windows

### Prerequisites
- Python 3.11+ (Python 3.11, 3.12, 3.13, 3.14 supported)
- Git

### Installation & Run

```powershell
# 1. Clone repository
git clone https://github.com/karnika-jain/fraxillion-streamlit.git
cd fraxillion-streamlit

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# 3. Install pinned dependencies
pip install -r requirements.txt

# 4. Generate synthetic datasets and baseline database
python scripts/generate_data.py
python scripts/reset_demo.py

# 5. Launch the Streamlit application
streamlit run app.py
```
Open **`http://localhost:8501`** in your browser.

---

## 3. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Data Ingestion                       │
│  CSV / JSON Upload  ──▶  Pydantic v2 Boundary Check    │
│  Raw Events Store   ──▶  SHA-256 Idempotent Dedupe     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Graph Alert Correlation                  │
│  Shared Keys (Acct, Dev, VPA) ──▶ Hub Cap (shop@okaxis)│
│  NetworkX Connected Comps     ──▶ 4-8 Candidate Cases  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Case 360° Workspace                    │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │ ML Risk Engine        │  │ Money Trail Graph     │  │
│  │ Random Forest + Feats │  │ 2-Hop PyVis / NetX    │  │
│  └───────────────────────┘  └───────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ State Machine & Maker-Checker Governance         │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────┬──────────────┘
                │                         │
                ▼                         ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  Tamper-Evident Evidence     │ │    Regulatory Reporting      │
│  SHA-256 Hash Chain Linking  │ │  Canonical Case JSON Object  │
│  Disk Re-Hash Verification   │ │  RBI DAKSH PFR (.txt, 48 col)│
│  Sealed ZIP with Manifest    │ │  FIU-IND FINGate STR (.xml)  │
└──────────────────────────────┘ └──────────────────────────────┘
```

---

## 4. Segment-to-File Mapping

| Segment | Module / Files | Description |
|---|---|---|
| **Segment 1: Ingest** | `core/models.py`, `core/ingest.py`, `pages/1_Ingest.py` | Pydantic validation schemas, raw event logging, duplicate filtering. |
| **Segment 2: Correlate** | `core/correlate.py`, `pages/2_Correlate.py` | Graph connected components, hub exclusion cap, case candidate promotion. |
| **Segment 3: ML Score** | `core/features.py`, `core/score.py`, `pages/3_Score.py`, `models/` | Feature store with 24h rolling velocity, trained Random Forest model. *(Teammate module)* |
| **Segment 4: Graph** | `core/graph.py`, `pages/4_Graph.py` | NetworkX money trail analysis, PyVis interactive HTML renderer. *(Teammate module)* |
| **Segment 5: Evidence** | `core/evidence.py`, `pages/6_Evidence.py` | Continuous SHA-256 hash chaining, disk integrity recomputation, manifest bundle export. |
| **Segment 6: Workflow** | `core/workflow.py`, `core/integration.py`, `pages/5_Cases.py` | FSM transitions, Four-Eyes maker-checker approval, integration bridge. |
| **Segment 7: Reporting** | `core/report.py`, `pages/7_Reports.py` | 48-field RBI DAKSH PFR renderer, FIU-IND STR XML builder, pre-export validator. |

---

## 5. 5-Minute Evaluation & Demo Walkthrough

1. **Home (`app.py`):** Review live system metrics and view the built-in walkthrough guide.
2. **`1_Ingest` (Boundary Ingestion):** Upload `data/synthetic_alerts_dirty.csv` as Alerts. See accepted rows, rejected rows with clear plain-English errors (e.g. invalid score, negative values), and duplicate counts.
3. **`2_Correlate` (Graph Correlation):** Click **"⚡ Run Correlation"**.
   - Notice the **Excluded Hub Attributes** expander: `shop@okaxis` had 28 alerts and was dropped as a hub to prevent runaway clustering.
   - Click **"📥 Accept as Formal Case"** on `CAND-1` (Mule Ring `A0181`, 12 alerts, 8 beneficiaries).
4. **`5_Cases` (Case 360 Workbench):**
   - **ML Risk Section:** Displays live score (e.g. `0.76`+), risk badge, and weighted feature importances.
   - **Interactive Graph:** Visualizes nocturnal rapid outbound fan-out across 8 beneficiaries.
5. **`6_Evidence` (Tamper Proofing):**
   - Click **"📄 + Attach Sample Evidence Note"**.
   - Click **"🔍 Verify Cryptographic Chain"** $\to$ passes in green (`1 item checked`).
   - Click **"⚠️ Simulate Tamper on Disk"** $\to$ click verify again to see immediate red tamper detection (`❌ TAMPER DETECTED: Stored hash does not match disk hash`). Click restore to return to green.
6. **`5_Cases` (Maker-Checker Sign-off):**
   - Move status to `INVESTIGATING`.
   - Submit decision as Maker `analyst_john` with grounds $\ge 100$ characters.
   - Approve decision as Checker `compliance_lead` (enforcing Four-Eyes principle) $\to$ status moves to `DECIDED`.
7. **`7_Reports` (Regulatory Filing):**
   - Previews RBI DAKSH (48-field PFR) and FIU-IND STR XML.
   - Green validation badges indicate pre-export verification passed.
   - Download reports and click **"🏁 Mark as Filed"**.

---

## 6. Running Automated Tests

Run the full automated test suite with pytest:

```powershell
pytest -v
```

All **23 unit tests** execute against isolated temporary databases:
- `test_ingest.py`: Rejection of negative amounts, zero amounts, and duplicate alert detection.
- `test_correlate.py`: Hub attribute exclusion and candidate case formation.
- `test_features.py`: Rolling velocity, night execution flags, and pass-through ratios.
- `test_score.py`: Case-level model risk inference, feature explanations, and rankings.
- `test_graph.py`: Fan-out, fan-in, and pass-through motif detectors and HTML contracts.
- `test_integration.py`: Safe integration fallbacks for external modules.
- `test_evidence.py`: SHA-256 hash chain creation, tamper detection, and ZIP bundle manifest.
- `test_workflow.py`: FSM state transitions, rationale minimum length, and maker-checker rule enforcement.
- `test_report.py`: PFR header count matching, 48-field sanitization, and STR XML grounds validation.

---

## 7. Limitations & Production Roadmap

### Known Simplifications in this Prototype
- **Synthetic Data & SQLite:** Uses generated mock UPI data and SQLite for zero-setup local execution rather than Apache Kafka and distributed database clusters.
- **Rule-Based Blocking:** Uses exact attribute linkage for correlation instead of probabilistic entity resolution (e.g. Splink / Fellegi-Sunter).
- **Demo Report Outputs:** Rendered reports adhere to open regulatory specifications but are not connected to live government gateways (RBI DAKSH API or FIU-IND FINGate).
- **Simple Hash Chain:** Uses SHA-256 linked hashes rather than RFC 3161 hardware timestamping authorities (TSA) or WORM storage.

### What We Would Build Next in a Production Deployment
- **Kafka & Flink Pipeline:** Real-time sub-second streaming ingestion from bank core switch feeds.
- **Probabilistic Entity Resolution:** Splink-based probabilistic record linkage on customer names, phone hashes, and IP subnets.
- **Graph Database:** Transition from in-memory NetworkX to Neo4j or Amazon Neptune for billion-edge real-time multi-hop graph queries.
- **Hardware Security Modules (HSM):** Digital signatures with PKCS#11 HSM keys for court-admissible evidence packages.
