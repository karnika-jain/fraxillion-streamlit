"""Fraxillion - Segment 7: Regulatory Reporting.

Generates and validates compliance reports from canonical investigation case records:
- PFR-style: Pipe-delimited Preliminary Fraud Report (RBI DAKSH standard)
- STR-style: XML Suspicious Transaction Report (FIU-IND FINGate standard)

Only cases with approved investigation decisions (DECIDED or FILED) are eligible for filing.
"""

from datetime import datetime
import pandas as pd
import streamlit as st

from core.db import ensure_db, get_conn
from core.report import (
    build_case_object,
    render_pfr,
    render_str,
    save_report,
    validate_pfr,
    validate_str,
)
from core.workflow import mark_filed

# Page configuration
st.set_page_config(
    page_title="7 · Regulatory Reports — Fraxillion",
    page_icon="📋",
    layout="wide",
)

# Guarantee database schema is initialized
ensure_db()

# Academic disclaimer banner
st.warning(
    "⚠️ **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Report formats are simplified and must not be submitted.**"
)

st.title("📋 Segment 7: Regulatory Reporting")
st.caption("RBI DAKSH (CPFIR/PFR) pipe format · FIU-IND FINGate (STR) XML · Pre-export boundary validation")

st.markdown("---")

conn = get_conn()

# Fetch all available cases
cases_cur = conn.execute(
    """
    SELECT case_id, title, status, severity, amount, created_at
    FROM cases
    ORDER BY created_at DESC
    """
)
cases = [dict(r) for r in cases_cur.fetchall()]

if not cases:
    st.info("ℹ️ No cases exist in the system yet. Please correlate alerts in **2_Correlate** and accept a candidate case first.")
    conn.close()
    st.stop()

# Case selector
case_options = [c["case_id"] for c in cases]
selected_case_id = st.selectbox(
    "Select Case for Regulatory Filing:",
    options=case_options,
    index=0,
    help="Only cases that have completed maker-checker investigation (status DECIDED or FILED) can generate filings.",
)

case_record = next((c for c in cases if c["case_id"] == selected_case_id), None)
case_status = case_record["status"] if case_record else "UNKNOWN"

col_meta1, col_meta2, col_meta3, col_meta4 = st.columns(4)
with col_meta1:
    st.metric("Case ID", selected_case_id)
with col_meta2:
    st.metric("Current Status", case_status)
with col_meta3:
    st.metric("Severity", case_record.get("severity", "UNKNOWN"))
with col_meta4:
    st.metric("Amount at Risk", f"₹{float(case_record.get('amount') or 0.0):,.2f}")

st.markdown("---")

# ------------------------------------------------------------------
# Check Eligibility: Only DECIDED or FILED cases can generate reports
# ------------------------------------------------------------------
if case_status not in ("DECIDED", "FILED"):
    st.error(
        f"⛔ **Regulatory Reporting Blocked**: Case `{selected_case_id}` is currently in **`{case_status}`** status.\n\n"
        "According to compliance workflow governance:\n"
        "- A formal decision (e.g. STR or CPFIR) must first be proposed by an investigator in **5_Cases**.\n"
        "- The decision must be approved by an independent reviewer under the Maker-Checker (Four-Eyes) rule.\n"
        "- The case must reach status **`DECIDED`** before regulatory export documents can be generated."
    )

    st.info(
        "💡 **How to proceed for demo:**\n"
        "1. Open **5_Cases**.\n"
        "2. Scroll down to **'Investigation Decision & Maker-Checker'**.\n"
        "3. Submit a decision (e.g. maker = `analyst1`), then have a different reviewer approve it (e.g. checker = `compliance_lead`).\n"
        "4. Return to this page to preview, validate, and download your filings."
    )
    conn.close()
    st.stop()

# ------------------------------------------------------------------
# Build Canonical Case Object and Render Filings
# ------------------------------------------------------------------
try:
    case_obj = build_case_object(conn, selected_case_id)
except Exception as e:
    st.error(f"Failed to compile canonical case object: {e}")
    conn.close()
    st.stop()

# Render both reports
pfr_text = render_pfr(case_obj)
pfr_errors = validate_pfr(pfr_text)

str_xml = render_str(case_obj)
str_errors = validate_str(str_xml)

# ------------------------------------------------------------------
# Filing Preview & Validation Tabs
# ------------------------------------------------------------------
tab_pfr, tab_str, tab_history = st.tabs(["🏛️ RBI DAKSH (PFR-style)", "🛡️ FIU-IND FINGate (STR-style)", "📜 Filing History"])

# Tab 1: PFR Reporting
with tab_pfr:
    st.subheader("Preliminary Fraud Report (PFR / CPFIR Standard)")
    st.caption("RBI DAKSH pipe-delimited format with 48 standardized fields per transaction row.")

    if pfr_errors:
        st.error(f"❌ **Validation Failed ({len(pfr_errors)} error(s) found):**")
        for err in pfr_errors:
            st.markdown(f"- 🔴 {err}")
    else:
        st.success("✅ **Pre-Export Validation Passed**: Document satisfies RBI DAKSH syntax, header counts, and field bounds.")

    col_btn_pfr, col_save_pfr = st.columns([1, 1])
    with col_btn_pfr:
        st.download_button(
            label="💾 Download PFR (.txt)",
            data=pfr_text,
            file_name=f"{selected_case_id}_PFR.txt",
            mime="text/plain",
            disabled=bool(pfr_errors),
            type="primary" if not pfr_errors else "secondary",
            help="Download button is disabled whenever validation errors are detected.",
            use_container_width=True,
        )
    with col_save_pfr:
        if st.button("📦 Save to exports/ & Register Fingerprint", key="btn_save_pfr", disabled=bool(pfr_errors), use_container_width=True):
            saved = save_report(conn, selected_case_id, "PFR", pfr_text, actor="COMPLIANCE_OFFICER")
            st.success(f"Report saved: `{saved['filename']}`\n\nSHA-256: `{saved['sha256']}`")
            st.rerun()

    st.markdown("#### Preview:")
    st.code(pfr_text, language="text")

# Tab 2: STR Reporting
with tab_str:
    st.subheader("Suspicious Transaction Report (STR Standard)")
    st.caption("FIU-IND FINGate XML format with grounds of suspicion narrative and suspicion indicators.")

    if str_errors:
        st.error(f"❌ **Validation Failed ({len(str_errors)} error(s) found):**")
        for err in str_errors:
            st.markdown(f"- 🔴 {err}")
    else:
        st.success("✅ **Pre-Export Validation Passed**: XML structure, source of alert, and grounds narrative ($\ge 100$ characters) verified.")

    col_btn_str, col_save_str = st.columns([1, 1])
    with col_btn_str:
        st.download_button(
            label="💾 Download STR (.xml)",
            data=str_xml,
            file_name=f"{selected_case_id}_STR.xml",
            mime="application/xml",
            disabled=bool(str_errors),
            type="primary" if not str_errors else "secondary",
            help="Download button is disabled whenever validation errors are detected.",
            use_container_width=True,
        )
    with col_save_str:
        if st.button("📦 Save to exports/ & Register Fingerprint", key="btn_save_str", disabled=bool(str_errors), use_container_width=True):
            saved = save_report(conn, selected_case_id, "STR", str_xml, actor="COMPLIANCE_OFFICER")
            st.success(f"Report saved: `{saved['filename']}`\n\nSHA-256: `{saved['sha256']}`")
            st.rerun()

    st.markdown("#### Preview:")
    st.code(str_xml, language="xml")

# Tab 3: Filing History
with tab_history:
    st.subheader(f"Generated Reports for {selected_case_id}")
    history_cur = conn.execute(
        """
        SELECT id, regime, path, sha256, created_at
        FROM reports
        WHERE case_id=?
        ORDER BY id DESC
        """,
        (selected_case_id,),
    )
    history_rows = [dict(r) for r in history_cur.fetchall()]

    if not history_rows:
        st.info("No reports saved to `exports/` yet for this case.")
    else:
        df_hist = pd.DataFrame(history_rows)
        st.dataframe(df_hist, use_container_width=True)

# ------------------------------------------------------------------
# Mark as Filed Workflow Action
# ------------------------------------------------------------------
st.markdown("---")
st.subheader("Compliance Filing Sign-Off")

if case_status == "FILED":
    st.success(f"🎉 Case **{selected_case_id}** is marked as **FILED**. Regulatory obligations are complete.")
else:
    st.caption("Once both reports have been downloaded and submitted to regulatory authorities, mark the case as FILED.")
    actor_input = st.text_input("Compliance Officer / Sign-Off Actor:", value="compliance_officer")
    if st.button("🏁 Mark as Filed (Demo)", type="primary"):
        try:
            mark_filed(conn, selected_case_id, actor=actor_input.strip() or "compliance_officer")
            st.success(f"Case {selected_case_id} successfully marked as FILED!")
            st.rerun()
        except Exception as e:
            st.error(f"Failed to transition case: {e}")

conn.close()
