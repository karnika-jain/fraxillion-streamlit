"""Graph Money Trail & Typology Detectors for Fraxillion (Segment 4).

Builds a directed transaction network using NetworkX, runs deterministic
detectors (fan-out, fan-in, pass-through), and renders interactive 2-hop
ego graphs with PyVis.

Handshake contract for teammate integration:
    get_case_graph_html(case_id: str) -> str
        Returns an HTML string embeddable via st.components.v1.html().
"""

from __future__ import annotations

import html as html_lib
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import networkx as nx
import pandas as pd
from pyvis.network import Network

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = PROJECT_ROOT / "fraxillion.db"


def _parse_ts(val: Any) -> datetime:
    """Parse ISO string or datetime/Timestamp into naive Python datetime."""
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    ts = pd.to_datetime(val, errors="coerce")
    if pd.isna(ts):
        return datetime(2026, 11, 1, 0, 0, 0)
    return ts.to_pydatetime().replace(tzinfo=None)


def build_graph(txns: pd.DataFrame | list[dict[str, Any]]) -> nx.MultiDiGraph:
    """Build a directed multi-graph where nodes are accounts and edges are txns."""
    G = nx.MultiDiGraph()
    records = txns.to_dict(orient="records") if isinstance(txns, pd.DataFrame) else txns

    for t in records:
        src = str(t.get("from_account", "")).strip()
        dst = str(t.get("to_account", "")).strip()
        if not src or not dst:
            continue
        G.add_node(src, kind="account")
        G.add_node(dst, kind="account")
        G.add_edge(
            src,
            dst,
            txn_id=str(t.get("txn_id", "")),
            amount=float(t.get("amount", 0.0)),
            ts=_parse_ts(t.get("ts")),
            device_id=str(t.get("device_id") or ""),
            to_vpa=str(t.get("to_vpa") or ""),
        )
    return G


def fan_out(
    G: nx.MultiDiGraph,
    node: str,
    window_minutes: int = 60,
    k: int = 5,
) -> list[dict[str, Any]]:
    """Detect bursts where `node` sends to >= k unique targets within window_minutes."""
    if node not in G:
        return []
    edges = [(v, d) for _, v, d in G.out_edges(node, data=True)]
    edges.sort(key=lambda x: x[1]["ts"])

    hits: list[dict[str, Any]] = []
    window = timedelta(minutes=window_minutes)
    seen_target_sets: set[frozenset[str]] = set()

    for i, (v, d) in enumerate(edges):
        t0 = d["ts"]
        targets = {v}
        total_amt = d["amount"]
        for v2, d2 in edges[i + 1 :]:
            if d2["ts"] - t0 <= window:
                targets.add(v2)
                total_amt += d2["amount"]
            else:
                break
        if len(targets) >= k:
            key = frozenset(targets)
            if key not in seen_target_sets:
                seen_target_sets.add(key)
                hits.append(
                    {
                        "node": node,
                        "targets": sorted(targets),
                        "target_count": len(targets),
                        "total_amount": round(total_amt, 2),
                        "window_start": t0.isoformat(timespec="minutes"),
                    }
                )
    return hits


def fan_in(
    G: nx.MultiDiGraph,
    node: str,
    window_hours: int = 24,
    k: int = 10,
) -> list[dict[str, Any]]:
    """Detect collection bursts where `node` receives from >= k unique sources."""
    if node not in G:
        return []
    edges = [(u, d) for u, _, d in G.in_edges(node, data=True)]
    edges.sort(key=lambda x: x[1]["ts"])

    hits: list[dict[str, Any]] = []
    window = timedelta(hours=window_hours)
    seen_source_sets: set[frozenset[str]] = set()

    for i, (u, d) in enumerate(edges):
        t0 = d["ts"]
        sources = {u}
        total_amt = d["amount"]
        for u2, d2 in edges[i + 1 :]:
            if d2["ts"] - t0 <= window:
                sources.add(u2)
                total_amt += d2["amount"]
            else:
                break
        if len(sources) >= k:
            key = frozenset(sources)
            if key not in seen_source_sets:
                seen_source_sets.add(key)
                hits.append(
                    {
                        "node": node,
                        "sources": sorted(sources),
                        "source_count": len(sources),
                        "total_amount": round(total_amt, 2),
                        "window_start": t0.isoformat(timespec="minutes"),
                    }
                )
    return hits


def pass_through(
    G: nx.MultiDiGraph,
    node: str,
    hours: int = 24,
    ratio: float = 0.80,
) -> dict[str, Any] | None:
    """Check if a node moves >= ratio of incoming funds back out within `hours`."""
    if node not in G:
        return None

    in_edges = sorted([d for _, _, d in G.in_edges(node, data=True)], key=lambda d: d["ts"])
    out_edges = sorted([d for _, _, d in G.out_edges(node, data=True)], key=lambda d: d["ts"])

    if not in_edges:
        return None

    window = timedelta(hours=hours)
    best: dict[str, Any] | None = None

    # Evaluate rolling `hours` windows anchored at each incoming transfer
    for d_in in in_edges:
        t0 = d_in["ts"]
        t1 = t0 + window
        win_in = sum(d["amount"] for d in in_edges if t0 <= d["ts"] <= t1)
        win_out = sum(d["amount"] for d in out_edges if t0 <= d["ts"] <= t1)
        if win_in <= 0:
            continue
        r = win_out / win_in
        if best is None or (r >= ratio and win_out > best["outflow"]) or (not best["is_pass_through"] and r > best["ratio"]):
            best = {
                "node": node,
                "inflow": round(win_in, 2),
                "outflow": round(win_out, 2),
                "ratio": round(r, 3),
                "is_pass_through": r >= ratio and win_out > 0,
                "window_start": t0.isoformat(timespec="minutes"),
            }

    return best


def run_detectors_on_graph(
    G: nx.MultiDiGraph,
    nodes: list[str] | None = None,
    fan_out_k: int = 5,
    fan_in_k: int = 10,
    pass_ratio: float = 0.80,
) -> dict[str, list[dict[str, Any]]]:
    """Run all three deterministic detectors across target nodes (or entire graph)."""
    target_nodes = nodes if nodes is not None else list(G.nodes())
    fan_out_hits: list[dict[str, Any]] = []
    fan_in_hits: list[dict[str, Any]] = []
    pass_through_hits: list[dict[str, Any]] = []

    for n in target_nodes:
        fan_out_hits.extend(fan_out(G, n, window_minutes=60, k=fan_out_k))
        fan_in_hits.extend(fan_in(G, n, window_hours=24, k=fan_in_k))
        pt = pass_through(G, n, hours=24, ratio=pass_ratio)
        if pt and pt["is_pass_through"]:
            pass_through_hits.append(pt)

    return {
        "fan_out": fan_out_hits,
        "fan_in": fan_in_hits,
        "pass_through": pass_through_hits,
    }


def extract_ego_subgraph(
    G: nx.MultiDiGraph,
    focus_account: str,
    hops: int = 2,
    max_nodes: int = 150,
) -> nx.MultiDiGraph:
    """Extract a bounded ego subgraph centered on `focus_account`."""
    if focus_account not in G:
        return nx.MultiDiGraph()

    undirected = G.to_undirected(as_view=True)
    ego_nodes = list(nx.ego_graph(undirected, focus_account, radius=hops).nodes())

    if len(ego_nodes) > max_nodes:
        # Keep closest nodes first via BFS ordering from focus_account
        bfs_nodes = [focus_account]
        for _, v in nx.bfs_edges(undirected, focus_account, depth_limit=hops):
            if v not in bfs_nodes:
                bfs_nodes.append(v)
            if len(bfs_nodes) >= max_nodes:
                break
        ego_nodes = bfs_nodes

    return G.subgraph(ego_nodes).copy()


def render_pyvis_html(
    G: nx.MultiDiGraph,
    focus_account: str,
    hops: int = 2,
    max_nodes: int = 150,
    height: str = "520px",
) -> str:
    """Render an interactive PyVis network centered on `focus_account` as HTML."""
    sub = extract_ego_subgraph(G, focus_account, hops=hops, max_nodes=max_nodes)
    if sub.number_of_nodes() == 0:
        safe_acct = html_lib.escape(focus_account)
        return (
            "<div style='padding:24px;font-family:sans-serif;color:#666;'>"
            f"No graph transactions found for account <b>{safe_acct}</b>."
            "</div>"
        )

    net = Network(height=height, width="100%", directed=True, bgcolor="#ffffff", font_color="#222222")
    net.barnes_hut(gravity=-3500, central_gravity=0.35, spring_length=140, spring_strength=0.05)

    for n in sub.nodes():
        in_deg = sub.in_degree(n)
        out_deg = sub.out_degree(n)
        if n == focus_account:
            color = "#d62728"  # Primary suspect in crimson red
            size = 28
        elif out_deg >= 5 or in_deg >= 5:
            color = "#ff7f0e"  # Secondary high-degree hub/mule in orange
            size = 20
        else:
            color = "#1f77b4"  # Normal neighbor in steel blue
            size = 15

        title = f"Account: {n}<br>In-edges: {in_deg} | Out-edges: {out_deg}"
        net.add_node(n, label=n, title=title, color=color, size=size)

    # Aggregate parallel edges between same (u, v) cleanly so graph stays readable
    edge_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for u, v, d in sub.edges(data=True):
        edge_groups[(u, v)].append(d)

    for (u, v), tx_list in edge_groups.items():
        total_amt = sum(d["amount"] for d in tx_list)
        count = len(tx_list)
        label = f"INR {total_amt:,.0f}" if count == 1 else f"INR {total_amt:,.0f} ({count}x)"
        lines = [
            f"{d['txn_id']}: INR {d['amount']:,.2f} @ {d['ts'].strftime('%d-%b %H:%M')}"
            for d in sorted(tx_list, key=lambda x: x["ts"])[:8]
        ]
        if count > 8:
            lines.append(f"... +{count - 8} more")
        tooltip = "<br>".join(lines)
        net.add_edge(u, v, label=label, title=tooltip, value=max(1.0, min(total_amt / 5000.0, 8.0)))

    return net.generate_html()


def _get_connection(
    db_path: str | Path | None = None,
    conn: sqlite3.Connection | None = None,
) -> tuple[sqlite3.Connection, bool]:
    if conn is not None:
        return conn, False
    target = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
    c = sqlite3.connect(str(target), check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c, True


def resolve_case_focus_account(conn: sqlite3.Connection, case_id: str) -> str | None:
    """Determine the primary subject account for a given case_id."""
    rows = conn.execute(
        """
        SELECT a.account_id, a.txn_id
        FROM case_alerts ca
        JOIN alerts a ON ca.alert_id = a.alert_id
        WHERE ca.case_id = ?
        """,
        (case_id,),
    ).fetchall()

    accounts = [r["account_id"] for r in rows if r["account_id"]]
    if accounts:
        return Counter(accounts).most_common(1)[0][0]

    txn_ids = [r["txn_id"] for r in rows if r["txn_id"]]
    if txn_ids:
        placeholders = ",".join("?" for _ in txn_ids)
        tx = conn.execute(
            f"SELECT from_account FROM transactions WHERE txn_id IN ({placeholders}) LIMIT 1",
            tuple(txn_ids),
        ).fetchone()
        if tx:
            return tx["from_account"]
    return None


def get_case_graph_html(
    case_id: str,
    hops: int = 2,
    db_path: str | Path | None = None,
    conn: sqlite3.Connection | None = None,
) -> str:
    """Return an interactive PyVis HTML string for a case's money trail.

    Exact handshake contract:
        get_case_graph_html(case_id: str) -> str
    """
    c, should_close = _get_connection(db_path=db_path, conn=conn)
    try:
        focus = resolve_case_focus_account(c, case_id)
        if not focus:
            safe_case = html_lib.escape(case_id)
            return (
                "<div style='padding:24px;font-family:sans-serif;color:#666;'>"
                f"No alerts or focus account found for case <b>{safe_case}</b>."
                "</div>"
            )

        txns_df = pd.read_sql_query("SELECT * FROM transactions", c)
        if txns_df.empty:
            return "<div style='padding:24px;font-family:sans-serif;color:#666;'>No transactions in database.</div>"

        G = build_graph(txns_df)
        return render_pyvis_html(G, focus_account=focus, hops=hops)
    finally:
        if should_close:
            c.close()
