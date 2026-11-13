"""Segment 3: ML Risk Assessment Streamlit Page.

Displays offline 50k model benchmarks (Logistic Regression vs Random Forest),
threshold tradeoff analysis, feature importances, and honest out-of-sample
risk scoring on the unseen 5k demo cases in SQLite.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.score import (
    DEFAULT_DB_PATH,
    load_eval_metrics,
    score_case,
    score_transactions,
)

# Safe call to teammate's ensure_db() if available
try:
    from core.db import ensure_db

    ensure_db()
except Exception:
    pass

st.set_page_config(page_title="3 · ML Risk Score", layout="wide")

st.title("3 · ML Risk Assessment")
st.warning(
    "Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Models trained offline on 50,000 synthetic transactions (2% fraud, 70/30 stratified split) "
    "so risk scores on the 5,000-row demo data are genuine out-of-sample predictions."
)

# --- 1. Offline Holdout Evaluation (15,000-row unseen test set) ---
try:
    metrics_data = load_eval_metrics()
except FileNotFoundError as exc:
    st.error(str(exc))
    st.stop()

ds_info = metrics_data["dataset"]
st.caption(
    f"Training corpus: **{ds_info['total_rows']:,}** transactions "
    f"({ds_info['fraud_rows_total']:,} fraud · {ds_info['fraud_rate_pct']}%) | "
    f"Split: **{ds_info['split']}** "
    f"(Train: {ds_info['train_rows']:,} / Test: {ds_info['test_rows']:,})"
)

st.subheader("Model Comparison (30% Holdout Test Set)")
model_rows = []
for m_name, m in metrics_data["models"].items():
    model_rows.append(
        {
            "Model": m_name,
            "Accuracy": m["accuracy"],
            "Precision": m["precision"],
            "Recall": m["recall"],
            "F1 Score": m["f1"],
            "ROC-AUC": m["roc_auc"],
            "PR-AUC": m["pr_auc"],
        }
    )
st.dataframe(pd.DataFrame(model_rows), use_container_width=True, hide_index=True)

col_left, col_right = st.columns(2)

with col_left:
    selected_model = st.selectbox(
        "Inspect model details",
        options=list(metrics_data["models"].keys()),
        index=1 if "RandomForest" in metrics_data["models"] else 0,
    )
    m_detail = metrics_data["models"][selected_model]

    # Interactive threshold slider
    curve_df = pd.DataFrame(m_detail["threshold_curve"])
    thr = st.slider(
        "Decision threshold",
        min_value=0.1,
        max_value=0.9,
        value=0.5,
        step=0.1,
        help="Slide to inspect the Precision / Recall tradeoff on the 30% holdout set.",
    )
    row_thr = curve_df.loc[(curve_df["threshold"] - thr).abs().idxmin()]
    t1, t2, t3, t4 = st.columns(4)
    t1.metric("Precision", f"{row_thr['precision']:.3f}")
    t2.metric("Recall", f"{row_thr['recall']:.3f}")
    t3.metric("F1 Score", f"{row_thr['f1']:.3f}")
    t4.metric("Flagged Txns", f"{int(row_thr['flagged_count']):,}")

    # Confusion matrix at default 0.5 cutoff
    cm = m_detail["confusion_matrix"]
    fig_cm = go.Figure(
        data=go.Heatmap(
            z=cm,
            x=["Pred Normal (0)", "Pred Fraud (1)"],
            y=["Actual Normal (0)", "Actual Fraud (1)"],
            text=cm,
            texttemplate="%{text:,}",
            colorscale="Blues",
            showscale=False,
        )
    )
    fig_cm.update_layout(
        title=f"{selected_model} Confusion Matrix (Threshold 0.50)",
        height=320,
        margin=dict(l=20, r=20, t=45, b=20),
    )
    st.plotly_chart(fig_cm, use_container_width=True)

with col_right:
    st.markdown("**Global Feature Importance (Random Forest)**")
    imp_items = list(metrics_data["feature_importances"].items())
    imp_df = pd.DataFrame(imp_items, columns=["Feature", "Importance"]).sort_values(
        "Importance", ascending=True
    )
    fig_imp = px.bar(
        imp_df,
        x="Importance",
        y="Feature",
        orientation="h",
        height=430,
        color="Importance",
        color_continuous_scale="Teal",
    )
    fig_imp.update_layout(
        coloraxis_showscale=False,
        margin=dict(l=10, r=20, t=20, b=20),
    )
    st.plotly_chart(fig_imp, use_container_width=True)

st.divider()

# --- 2. Live Case Scoring on the Unseen Demo Database ---
st.subheader("Live Case Risk Scoring (Unseen Demo Data)")

if not DEFAULT_DB_PATH.exists():
    st.info(
        "Demo database `fraxillion.db` not found yet. Once your teammate's ingestion & correlation "
        "steps populate cases, select a case here to view live out-of-sample risk scores."
    )
    st.stop()

conn = sqlite3.connect(str(DEFAULT_DB_PATH), check_same_thread=False)
conn.row_factory = sqlite3.Row
try:
    tables = {
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    if not {"cases", "case_alerts", "alerts", "transactions"}.issubset(tables):
        st.info("Database tables are not initialized yet. Run Ingestion and Correlation first.")
        st.stop()

    cases_df = pd.read_sql_query(
        "SELECT case_id, title, status, severity, amount FROM cases ORDER BY created_at DESC",
        conn,
    )
    if cases_df.empty:
        st.info("No accepted cases in database yet. Accept a candidate case on Page 2 (Correlate).")
        st.stop()

    case_labels = {
        row["case_id"]: f"{row['case_id']} · {row['status']} · {row['severity']} (INR {row['amount'] or 0:,.0f})"
        for _, row in cases_df.iterrows()
    }
    selected_case = st.selectbox(
        "Select a case to score",
        options=list(case_labels.keys()),
        format_func=lambda cid: case_labels[cid],
    )

    result = score_case(selected_case, model_name=selected_model, conn=conn)
    c_score, c_model, c_reasons = st.columns([1, 1, 2])
    c_score.metric("Case Risk Score", f"{result['score']:.2f}")
    c_model.metric("Scoring Model", result["model"])
    with c_reasons:
        st.markdown("**Top Risk Drivers**")
        for reason in result["reasons"]:
            st.markdown(f"- {reason}")

    # Show individual transactions linked to this case
    alert_txns = conn.execute(
        """
        SELECT DISTINCT a.txn_id, a.account_id
        FROM case_alerts ca
        JOIN alerts a ON ca.alert_id = a.alert_id
        WHERE ca.case_id = ?
        """,
        (selected_case,),
    ).fetchall()
    case_txn_ids = {r["txn_id"] for r in alert_txns if r["txn_id"]}
    all_txns_df = pd.read_sql_query("SELECT * FROM transactions", conn)

    if not all_txns_df.empty and case_txn_ids:
        scored_all = score_transactions(all_txns_df, model_name=selected_model)
        case_txns_view = scored_all[scored_all["txn_id"].isin(case_txn_ids)].sort_values(
            "risk_score", ascending=False
        )
        display_cols = [
            "txn_id",
            "ts",
            "from_account",
            "to_account",
            "amount",
            "risk_score",
            "is_night",
            "distinct_beneficiaries_24h",
            "device_shared_count",
            "in_out_ratio_24h",
        ]
        present_cols = [c for c in display_cols if c in case_txns_view.columns]
        st.markdown("**Case Transactions & Per-Transaction Probabilities**")
        st.dataframe(case_txns_view[present_cols], use_container_width=True, hide_index=True)
finally:
    conn.close()
