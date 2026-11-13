"""Fraxillion - Fraud Investigation & Regulatory Reporting Prototype.

Home page: Displays prototype overview, 7-segment workflow explanation,
academic disclaimer banner, 5-minute demo walkthrough checklist, and live database metrics.
"""

from pathlib import Path
import streamlit as st

from core.db import ensure_db, get_conn

# Set up page configuration
st.set_page_config(
    page_title="Fraxillion — Fraud Investigation Prototype",
    page_icon="🛡️",
    layout="wide",
)

# Guarantee database schema is initialized
ensure_db()

# Academic disclaimer banner required by project guidelines
st.warning(
    "⚠️ **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Report formats are simplified and must not be submitted.**"
)

# Header
st.title("🛡️ Fraxillion — Fraud Investigation System")
st.caption("End-to-End Vertical Slice: Ingestion → Correlation → ML Risk → Graph Money Trail → Evidence → Decision → Reporting")

st.markdown("---")

# ------------------------------------------------------------------
# Live Database Status and Metric Cards
# ------------------------------------------------------------------
def get_counts():
    """Query row counts for primary entities from SQLite."""
    conn = get_conn()
    counts = {}
    try:
        tables = ["alerts", "transactions", "cases", "evidence"]
        for table in tables:
            cur = conn.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cur.fetchone()[0]
    finally:
        conn.close()
    return counts


counts = get_counts()

st.subheader("System Status & Live Metrics")
m1, m2, m3, m4 = st.columns(4)
m1.metric(label="Alerts Ingested", value=f"{counts.get('alerts', 0):,}")
m2.metric(label="Transactions Ingested", value=f"{counts.get('transactions', 0):,}")
m3.metric(label="Investigation Cases", value=f"{counts.get('cases', 0):,}")
m4.metric(label="Sealed Evidence Items", value=f"{counts.get('evidence', 0):,}")

st.markdown("---")

# ------------------------------------------------------------------
# 5-Minute End-to-End Demo Walkthrough Path
# ------------------------------------------------------------------
st.subheader("⏱️ 5-Minute Evaluation & Demo Walkthrough Path")
st.caption("Follow this sequence to demo every segment of the pipeline from raw alerts to regulatory filing:")

with st.expander("🚀 Click to expand the 5-Minute Demo Checklist", expanded=True):
    col_demo1, col_demo2 = st.columns(2)

    with col_demo1:
        st.markdown(
            """
            **Step 1: Boundary Ingestion (0:00 - 1:15)**
            * Go to **`1_Ingest`**.
            * Upload `data/synthetic_alerts_dirty.csv` to demonstrate boundary validation:
              see accepted, rejected, and duplicate rows with clear diagnostic error reasons.
            
            **Step 2: Alert Correlation (1:15 - 2:00)**
            * Go to **`2_Correlate`**.
            * Click **'⚡ Run Correlation'**:
              - See the merchant hub cap trigger for `shop@okaxis` (28 alerts excluded from runaway merging).
              - See 6 candidate cases produced.
            * Click **'📥 Accept as Formal Case'** on **`CAND-1`** (Mule Ring `A0181`, 12 alerts, 8 beneficiaries).
            
            **Step 3: ML Risk Scoring & Explainability (2:00 - 2:45)**
            * Go to **`3_Score`** or view the case in **`5_Cases`**.
            * Inspect the calibrated Random Forest probability score (e.g. `0.76`+), risk gauge, and top weighted features (`device_shared_count`, `is_night`, `new_beneficiaries`).
            """
        )

    with col_demo2:
        st.markdown(
            """
            **Step 4: Interactive Money Trail Graph (2:45 - 3:30)**
            * Go to **`4_Graph`** or the Graph section in **`5_Cases`**.
            * Interact with the 2-hop PyVis network: see rapid nocturnal fan-out to 8 distinct beneficiaries in under 40 minutes.
            
            **Step 5: Evidence Ledger & Tamper Proofing (3:30 - 4:15)**
            * Go to **`6_Evidence`**.
            * Attach a file or click **'📄 Attach Sample Evidence Note'**.
            * Click **'🔍 Verify Cryptographic Chain'** $\to$ passes in green.
            * Click **'⚠️ Simulate Tamper'** $\to$ instant red tamper detection alert! Restore to green.
            
            **Step 6: Maker-Checker & Regulatory Reporting (4:15 - 5:00)**
            * In **`5_Cases`**: Move to `INVESTIGATING`, submit decision as `analyst1`, approve as `compliance_lead` (Maker-Checker rule) $\to$ status moves to `DECIDED`.
            * Go to **`7_Reports`**: Preview RBI DAKSH PFR (.txt) and FIU-IND STR XML, pass pre-export validation, and download the sealed reports.
            """
        )

st.markdown("---")

# ------------------------------------------------------------------
# Segment architecture overview
# ------------------------------------------------------------------
st.subheader("Architectural Mapping (7 Core Segments)")
col_arch1, col_arch2 = st.columns(2)

with col_arch1:
    st.markdown(
        """
        - **1. Boundary Ingestion (`1_Ingest.py`):** Pydantic v2 schemas, raw event retention, idempotent SHA-256 deduplication.
        - **2. Graph Correlation (`2_Correlate.py`):** Attribute blocking (account, device, VPA) with hub-degree exclusion and size caps.
        - **3. ML Risk Engine (`3_Score.py`):** Feature store with rolling velocity and Random Forest model explanation weights.
        - **4. Graph Trail Visualization (`4_Graph.py`):** NetworkX ego graph analysis and heuristic motif detection.
        """
    )

with col_arch2:
    st.markdown(
        """
        - **5. Case Workspace (`5_Cases.py`):** 360-degree case workbench with FSM transitions and Four-Eyes maker-checker approval.
        - **6. Tamper-Evident Evidence (`6_Evidence.py`):** Continuous SHA-256 hash chaining with disk integrity recomputation and manifest ZIP export.
        - **7. Regulatory Reporting (`7_Reports.py`):** Standardized RBI DAKSH (48-field PFR) & FIU-IND STR XML generators with pre-export validation.
        """
    )
