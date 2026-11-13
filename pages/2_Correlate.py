"""Fraxillion - Segment 2: Alert Correlation.

Groups related alerts into candidate investigation cases using graph-based linkage.
Excludes high-degree hub attributes to prevent false runaway clustering,
and allows investigators to review candidate cases and accept them into formal cases.
"""

import pandas as pd
import streamlit as st

from core.correlate import correlate, create_case
from core.db import ensure_db, get_conn

# Page configuration
st.set_page_config(
    page_title="2 · Correlate Alerts — Fraxillion",
    page_icon="🔗",
    layout="wide",
)

# Guarantee database schema is initialized
ensure_db()

# Academic disclaimer banner
st.warning(
    "⚠️ **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Report formats are simplified and must not be submitted.**"
)

st.title("🔗 Segment 2: Alert Correlation")
st.caption("Shared-key clustering (Account, Device, VPA) · Hub exclusion cap · Case candidate promotion")

st.markdown("---")

# ------------------------------------------------------------------
# Correlation Configuration Controls
# ------------------------------------------------------------------
st.subheader("Correlation Parameters")
col_cfg1, col_cfg2, col_btn = st.columns([2, 2, 1.5])

with col_cfg1:
    hub_threshold = st.slider(
        "Hub Threshold (Max alerts per key)",
        min_value=5,
        max_value=50,
        value=20,
        help="Attributes shared by more alerts than this threshold are treated as hubs (merchants/aggregators) and excluded from linking.",
    )

with col_cfg2:
    max_case_size = st.slider(
        "Max Case Size (Max alerts per case)",
        min_value=5,
        max_value=50,
        value=30,
        help="Candidate clusters exceeding this alert count are flagged as oversized and skipped.",
    )

with col_btn:
    st.write("")
    st.write("")
    run_btn = st.button("⚡ Run Correlation", type="primary", use_container_width=True)

# ------------------------------------------------------------------
# Run Correlation Logic
# ------------------------------------------------------------------
if run_btn:
    conn = get_conn()
    try:
        with st.spinner("Analyzing alert graph and extracting connected components..."):
            results = correlate(conn, hub_threshold=hub_threshold, max_case_size=max_case_size)
            st.session_state["correlation_results"] = results
            st.session_state["accepted_cases"] = st.session_state.get("accepted_cases", {})
    finally:
        conn.close()

results = st.session_state.get("correlation_results")

# If correlation has not run yet, show summary of current alerts in database
if results is None:
    conn = get_conn()
    alert_count = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    conn.close()
    if alert_count == 0:
        st.info("ℹ️ No alerts in the database yet. Please visit **1_Ingest** to load alerts and transactions first.")
    else:
        st.info(f"Ready to correlate **{alert_count:,} alerts** currently in the database. Click **'⚡ Run Correlation'** above.")
    st.stop()

candidates = results.get("candidates", [])
dropped_hubs = results.get("dropped_hubs", [])
skipped_oversized = results.get("skipped_oversized", [])

# ------------------------------------------------------------------
# Warnings for Dropped Hubs and Oversized Clusters
# ------------------------------------------------------------------
if dropped_hubs:
    with st.expander("🛡️ Excluded Hub Attributes (Hub-Cap Triggered)", expanded=True):
        st.warning(
            f"**{len(dropped_hubs)} attribute(s) exceeded the hub threshold ({hub_threshold} alerts)** "
            "and were excluded from generating links. This prevents popular merchants and payment aggregators "
            "from merging unrelated alerts into false super-clusters:"
        )
        hub_df = pd.DataFrame(dropped_hubs)
        st.dataframe(hub_df, use_container_width=True)

if skipped_oversized:
    with st.expander("⚠️ Skipped Oversized Clusters", expanded=False):
        st.warning(
            f"**{len(skipped_oversized)} cluster(s) exceeded the maximum case size of {max_case_size} alerts**:"
        )
        st.write(skipped_oversized)

# ------------------------------------------------------------------
# Candidate Cases Summary Table
# ------------------------------------------------------------------
st.markdown("---")
st.subheader(f"Candidate Cases Found: {len(candidates)}")

if not candidates:
    st.info("No multi-alert clusters found with current parameters. Try adjusting the thresholds or check ingested alerts.")
    st.stop()

# Build summary DataFrame
summary_rows = []
for c in candidates:
    summary_rows.append({
        "Candidate ID": c["id"],
        "Alerts Count": c["alert_count"],
        "Severity": c["highest_severity"],
        "Total Amount (INR)": f"₹{c['total_amount']:,.2f}",
        "Distinct Beneficiaries": c["distinct_beneficiaries"],
        "Shared Linking Keys": ", ".join(c["shared_keys"]),
    })

st.dataframe(pd.DataFrame(summary_rows), use_container_width=True)

# ------------------------------------------------------------------
# Detailed Candidate Review and Acceptance
# ------------------------------------------------------------------
st.markdown("---")
st.subheader("Review & Accept Candidate Cases")

accepted_cases = st.session_state.get("accepted_cases", {})

# Check which alerts are already in existing cases from SQLite
conn = get_conn()
existing_assigned = {
    row["alert_id"]: row["case_id"]
    for row in conn.execute("SELECT alert_id, case_id FROM case_alerts").fetchall()
}
conn.close()

for c in candidates:
    cid = c["id"]
    is_already_accepted = any(aid in existing_assigned for aid in c["alerts"])
    assigned_case_id = next((existing_assigned[aid] for aid in c["alerts"] if aid in existing_assigned), None)

    title_label = (
        f"**{cid}** · {c['alert_count']} Alerts · Total: ₹{c['total_amount']:,.2f} "
        f"· Keys: {', '.join(c['shared_keys'])}"
    )
    if is_already_accepted:
        title_label += f" — ✅ ACCEPTED ({assigned_case_id})"

    with st.expander(title_label, expanded=(cid == "CAND-1")):
        col_info1, col_info2 = st.columns([3, 1])

        with col_info1:
            st.markdown(f"**Shared Linking Keys:** `{', '.join(c['shared_keys'])}`")
            st.markdown(f"**Linked Alerts:** `{', '.join(c['alerts'])}`")
            st.markdown(f"**Total Amount at Risk:** ₹{c['total_amount']:,.2f}")
            st.markdown(f"**Distinct Beneficiaries Involved:** {c['distinct_beneficiaries']}")

        with col_info2:
            if is_already_accepted:
                st.success(f"Case `{assigned_case_id}` created.")
            else:
                if st.button(f"📥 Accept as Formal Case", key=f"btn_accept_{cid}", type="primary"):
                    conn = get_conn()
                    try:
                        new_case_id = create_case(conn, c, actor="ANALYST")
                        st.session_state["accepted_cases"][cid] = new_case_id
                        st.success(f"🎉 Case **{new_case_id}** created successfully!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed to create case: {e}")
                    finally:
                        conn.close()

        # Show detailed alerts for this candidate
        conn = get_conn()
        placeholders = ",".join("?" for _ in c["alerts"])
        alert_details = conn.execute(
            f"""
            SELECT alert_id, txn_id, account_id, device_id, to_vpa, rule, severity, score, ts
            FROM alerts
            WHERE alert_id IN ({placeholders})
            ORDER BY ts
            """,
            c["alerts"],
        ).fetchall()
        conn.close()

        if alert_details:
            st.caption("Alerts in this candidate cluster:")
            st.dataframe(pd.DataFrame([dict(r) for r in alert_details]), use_container_width=True)
