"""Alert correlation engine for Fraxillion (Segment 2).

Groups related alerts into candidate investigation cases using shared attribute linkage
(shared account, device, beneficiary VPA) and graph connected components.
Applies hub-cap exclusion to prevent high-degree merchant/aggregator nodes from
causing runaway clustering.
"""

from collections import defaultdict
from datetime import datetime
import sqlite3
from typing import Any
import networkx as nx


def correlate(
    conn: sqlite3.Connection,
    hub_threshold: int = 20,
    max_case_size: int = 30,
) -> dict[str, Any]:
    """Correlate alerts into candidate cases based on shared attributes.

    Args:
        conn: SQLite connection.
        hub_threshold: Maximum distinct alerts an attribute can link before being dropped as a hub.
        max_case_size: Maximum allowed alerts in a candidate case before flagging as oversized.

    Returns:
        dict containing 'candidates', 'dropped_hubs', and 'skipped_oversized'.
    """
    # 1. Fetch alerts joined with transaction data for monetary and beneficiary context
    cur = conn.execute(
        """
        SELECT 
            a.alert_id, a.txn_id, a.account_id, a.device_id, a.to_vpa,
            a.rule, a.severity, a.score, a.reason, a.ts, a.is_fraud,
            t.amount, t.from_account, t.to_account
        FROM alerts a
        LEFT JOIN transactions t ON a.txn_id = t.txn_id
        """
    )
    alert_rows = [dict(r) for r in cur.fetchall()]

    if not alert_rows:
        return {"candidates": [], "dropped_hubs": [], "skipped_oversized": []}

    # Map each alert_id to its record for quick lookups
    alerts_by_id = {a["alert_id"]: a for a in alert_rows}

    # 2. Build blocking keys
    key_to_alerts: dict[str, set[str]] = defaultdict(set)
    for a in alert_rows:
        aid = a["alert_id"]
        if a.get("account_id") and a["account_id"].strip():
            key_to_alerts[f"acct:{a['account_id'].strip()}"].add(aid)
        if a.get("device_id") and a["device_id"].strip():
            key_to_alerts[f"dev:{a['device_id'].strip()}"].add(aid)
        if a.get("to_vpa") and a["to_vpa"].strip():
            key_to_alerts[f"vpa:{a['to_vpa'].strip()}"].add(aid)

    # 3. Identify and drop hubs (attributes with alert count > hub_threshold)
    G = nx.Graph()
    explanations: dict[tuple[str, str], list[str]] = defaultdict(list)
    dropped_hubs: list[dict[str, Any]] = []

    for key, alert_ids in key_to_alerts.items():
        if len(alert_ids) > hub_threshold:
            dropped_hubs.append({
                "key": key,
                "alert_count": len(alert_ids),
                "reason": f"Shared by {len(alert_ids)} alerts (> hub threshold of {hub_threshold})",
            })
            continue  # Exclude hub attribute from creating graph edges

        # For non-hub keys, create edges between all pairs of alerts sharing this key
        ids = sorted(alert_ids)
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                u, v = ids[i], ids[j]
                G.add_edge(u, v)
                explanations[(u, v)].append(key)
                explanations[(v, u)].append(key)

    # 4. Find connected components (candidate clusters)
    candidates: list[dict[str, Any]] = []
    skipped_oversized: list[dict[str, Any]] = []

    # Sort components by size descending for consistent, readable output
    components = sorted(list(nx.connected_components(G)), key=len, reverse=True)

    cand_counter = 1
    for comp in components:
        comp_size = len(comp)

        # Skip oversized components
        if comp_size > max_case_size:
            skipped_oversized.append({
                "size": comp_size,
                "alerts": sorted(comp),
                "reason": f"Component has {comp_size} alerts, exceeding max case size of {max_case_size}",
            })
            continue

        # Keep clusters with at least 2 alerts
        if comp_size >= 2:
            comp_alerts = sorted(comp)

            # Collect all distinct shared keys that explain the connections in this subgraph
            sub_g = G.subgraph(comp)
            shared_keys_set = set()
            for u, v in sub_g.edges():
                shared_keys_set.update(explanations.get((u, v), []))

            # Calculate total transaction amount and distinct beneficiaries
            total_amt = 0.0
            beneficiaries = set()
            severities = []

            for aid in comp_alerts:
                item = alerts_by_id.get(aid, {})
                amt = item.get("amount")
                if amt is not None:
                    try:
                        total_amt += float(amt)
                    except (ValueError, TypeError):
                        pass

                vpa = item.get("to_vpa")
                if vpa:
                    beneficiaries.add(vpa)
                to_acc = item.get("to_account")
                if to_acc:
                    beneficiaries.add(to_acc)

                severities.append(item.get("severity", "LOW"))

            # Determine highest severity in candidate
            if "HIGH" in severities:
                highest_sev = "HIGH"
            elif "MEDIUM" in severities:
                highest_sev = "MEDIUM"
            else:
                highest_sev = "LOW"

            candidates.append({
                "id": f"CAND-{cand_counter}",
                "alerts": comp_alerts,
                "shared_keys": sorted(shared_keys_set),
                "total_amount": round(total_amt, 2),
                "distinct_beneficiaries": len(beneficiaries),
                "highest_severity": highest_sev,
                "alert_count": comp_size,
            })
            cand_counter += 1

    return {
        "candidates": candidates,
        "dropped_hubs": dropped_hubs,
        "skipped_oversized": skipped_oversized,
    }


def create_case(conn: sqlite3.Connection, candidate: dict[str, Any], actor: str = "ANALYST") -> str:
    """Promote a candidate cluster into an official investigation case.

    Enforces maker-checker prerequisite: an alert can only belong to one case.

    Args:
        conn: SQLite connection.
        candidate: Candidate case dictionary from correlate().
        actor: Username or role creating the case.

    Returns:
        str: Generated case_id (e.g. 'CS-2026-0001').
    """
    alerts = candidate["alerts"]
    if not alerts:
        raise ValueError("Cannot create a case without alerts.")

    # 1. Check if any alert is already assigned to an existing case
    placeholders = ",".join("?" for _ in alerts)
    cur = conn.execute(
        f"SELECT alert_id, case_id FROM case_alerts WHERE alert_id IN ({placeholders})",
        alerts,
    )
    conflicts = cur.fetchall()
    if conflicts:
        conflict = conflicts[0]
        raise ValueError(
            f"Alert {conflict['alert_id']} is already assigned to case {conflict['case_id']}."
        )

    # 2. Generate next sequential case ID (e.g. CS-2026-0001)
    year = datetime.now().year
    prefix = f"CS-{year}-"
    cur = conn.execute(
        "SELECT case_id FROM cases WHERE case_id LIKE ? ORDER BY case_id DESC LIMIT 1",
        (f"{prefix}%",),
    )
    last_row = cur.fetchone()
    if last_row and last_row[0]:
        try:
            last_num = int(last_row[0].split("-")[-1])
            next_num = last_num + 1
        except ValueError:
            next_num = 1
    else:
        next_num = 1

    case_id = f"{prefix}{next_num:04d}"

    # 3. Create descriptive case title
    shared_str = ", ".join(candidate.get("shared_keys", []))
    title = f"Syndicate Cluster ({len(alerts)} alerts, Keys: {shared_str[:50]})"

    # 4. Insert case record
    now_iso = datetime.now().isoformat()
    conn.execute(
        """
        INSERT INTO cases (case_id, title, status, severity, amount, shared_keys, created_at)
        VALUES (?, ?, 'NEW', ?, ?, ?, ?)
        """,
        (
            case_id,
            title,
            candidate.get("highest_severity", "MEDIUM"),
            candidate.get("total_amount", 0.0),
            shared_str,
            now_iso,
        ),
    )

    # 5. Insert alert mappings into case_alerts
    for aid in alerts:
        conn.execute(
            "INSERT INTO case_alerts (case_id, alert_id) VALUES (?, ?)",
            (case_id, aid),
        )

    # 6. Audit log entry
    details = (
        f"Created case {case_id} with {len(alerts)} alerts. "
        f"Amount: INR {candidate.get('total_amount', 0.0):,.2f}. Keys: {shared_str}"
    )
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
        VALUES (?, 'CREATE_CASE', 'CASE', ?, ?, ?)
        """,
        (actor, case_id, details, now_iso),
    )

    conn.commit()
    return case_id
