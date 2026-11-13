"""Segment 4: Graph Money Trail Streamlit Page.

Builds directed account-to-account transaction graphs via NetworkX, runs the
three deterministic typology detectors (fan-out, fan-in, pass-through), and
embeds an interactive 2-hop PyVis network canvas.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.graph import (
    DEFAULT_DB_PATH,
    build_graph,
    extract_ego_subgraph,
    render_pyvis_html,
    resolve_case_focus_account,
    run_detectors_on_graph,
)

# Safe call to teammate's ensure_db() if available
try:
    from core.db import ensure_db

    ensure_db()
except Exception:
    pass

st.set_page_config(page_title="4 · Graph Money Trail", layout="wide")

st.title("4 · Graph Money Trail")
st.warning(
    "Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Interactive 2-hop directed money trail with deterministic fan-out, fan-in, and pass-through detectors."
)

if not DEFAULT_DB_PATH.exists():
    st.info(
        "Demo database `fraxillion.db` not found yet. Once your teammate's ingestion & correlation "
        "steps load transactions and cases, the money-trail graph will render here."
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
    if "transactions" not in tables:
        st.info("Transactions table not initialized yet. Run Ingestion first.")
        st.stop()

    txns_df = pd.read_sql_query("SELECT * FROM transactions", conn)
    if txns_df.empty:
        st.info("No transactions in database yet. Upload `synthetic_transactions.csv` on Page 1 (Ingest).")
        st.stop()

    cases_df = (
        pd.read_sql_query(
            "SELECT case_id, status, severity, amount FROM cases ORDER BY created_at DESC",
            conn,
        )
        if "cases" in tables
        else pd.DataFrame()
    )

    # Sidebar / Top controls
    c1, c2, c3, c4 = st.columns([2, 2, 1, 1])

    focus_account: str | None = None
    selected_label = "account"

    if not cases_df.empty:
        with c1:
            mode = st.radio(
                "Focus mode",
                options=["By Case", "By Account"],
                horizontal=True,
            )
    else:
        mode = "By Account"

    all_accounts = sorted(
        set(txns_df["from_account"].dropna().astype(str))
        | set(txns_df["to_account"].dropna().astype(str))
    )

    if mode == "By Case" and not cases_df.empty:
        with c2:
            case_labels = {
                row["case_id"]: f"{row['case_id']} · {row['severity']} (INR {row['amount'] or 0:,.0f})"
                for _, row in cases_df.iterrows()
            }
            selected_case = st.selectbox(
                "Select Case",
                options=list(case_labels.keys()),
                format_func=lambda cid: case_labels[cid],
            )
            focus_account = resolve_case_focus_account(conn, selected_case)
            selected_label = selected_case
            if not focus_account:
                st.warning("Could not resolve a primary account for this case; defaulting to first account.")
                focus_account = all_accounts[0]
    else:
        with c2:
            focus_account = st.selectbox("Select Focus Account", options=all_accounts)
            selected_label = focus_account

    with c3:
        hops = st.slider("Ego Hops", min_value=1, max_value=2, value=2)
    with c4:
        max_nodes = st.slider("Max Nodes", min_value=30, max_value=200, value=120, step=10)

    # Build graph and extract ego subgraph
    G = build_graph(txns_df)
    sub = extract_ego_subgraph(G, focus_account=focus_account, hops=hops, max_nodes=max_nodes)

    st.caption(
        f"Focus Account: **{focus_account}** (Red) | "
        f"Subgraph Size: **{sub.number_of_nodes()} nodes**, **{sub.number_of_edges()} transfers**"
    )

    # Interactive PyVis canvas
    graph_html = render_pyvis_html(
        G,
        focus_account=focus_account,
        hops=hops,
        max_nodes=max_nodes,
        height="520px",
    )
    components.html(graph_html, height=540, scrolling=False)

    # Export snapshot button for Page 6 (Evidence)
    export_col, _ = st.columns([1, 3])
    with export_col:
        if st.button("Save Graph Snapshot for Evidence"):
            exports_dir = PROJECT_ROOT / "exports"
            exports_dir.mkdir(parents=True, exist_ok=True)
            out_file = exports_dir / f"graph_{selected_label}.html"
            out_file.write_text(graph_html, encoding="utf-8")
            st.success(f"Saved snapshot to `exports/{out_file.name}`")

    st.divider()

    # Deterministic Typology Detectors on the visible subgraph
    st.subheader("Deterministic Money-Trail Detectors")
    det_results = run_detectors_on_graph(sub, nodes=list(sub.nodes()))

    m1, m2, m3 = st.columns(3)
    m1.metric("Fan-Out Hits (>=5 targets / 60m)", len(det_results["fan_out"]))
    m2.metric("Fan-In Hits (>=10 sources / 24h)", len(det_results["fan_in"]))
    m3.metric("Pass-Through Hits (>=80% in 24h)", len(det_results["pass_through"]))

    tab_fo, tab_fi, tab_pt, tab_tx = st.tabs(
        ["Fan-Out Details", "Fan-In Details", "Pass-Through Details", "Subgraph Transactions"]
    )

    with tab_fo:
        if det_results["fan_out"]:
            st.dataframe(pd.DataFrame(det_results["fan_out"]), use_container_width=True, hide_index=True)
        else:
            st.info("No fan-out bursts detected in this subgraph.")

    with tab_fi:
        if det_results["fan_in"]:
            st.dataframe(pd.DataFrame(det_results["fan_in"]), use_container_width=True, hide_index=True)
        else:
            st.info("No fan-in collection patterns detected in this subgraph.")

    with tab_pt:
        if det_results["pass_through"]:
            st.dataframe(pd.DataFrame(det_results["pass_through"]), use_container_width=True, hide_index=True)
        else:
            st.info("No pass-through laundering patterns detected in this subgraph.")

    with tab_tx:
        sub_nodes = set(sub.nodes())
        sub_txns = txns_df[
            txns_df["from_account"].isin(sub_nodes) & txns_df["to_account"].isin(sub_nodes)
        ].sort_values("ts", ascending=False)
        st.dataframe(sub_txns, use_container_width=True, hide_index=True)
finally:
    conn.close()
