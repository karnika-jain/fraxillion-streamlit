"""Fraxillion - Fraud Investigation & Regulatory Reporting Prototype.

Home page: Displays prototype overview, 7-segment workflow explanation,
academic disclaimer banner, and live database metrics.
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

# Segment overview
st.subheader("Overview of the 7 Investigation Segments")

col1, col2 = st.columns(2)

with col1:
    st.markdown(
        """
        1. **Alert Ingestion (`1_Ingest.py`):** Ingest raw alerts and UPI transactions with boundary validation and deduplication.
        2. **Alert Correlation (`2_Correlate.py`):** Graph-based clustering on shared accounts, devices, and VPAs with hub exclusion.
        3. **ML Risk Assessment (`3_Score.py`):** Supervised fraud scoring and feature importance explanations.
        4. **Graph Money Trail (`4_Graph.py`):** Interactive 2-hop ego network and deterministic anomaly detectors (fan-out, pass-through).
        """
    )

with col2:
    st.markdown(
        """
        5. **Case Workspace & Investigation (`5_Cases.py`):** Case 360 view, state machine transitions, and maker-checker decisions.
        6. **Evidence Management (`6_Evidence.py`):** Tamper-evident SHA-256 hash chaining with one-click verification and export.
        7. **Regulatory Reporting (`7_Reports.py`):** Canonical case model mapped into mock CPFIR (PFR) and STR (XML/JSON) regulatory outputs.
        """
    )

st.markdown("---")

# Database status and row counts
st.subheader("System Status & Database Counts")


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

m1, m2, m3, m4 = st.columns(4)
m1.metric(label="Alerts", value=counts.get("alerts", 0))
m2.metric(label="Transactions", value=counts.get("transactions", 0))
m3.metric(label="Cases", value=counts.get("cases", 0))
m4.metric(label="Evidence Items", value=counts.get("evidence", 0))

st.markdown("---")
st.info("💡 To begin, navigate to **1_Ingest** using the sidebar to ingest synthetic transactions and alerts.")
