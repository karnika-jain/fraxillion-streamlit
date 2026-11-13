"""Fraxillion - Segment 1: Alert & Transaction Ingestion.

Allows investigators to upload CSV or JSON datasets of alerts or transactions,
or select pre-generated synthetic datasets for immediate demonstration.
Applies boundary Pydantic validation, raw-payload preservation, and deduplication.
"""

import json
from pathlib import Path
import pandas as pd
import streamlit as st

from core.db import ensure_db, get_conn
from core.ingest import ingest_alerts, ingest_transactions

# Page setup
st.set_page_config(
    page_title="1 · Ingest Alerts & Transactions — Fraxillion",
    page_icon="📥",
    layout="wide",
)

# Ensure database tables exist
ensure_db()

# Academic disclaimer banner
st.warning(
    "⚠️ **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Report formats are simplified and must not be submitted.**"
)

st.title("📥 Segment 1: Alert & Transaction Ingestion")
st.caption("Boundary validation (Pydantic v2) · Raw-first storage (`raw_events`) · Deterministic Deduplication")

st.markdown("---")

project_root = Path(__file__).resolve().parent.parent
sample_txns_path = project_root / "data" / "synthetic_transactions.csv"
sample_alerts_path = project_root / "data" / "synthetic_alerts.csv"
sample_dirty_path = project_root / "data" / "synthetic_alerts_dirty.csv"

# Two tabs: Quick Sample Datasets vs Custom File Upload
tab_samples, tab_upload = st.tabs(["⚡ Sample Datasets (1-Click Demo)", "📁 Upload Custom CSV / JSON"])

with tab_samples:
    st.subheader("Select a Pre-Generated Synthetic Dataset")
    st.caption("These datasets match Section 4 and Appendix A of the build plan.")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("#### 1. Transactions")
        st.write("`synthetic_transactions.csv`")
        st.caption("~5,000 UPI transactions with 3 injected mule rings, pass-through, and fan-in.")
        if st.button("📄 Load Transactions", key="btn_sample_txns"):
            if sample_txns_path.exists():
                st.session_state["active_df"] = pd.read_csv(sample_txns_path)
                st.session_state["active_type"] = "Transactions"
                st.session_state["active_filename"] = "synthetic_transactions.csv"
                st.session_state.pop("ingest_result", None)
                st.rerun()

    with col2:
        st.markdown("#### 2. Clean Alerts")
        st.write("`synthetic_alerts.csv`")
        st.caption("300 alerts (60 fraud signals + 240 normal rules + hub alerts).")
        if st.button("📄 Load Clean Alerts", key="btn_sample_alerts"):
            if sample_alerts_path.exists():
                st.session_state["active_df"] = pd.read_csv(sample_alerts_path)
                st.session_state["active_type"] = "Alerts"
                st.session_state["active_filename"] = "synthetic_alerts.csv"
                st.session_state.pop("ingest_result", None)
                st.rerun()

    with col3:
        st.markdown("#### 3. Dirty Alerts")
        st.write("`synthetic_alerts_dirty.csv`")
        st.caption("25 alerts with 7 invalid records (score > 1, bad timestamp, missing IDs).")
        if st.button("⚠️ Load Dirty Alerts (Quarantine)", key="btn_sample_dirty"):
            if sample_dirty_path.exists():
                st.session_state["active_df"] = pd.read_csv(sample_dirty_path)
                st.session_state["active_type"] = "Alerts"
                st.session_state["active_filename"] = "synthetic_alerts_dirty.csv"
                st.session_state.pop("ingest_result", None)
                st.rerun()

with tab_upload:
    st.subheader("Upload Your Own Dataset")
    upload_type = st.radio(
        "Choose record type:",
        options=["Transactions", "Alerts"],
        horizontal=True,
        key="radio_upload_type",
    )
    uploaded_file = st.file_uploader(
        f"Select {upload_type} file (CSV or JSON)",
        type=["csv", "json"],
        key="custom_file_uploader",
    )
    if uploaded_file is not None:
        try:
            if uploaded_file.name.endswith(".json"):
                df_custom = pd.DataFrame(json.load(uploaded_file))
            else:
                df_custom = pd.read_csv(uploaded_file)
            st.session_state["active_df"] = df_custom
            st.session_state["active_type"] = upload_type
            st.session_state["active_filename"] = uploaded_file.name
            st.session_state.pop("ingest_result", None)
        except Exception as e:
            st.error(f"Error parsing uploaded file: {e}")

# ------------------------------------------------------------------
# Display Data Preview and Action Button
# ------------------------------------------------------------------
active_df = st.session_state.get("active_df")
active_type = st.session_state.get("active_type", "Transactions")
active_filename = st.session_state.get("active_filename", "")
if active_df is not None:
    st.markdown("---")
    col_prev1, col_prev2 = st.columns([3, 1])
    with col_prev1:
        st.subheader(f"📋 Loaded Dataset: `{active_filename}` ({len(active_df):,} total rows)")
    with col_prev2:
        show_all = st.checkbox("Show all rows", value=False, key="chk_show_all_rows")

    if show_all:
        st.caption(f"Showing all {len(active_df):,} rows:")
        st.dataframe(active_df, use_container_width=True)
    else:
        st.caption(f"Showing first 20 rows (rows 0 to 19) as a quick preview. Check **'Show all rows'** above to scroll through all {len(active_df):,} rows.")
        st.dataframe(active_df.head(20), use_container_width=True)

    if st.button(f"🚀 Ingest {active_type} into Database", type="primary", key="btn_do_ingest"):
        # Convert DataFrame to records, converting NaN values to None
        records = active_df.where(pd.notnull(active_df), None).to_dict(orient="records")

        conn = get_conn()
        try:
            with st.spinner(f"Ingesting and validating {len(records):,} {active_type.lower()}..."):
                if active_type == "Alerts":
                    result = ingest_alerts(records, conn)
                else:
                    result = ingest_transactions(records, conn)
                st.session_state["ingest_result"] = result
                st.session_state["last_ingested_type"] = active_type
                st.rerun()
        finally:
            conn.close()

# ------------------------------------------------------------------
# Display Persistent Ingestion Results
# ------------------------------------------------------------------
ingest_result = st.session_state.get("ingest_result")
if ingest_result is not None:
    st.markdown("---")
    st.subheader(f"📊 Ingestion Results ({st.session_state.get('last_ingested_type', 'Batch')})")

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Received", f"{ingest_result['received']:,}")
    m2.metric("Accepted", f"{ingest_result['accepted']:,}")
    m3.metric("Duplicates (Ignored)", f"{ingest_result['duplicates']:,}")
    m4.metric("Rejected (Quarantine)", f"{len(ingest_result['rejected']):,}")

    if ingest_result["accepted"] > 0:
        st.success(f"✅ Successfully accepted {ingest_result['accepted']:,} records into database.")
    if ingest_result["duplicates"] > 0:
        st.info(f"ℹ️ {ingest_result['duplicates']:,} records were recognized as duplicates and ignored.")

    # Show rejected quarantine details
    rejected_list = ingest_result["rejected"]
    if rejected_list:
        with st.expander(f"⚠️ View Rejected Records ({len(rejected_list)} rows in Quarantine)", expanded=True):
            st.warning("These rows failed schema boundary validation and were rejected without crashing the batch:")
            rej_df = pd.DataFrame(rejected_list)
            st.dataframe(rej_df, use_container_width=True)

# ------------------------------------------------------------------
# Database Maintenance Expander
# ------------------------------------------------------------------
st.markdown("---")
with st.expander("🛠️ Database Maintenance (Reset / Clear)"):
    st.caption("Clear all records from SQLite to re-run the demonstration from scratch.")
    if st.button("🗑️ Reset All Database Tables", type="secondary", key="btn_reset_all_db"):
        conn = get_conn()
        try:
            for t in ["alerts", "transactions", "cases", "case_alerts", "decisions", "evidence", "reports", "audit_log", "raw_events"]:
                conn.execute(f"DELETE FROM {t}")
            conn.commit()
        finally:
            conn.close()
        st.session_state.clear()
        st.success("All tables have been cleared. Database is empty.")
        st.rerun()
