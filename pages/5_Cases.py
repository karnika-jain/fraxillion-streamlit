"""Fraxillion - Segment 6: Investigation & Case Workspace.

Case 360 investigation workspace providing case summaries, state machine management,
linked alerts & transactions, read-only evidence overview, and maker-checker decision governance.
"""

from pathlib import Path
import pandas as pd
import streamlit as st

from core.db import ensure_db, get_conn
from core.workflow import (
    ALLOWED,
    approve,
    create_decision,
    get_audit_log,
    mark_filed,
    reject,
    transition,
)

# Page configuration
st.set_page_config(
    page_title="5 · Case Workspace — Fraxillion",
    page_icon="💼",
    layout="wide",
)

# Ensure database tables exist
ensure_db()

# Academic disclaimer banner
st.warning(
    "⚠️ **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Report formats are simplified and must not be submitted.**"
)

st.title("💼 Segment 6: Investigation & Case Workspace")
st.caption("Case 360 · Finite State Machine · Four-Eyes Maker-Checker Governance · Audit Trail")

st.markdown("---")

# ------------------------------------------------------------------
# Sidebar: Current User Setting (No Real Auth)
# ------------------------------------------------------------------
st.sidebar.header("👤 Investigator Session")
acting_user = st.sidebar.text_input(
    "Acting User (Maker)",
    value="student",
    help="Username recorded as the maker for decisions and actor for case transitions.",
).strip() or "student"

st.sidebar.info(
    "💡 In a bank deployment, this identity is enforced by SSO/IAM (RBAC/ABAC). "
    "For this prototype, entering different names enables testing Maker-Checker governance."
)

# ------------------------------------------------------------------
# Case List & Selector
# ------------------------------------------------------------------
conn = get_conn()
cases_query = """
SELECT 
    c.case_id, 
    c.title, 
    c.status, 
    c.severity, 
    c.amount, 
    c.shared_keys,
    c.created_at,
    COUNT(ca.alert_id) AS alert_count
FROM cases c
LEFT JOIN case_alerts ca ON c.case_id = ca.case_id
GROUP BY c.case_id
ORDER BY c.case_id ASC
"""
case_rows = conn.execute(cases_query).fetchall()
conn.close()

if not case_rows:
    st.info("ℹ️ No cases created yet. Please visit **2_Correlate** to run correlation and accept candidate clusters into cases.")
    st.stop()

# Case Summary Table
st.subheader(f"Active Cases ({len(case_rows)})")
summary_df = pd.DataFrame([
    {
        "Case ID": r["case_id"],
        "Title": r["title"],
        "Status": r["status"],
        "Severity": r["severity"],
        "Amount (INR)": f"₹{r['amount']:,.2f}",
        "Alerts": r["alert_count"],
        "Shared Keys": r["shared_keys"],
    }
    for r in case_rows
])
st.dataframe(summary_df, use_container_width=True)

# Selectbox to open Case 360
case_options = [r["case_id"] for r in case_rows]
selected_case_id = st.selectbox(
    "Select Case to Open Case 360 Workspace:",
    options=case_options,
    key="case_360_selector",
)

# Fetch details of selected case
selected_case = next(r for r in case_rows if r["case_id"] == selected_case_id)
case_status = selected_case["status"]

st.markdown("---")

# ==================================================================
# SECTION 1: HEADER & STATE MACHINE CONTROLS
# ==================================================================
st.subheader(f"📁 Case 360 Workspace: `{selected_case_id}`")

col_h1, col_h2, col_h3, col_h4 = st.columns(4)
col_h1.metric("Case Status", case_status)
col_h2.metric("Severity", selected_case["severity"])
col_h3.metric("Amount at Risk", f"₹{selected_case['amount']:,.2f}")
col_h4.metric("Linked Alerts", selected_case["alert_count"])

# State machine action buttons
st.markdown("##### Case State Progression")
allowed_next_states = ALLOWED.get(case_status, [])

col_trans1, col_trans2 = st.columns([3, 2])
with col_trans1:
    if not allowed_next_states:
        st.info(f"Case is in final terminal state: **{case_status}**.")
    else:
        st.write(f"Allowed next transitions from **{case_status}**: `{'`, `'.join(allowed_next_states)}`")
        col_btns = st.columns(len(allowed_next_states))
        for idx, next_st in enumerate(allowed_next_states):
            if col_btns[idx].button(f"➡️ Transition to {next_st}", key=f"btn_trans_{next_st}", type="primary"):
                conn = get_conn()
                try:
                    transition(conn, selected_case_id, next_st, actor=acting_user, reason=f"Moved by {acting_user}")
                    st.success(f"Case {selected_case_id} moved to **{next_st}**!")
                    st.rerun()
                except Exception as e:
                    st.error(str(e))
                finally:
                    conn.close()

with col_trans2:
    with st.expander("🧪 Test Illegal State Transition (FSM Validation)"):
        st.caption("Try forcing an illegal move to verify that Fraxillion's state machine blocks invalid transitions:")
        illegal_target = st.selectbox(
            "Attempt Jump To:",
            options=["NEW", "TRIAGE", "INVESTIGATING", "DECIDED", "FILED", "CLOSED"],
            key="illegal_target_select",
        )
        if st.button("Attempt Illegal Move", key="btn_attempt_illegal"):
            conn = get_conn()
            try:
                transition(conn, selected_case_id, illegal_target, actor=acting_user, reason="Simulated illegal bypass attempt")
                st.warning(f"Transition succeeded (was legal): now in {illegal_target}")
                st.rerun()
            except ValueError as ve:
                st.error(f"❌ **State Machine Blocked:** {ve}")
            finally:
                conn.close()

st.markdown("---")

# ==================================================================
# SECTION 2: SUMMARY & LINKED ALERTS
# ==================================================================
st.subheader("📋 Case Summary & Linked Alerts")
st.markdown(f"**Shared Correlation Keys:** `{selected_case['shared_keys']}`")

conn = get_conn()
alerts_query = """
SELECT a.alert_id, a.txn_id, a.account_id, a.device_id, a.to_vpa, a.rule, a.severity, a.score, a.reason, a.ts
FROM alerts a
JOIN case_alerts ca ON a.alert_id = ca.alert_id
WHERE ca.case_id = ?
ORDER BY a.ts ASC
"""
linked_alerts = conn.execute(alerts_query, (selected_case_id,)).fetchall()
conn.close()

if linked_alerts:
    st.dataframe(pd.DataFrame([dict(r) for r in linked_alerts]), use_container_width=True)
else:
    st.info("No alerts mapped to this case.")

st.markdown("---")

# ==================================================================
# SECTION 3: RISK SCORE (TEAMMATE PLACEHOLDER)
# ==================================================================
st.subheader("📊 ML Risk Score")
st.info(
    "🤖 **Coming from teammate's module (`pages/3_Score.py` & `core/score.py`)**:\n\n"
    "Supervised Random Forest risk probability score and feature importance explanations will be displayed here."
)

st.markdown("---")

# ==================================================================
# SECTION 4: MONEY-TRAIL GRAPH (TEAMMATE PLACEHOLDER)
# ==================================================================
st.subheader("🕸️ Graph Money Trail")
st.info(
    "🔍 **Coming from teammate's module (`pages/4_Graph.py` & `core/graph.py`)**:\n\n"
    "Interactive 2-hop PyVis ego network, fan-out/fan-in detectors, and pass-through money flow visualization will be displayed here."
)

st.markdown("---")

# ==================================================================
# SECTION 5: TRANSACTIONS TABLE
# ==================================================================
st.subheader("💳 Linked Transactions")
conn = get_conn()
txns_query = """
SELECT DISTINCT t.txn_id, t.ts, t.from_account, t.to_account, t.to_vpa, t.amount, t.channel, t.device_id, t.city, t.is_fraud
FROM transactions t
JOIN alerts a ON t.txn_id = a.txn_id
JOIN case_alerts ca ON a.alert_id = ca.alert_id
WHERE ca.case_id = ?
ORDER BY t.ts ASC
"""
linked_txns = conn.execute(txns_query, (selected_case_id,)).fetchall()
conn.close()

if linked_txns:
    st.dataframe(pd.DataFrame([dict(r) for r in linked_txns]), use_container_width=True)
else:
    st.info("No transactions found for the linked alerts.")

st.markdown("---")

# ==================================================================
# SECTION 6: EVIDENCE LIST (READ-ONLY)
# ==================================================================
st.subheader("🔒 Attached Evidence Artifacts")
st.caption("Read-only summary of cryptographically sealed evidence. To upload new files, visit the **6_Evidence** page.")

conn = get_conn()
evidence_items = conn.execute(
    "SELECT id, path, kind, file_hash, prev_hash, created_at FROM evidence WHERE case_id=? ORDER BY id ASC",
    (selected_case_id,),
).fetchall()
conn.close()

if evidence_items:
    ev_table = []
    ev_ref_options = []
    for r in evidence_items:
        filename = Path(r["path"]).name
        ev_ref_options.append(f"EV-#{r['id']} ({filename})")
        ev_table.append({
            "Evidence ID": f"#{r['id']}",
            "File Name": filename,
            "Category": r["kind"],
            "SHA-256 Hash": f"{r['file_hash'][:16]}...",
            "Previous Hash": f"{r['prev_hash'][:16]}...",
            "Attached At": r["created_at"][:19],
        })
    st.dataframe(pd.DataFrame(ev_table), use_container_width=True)
else:
    ev_ref_options = []
    st.info("No evidence files attached to this case yet. You can upload artifacts in the **6_Evidence** page.")

st.markdown("---")

# ==================================================================
# SECTION 7: DECISION FORM (MAKER)
# ==================================================================
st.subheader("⚖️ Record Investigation Decision (Maker)")

conn = get_conn()
pending_decisions = conn.execute(
    "SELECT * FROM decisions WHERE case_id=? ORDER BY id DESC",
    (selected_case_id,),
).fetchall()
conn.close()

with st.form("decision_form", clear_on_submit=False):
    col_d1, col_d2 = st.columns(2)
    with col_d1:
        decision_type = st.selectbox(
            "Proposed Action / Decision Type",
            options=["FILE_STR", "FILE_CPFIR", "MONITOR", "CLOSE"],
            help="STR = Suspicious Transaction Report (FIU-IND), CPFIR = Central Payment Fraud Info Registry (RBI)",
        )
        grounds = st.multiselect(
            "Grounds of Suspicion",
            options=[
                "RAPID_FAN_OUT",
                "PASS_THROUGH_90PCT",
                "SHARED_DEVICE_MULE_RING",
                "FAN_IN_STRUCTURING",
                "PROFILE_MISMATCH",
                "LAYERED_TRANSFERS",
            ],
            default=["RAPID_FAN_OUT"] if "FAN_OUT" in selected_case["title"] else [],
        )

    with col_d2:
        selected_ev_refs = st.multiselect(
            "Evidence References",
            options=ev_ref_options,
            help="Select evidence artifacts supporting this conclusion.",
        )
        st.write(f"**Proposing Maker:** `{acting_user}`")

    rationale = st.text_area(
        "Investigation Rationale / Findings (Min. 30 characters)",
        placeholder="Explain the money trail, suspicion indicators, beneficiary links, and grounds for filing...",
        help="Must contain detailed reasons for the audit trail.",
    )

    submit_decision = st.form_submit_button("📝 Submit Decision for Review", type="primary")

if submit_decision:
    grounds_str = ", ".join(grounds) if grounds else "SUSPICIOUS_UPI_VELOCITY"
    ev_str = ", ".join(selected_ev_refs) if selected_ev_refs else ""
    conn = get_conn()
    try:
        dec_id = create_decision(
            conn=conn,
            case_id=selected_case_id,
            decision_type=decision_type,
            grounds=grounds_str,
            rationale=rationale,
            maker=acting_user,
            evidence_refs=ev_str,
        )
        st.success(f"Decision #{dec_id} ({decision_type}) proposed successfully by `{acting_user}`! Awaiting checker review.")
        st.rerun()
    except Exception as e:
        st.error(f"Failed to submit decision: {e}")
    finally:
        conn.close()

st.markdown("---")

# ==================================================================
# SECTION 8: APPROVAL BOX (MAKER-CHECKER REVIEW)
# ==================================================================
st.subheader("🔍 Review & Approval (Checker)")

if not pending_decisions:
    st.info("No decisions recorded yet for this case.")
else:
    for dec in pending_decisions:
        dec_id = dec["id"]
        status = dec["status"]
        maker = dec["maker"]
        dec_type = dec["decision_type"]

        st.markdown(f"#### Decision #{dec_id}: `{dec_type}` — Status: **{status}**")
        col_info_a, col_info_b = st.columns([3, 1])
        with col_info_a:
            st.write(f"**Maker:** `{maker}` | **Created:** {dec['created_at'][:19]}")
            st.write(f"**Grounds:** {dec['grounds']}")
            st.write(f"**Rationale:** {dec['rationale']}")
            if dec["checker"]:
                st.write(f"**Checker:** `{dec['checker']}` | **Decided At:** {dec['decided_at'][:19] if dec['decided_at'] else 'N/A'}")

        with col_info_b:
            if status == "PENDING":
                st.warning("⏳ Awaiting Review")
                checker_input = st.text_input(
                    "Reviewer / Checker User",
                    value="compliance_officer" if acting_user == maker else acting_user,
                    key=f"checker_input_{dec_id}",
                    help="Must be different from the maker to satisfy the Four-Eyes principle.",
                ).strip()

                col_btn_appr, col_btn_rej = st.columns(2)
                if col_btn_appr.button("✅ Approve", key=f"btn_appr_{dec_id}", type="primary"):
                    conn = get_conn()
                    try:
                        approve(conn, dec_id, checker=checker_input)
                        st.success(f"Decision #{dec_id} APPROVED by `{checker_input}`!")
                        st.rerun()
                    except ValueError as err:
                        st.error(f"❌ {err}")
                    finally:
                        conn.close()

                if col_btn_rej.button("❌ Reject", key=f"btn_rej_{dec_id}"):
                    conn = get_conn()
                    try:
                        reject(conn, dec_id, checker=checker_input, reason="Insufficient evidence")
                        st.warning(f"Decision #{dec_id} REJECTED by `{checker_input}`.")
                        st.rerun()
                    except Exception as err:
                        st.error(str(err))
                    finally:
                        conn.close()
            elif status == "APPROVED":
                st.success(f"✅ Approved by `{dec['checker']}`")
                if case_status == "DECIDED":
                    if st.button("📁 Mark as FILED (Regulatory Submission)", key=f"btn_mark_filed_{dec_id}"):
                        conn = get_conn()
                        try:
                            mark_filed(conn, selected_case_id, actor=dec["checker"] or acting_user)
                            st.success(f"Case {selected_case_id} status updated to FILED!")
                            st.rerun()
                        finally:
                            conn.close()
            else:
                st.error(f"❌ Rejected by `{dec['checker']}`")

st.markdown("---")

# ==================================================================
# SECTION 9: TIMELINE (AUDIT LOG)
# ==================================================================
st.subheader("📜 Case Audit Trail")
conn = get_conn()
audit_entries = get_audit_log(conn, selected_case_id)
conn.close()

if audit_entries:
    timeline_df = pd.DataFrame([
        {
            "Log ID": entry["id"],
            "Timestamp": entry["created_at"][:19] if entry.get("created_at") else "",
            "Actor": entry["actor"],
            "Action": entry["action"],
            "Details": entry["details"],
        }
        for entry in audit_entries
    ])
    st.dataframe(timeline_df, use_container_width=True)
else:
    st.info("No audit logs recorded for this case.")
