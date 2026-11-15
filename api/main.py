"""Live FastAPI boundary for the Fraxillion console.

This service is the only data source for the Next.js console. It reads and
writes the project's SQLite database (`fraxillion.db`) through the existing
`core/*` modules, powering the Fraxillion investigation suite:

* ingest   -> core.ingest.ingest_alerts / ingest_transactions
* correlate-> core.correlate.correlate / create_case
* score    -> core.score.score_case + models/eval_metrics.json
* graph    -> core.graph.build_graph / extract_ego_subgraph / detectors
* evidence -> core.evidence.add_evidence / verify_chain / export_bundle
* workflow -> core.workflow.transition / create_decision / approve / reject
* reports  -> core.report.build_case_object / render_* / validate_* / save_report

The database starts empty. Nothing is seeded until the operator calls
`POST /api/dataset/load` (or ingests a file), which is what the UI onboarding
asks them to do.

Run:
    python -m uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import shutil
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
EXPORTS_DIR = PROJECT_ROOT / "exports"
EVIDENCE_DIR = PROJECT_ROOT / "evidence_files"
MODELS_DIR = PROJECT_ROOT / "models"

import sys

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.correlate import correlate as correlate_alerts  # noqa: E402
from core.correlate import create_case  # noqa: E402
from core.db import ensure_db, get_conn  # noqa: E402
from core.evidence import add_evidence, export_bundle, verify_chain  # noqa: E402
from core.graph import (  # noqa: E402
    build_graph,
    extract_ego_subgraph,
    resolve_case_focus_account,
    run_detectors_on_graph,
)
from core.ingest import ingest_alerts, ingest_transactions  # noqa: E402
from core.report import (  # noqa: E402
    build_case_object,
    render_pfr,
    render_str,
    save_report,
    validate_pfr,
    validate_str,
)
from core.score import score_case  # noqa: E402
from core.workflow import (  # noqa: E402
    ALLOWED,
    approve as approve_decision,
    create_decision,
    mark_filed,
    reject as reject_decision,
    transition,
)

import pandas as pd  # noqa: E402

app = FastAPI(
    title="Fraxillion API",
    version="3.0.0",
    description="FastAPI boundary over the Fraxillion SQLite database and Python core.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_CASE_YEAR = datetime.now().year
_WRITE_LOCK = threading.Lock()
_TAMPER_BACKUPS: dict[int, bytes] = {}
_LAST_CORRELATION: dict[str, Any] | None = None

TABLES = [
    "case_alerts",
    "decisions",
    "evidence",
    "reports",
    "audit_log",
    "alerts",
    "transactions",
    "cases",
    "raw_events",
]


# ---------------------------------------------------------------------------
# Infrastructure helpers
# ---------------------------------------------------------------------------


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _count(conn: sqlite3.Connection, table: str) -> int:
    return int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def _band(score: float) -> str:
    if score >= 0.85:
        return "CRITICAL"
    if score >= 0.70:
        return "HIGH"
    if score >= 0.40:
        return "MEDIUM"
    return "LOW"


def _counts() -> dict[str, int]:
    with db() as conn:
        return {
            "transactions": _count(conn, "transactions"),
            "alerts": _count(conn, "alerts"),
            "cases": _count(conn, "cases"),
            "evidence": _count(conn, "evidence"),
            "decisions": _count(conn, "decisions"),
            "reports": _count(conn, "reports"),
            "auditEntries": _count(conn, "audit_log"),
        }


def _file_meta(path_str: str) -> dict[str, Any]:
    path = Path(path_str)
    exists = path.exists()
    return {
        "filename": path.name,
        "sizeBytes": path.stat().st_size if exists else 0,
        "exists": exists,
    }


# ---------------------------------------------------------------------------
# Serialisers
# ---------------------------------------------------------------------------


def _alert(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    return {
        "alertId": row["alert_id"],
        "txnId": row["txn_id"],
        "accountId": row["account_id"],
        "deviceId": row["device_id"] or None,
        "toVpa": row["to_vpa"] or None,
        "rule": row["rule"],
        "severity": row["severity"],
        "score": float(row["score"] or 0.0),
        "reason": row["reason"] or "",
        "ts": row["ts"],
        "isFraud": bool(row["is_fraud"]),
        "caseId": row["case_id"] if "case_id" in keys else None,
    }


def _transaction(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "txnId": row["txn_id"],
        "ts": row["ts"],
        "fromAccount": row["from_account"],
        "toAccount": row["to_account"],
        "toVpa": row["to_vpa"] or "",
        "amount": float(row["amount"] or 0.0),
        "channel": row["channel"] or "UPI",
        "deviceId": row["device_id"] or "",
        "city": row["city"] or "",
        "isFraud": bool(row["is_fraud"]),
    }


def _evidence(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "caseId": row["case_id"],
        "path": row["path"],
        **_file_meta(row["path"]),
        "kind": row["kind"],
        "fileHash": row["file_hash"],
        "prevHash": row["prev_hash"],
        "itemHash": row["item_hash"],
        "createdAt": row["created_at"],
    }


def _decision(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "caseId": row["case_id"],
        "decisionType": row["decision_type"],
        "grounds": row["grounds"] or "",
        "rationale": row["rationale"] or "",
        "maker": row["maker"] or "",
        "checker": row["checker"] or None,
        "status": row["status"],
        "createdAt": row["created_at"],
        "decidedAt": row["decided_at"],
    }


def _audit(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "actor": row["actor"] or "",
        "action": row["action"] or "",
        "objectType": row["object_type"] or "",
        "objectId": row["object_id"] or "",
        "details": row["details"] or "",
        "createdAt": row["created_at"],
    }


def _case_summary(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    counts = conn.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM case_alerts ca WHERE ca.case_id = c.case_id) AS alert_count,
          (SELECT COUNT(*) FROM evidence e WHERE e.case_id = c.case_id) AS evidence_count,
          (SELECT COUNT(*) FROM decisions d WHERE d.case_id = c.case_id) AS decision_count
        FROM cases c WHERE c.case_id = ?
        """,
        (row["case_id"],),
    ).fetchone()
    return {
        "caseId": row["case_id"],
        "title": row["title"] or "",
        "status": row["status"],
        "severity": row["severity"] or "MEDIUM",
        "amount": float(row["amount"] or 0.0),
        "sharedKeys": [k.strip() for k in (row["shared_keys"] or "").split(",") if k.strip()],
        "createdAt": row["created_at"],
        "alertCount": int(counts["alert_count"]),
        "evidenceCount": int(counts["evidence_count"]),
        "decisionCount": int(counts["decision_count"]),
        "allowedTransitions": ALLOWED.get(row["status"], []),
    }


def _case_rows(conn: sqlite3.Connection, where: str = "", params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    sql = f"SELECT * FROM cases {where} ORDER BY created_at DESC"
    return [_case_summary(conn, row) for row in conn.execute(sql, params).fetchall()]


def _case_or_404(conn: sqlite3.Connection, case_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    return row


# ---------------------------------------------------------------------------
# Dataset lifecycle
# ---------------------------------------------------------------------------


def _read_csv(path: Path) -> list[dict[str, Any]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return [dict(row) for row in csv.DictReader(fh)]


def _sample_path(kind: str) -> Path:
    mapping = {
        "alerts": DATA_DIR / "synthetic_alerts.csv",
        "dirty": DATA_DIR / "synthetic_alerts_dirty.csv",
        "transactions": DATA_DIR / "synthetic_transactions.csv",
    }
    path = mapping.get(kind)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail=f"Sample dataset '{kind}' is not available.")
    return path


def _ingest_rows(conn: sqlite3.Connection, kind: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    started = time.perf_counter()
    if kind == "transactions":
        result = ingest_transactions(rows, conn)
    else:
        result = ingest_alerts(rows, conn)
    result["rejected"] = [
        {"row": item.get("row"), "reason": item.get("error", "Rejected by schema validation")}
        for item in result.get("rejected", [])
    ]
    result["durationMs"] = int((time.perf_counter() - started) * 1000)
    return result


def _load_sample() -> dict[str, Any]:
    transactions = _read_csv(_sample_path("transactions"))
    alerts = _read_csv(_sample_path("alerts"))
    with _WRITE_LOCK, db() as conn:
        txn_result = _ingest_rows(conn, "transactions", transactions)
        alert_result = _ingest_rows(conn, "alerts", alerts)
        conn.execute(
            """
            INSERT INTO audit_log (actor, action, object_type, object_id, details, created_at)
            VALUES ('SYSTEM', 'LOAD_SAMPLE', 'DATASET', 'sample', ?, ?)
            """,
            (
                f"Loaded baseline sample: {txn_result['accepted']} transactions, "
                f"{alert_result['accepted']} alerts accepted.",
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
    return {"transactions": txn_result, "alerts": alert_result, "counts": _counts()}


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "status": "online",
        "service": "Fraxillion API",
        "frontend": "http://localhost:3000",
        "docs": "http://localhost:8000/docs",
        "health": "http://localhost:8000/api/health",
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mode": "sqlite + python-core",
        "projectRoot": str(PROJECT_ROOT),
        "database": str(PROJECT_ROOT / "fraxillion.db"),
        "counts": _counts(),
    }


@app.get("/api/dataset")
def dataset_state() -> dict[str, Any]:
    counts = _counts()
    return {
        **counts,
        "loaded": counts["transactions"] > 0 or counts["alerts"] > 0,
    }


@app.post("/api/dataset/load")
def load_sample_dataset() -> dict[str, Any]:
    return _load_sample()


def _reset_dataset() -> dict[str, Any]:
    """Empty the demo database and generated artifacts. Schema is kept."""
    with _WRITE_LOCK, db() as conn:
        for table in TABLES:
            conn.execute(f"DELETE FROM {table}")
        conn.execute("DELETE FROM sqlite_sequence")
        conn.commit()
    for folder in (EVIDENCE_DIR, EXPORTS_DIR):
        if folder.exists():
            for item in folder.iterdir():
                if item.is_file():
                    item.unlink()
    _TAMPER_BACKUPS.clear()
    global _LAST_CORRELATION
    _LAST_CORRELATION = None
    return {"ok": True, "counts": _counts()}


@app.post("/api/dataset/reset")
def reset_dataset() -> dict[str, Any]:
    """Empty the demo database and generated artifacts. Schema is kept."""
    return _reset_dataset()


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------


class IngestPayload(BaseModel):
    rows: list[dict[str, Any]]


@app.post("/api/ingest/sample/{kind}")
def ingest_sample(kind: str) -> dict[str, Any]:
    if kind not in {"alerts", "dirty", "transactions"}:
        raise HTTPException(status_code=400, detail="kind must be alerts, dirty or transactions.")
    rows = _read_csv(_sample_path(kind))
    with _WRITE_LOCK, db() as conn:
        return _ingest_rows(conn, "transactions" if kind == "transactions" else "alerts", rows)


@app.post("/api/ingest/alerts")
def ingest_alert_rows(payload: IngestPayload) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        return _ingest_rows(conn, "alerts", payload.rows)


@app.post("/api/ingest/transactions")
def ingest_transaction_rows(payload: IngestPayload) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        return _ingest_rows(conn, "transactions", payload.rows)


@app.post("/api/ingest/upload")
async def ingest_upload(
    file: UploadFile = File(...),
    kind: str = Query("alerts", pattern="^(alerts|transactions)$"),
) -> dict[str, Any]:
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Upload a UTF-8 CSV file.")
    rows = [dict(row) for row in csv.DictReader(io.StringIO(text))]
    if not rows:
        raise HTTPException(status_code=400, detail="The CSV has no data rows.")
    with _WRITE_LOCK, db() as conn:
        return _ingest_rows(conn, kind, rows)


# ---------------------------------------------------------------------------
# Alerts and transactions
# ---------------------------------------------------------------------------


@app.get("/api/alerts")
def list_alerts(
    severity: str | None = None,
    q: str | None = None,
    linked: str | None = Query(None, pattern="^(yes|no)$"),
    limit: int = Query(250, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []
    if severity and severity != "all":
        clauses.append("a.severity = ?")
        params.append(severity)
    if q:
        clauses.append("(a.alert_id LIKE ? OR a.account_id LIKE ? OR a.rule LIKE ?)")
        term = f"%{q}%"
        params.extend([term, term, term])
    if linked == "yes":
        clauses.append("ca.case_id IS NOT NULL")
    elif linked == "no":
        clauses.append("ca.case_id IS NULL")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db() as conn:
        total = conn.execute(
            f"""
            SELECT COUNT(*) FROM alerts a
            LEFT JOIN case_alerts ca ON ca.alert_id = a.alert_id
            {where}
            """,
            tuple(params),
        ).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT a.*, ca.case_id
            FROM alerts a
            LEFT JOIN case_alerts ca ON ca.alert_id = a.alert_id
            {where}
            ORDER BY a.ts DESC, a.alert_id DESC
            LIMIT ? OFFSET ?
            """,
            tuple(params) + (limit, offset),
        ).fetchall()
        severity_counts = {
            row["severity"]: int(row["n"])
            for row in conn.execute("SELECT severity, COUNT(*) AS n FROM alerts GROUP BY severity")
        }
        unlinked = conn.execute(
            "SELECT COUNT(*) FROM alerts a LEFT JOIN case_alerts ca ON ca.alert_id=a.alert_id WHERE ca.case_id IS NULL"
        ).fetchone()[0]
    return {
        "items": [_alert(r) for r in rows],
        "total": int(total),
        "unlinked": int(unlinked),
        "severityCounts": severity_counts,
    }


@app.get("/api/transactions")
def list_transactions(
    q: str | None = None,
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    where = ""
    params: list[Any] = []
    if q:
        where = "WHERE txn_id LIKE ? OR from_account LIKE ? OR to_account LIKE ? OR to_vpa LIKE ?"
        term = f"%{q}%"
        params = [term, term, term, term]
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM transactions {where}", tuple(params)).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM transactions {where} ORDER BY ts DESC LIMIT ? OFFSET ?",
            tuple(params) + (limit, offset),
        ).fetchall()
    return {"items": [_transaction(r) for r in rows], "total": int(total)}


# ---------------------------------------------------------------------------
# Correlation
# ---------------------------------------------------------------------------


class CorrelationParams(BaseModel):
    hub_threshold: int = Field(default=20, ge=1, le=100)
    max_case_size: int = Field(default=30, ge=2, le=200)


class CandidateRequest(BaseModel):
    candidate_id: str
    actor: str = "ANALYST"


def _shape_correlation(result: dict[str, Any], params: CorrelationParams, conn: sqlite3.Connection) -> dict[str, Any]:
    assigned = {
        row["alert_id"]: row["case_id"]
        for row in conn.execute("SELECT alert_id, case_id FROM case_alerts").fetchall()
    }
    candidates = []
    for item in result["candidates"]:
        accepted = [assigned[a] for a in item["alerts"] if a in assigned]
        candidates.append(
            {
                "id": item["id"],
                "alerts": item["alerts"],
                "sharedKeys": item["shared_keys"],
                "totalAmount": round(float(item["total_amount"]), 2),
                "distinctBeneficiaries": int(item["distinct_beneficiaries"]),
                "highestSeverity": item["highest_severity"],
                "alertCount": int(item["alert_count"]),
                "acceptedCaseId": accepted[0] if accepted and len(accepted) == len(item["alerts"]) else None,
            }
        )
    return {
        "candidates": candidates,
        "droppedHubs": [
            {
                "key": h["key"],
                "alertCount": int(h["alert_count"]),
                "reason": h["reason"],
            }
            for h in result["dropped_hubs"]
        ],
        "skippedOversized": [
            {"size": int(s["size"]), "reason": s["reason"]} for s in result["skipped_oversized"]
        ],
        "runAt": _now(),
        "parameters": {"hubThreshold": params.hub_threshold, "maxCaseSize": params.max_case_size},
        "alertsConsidered": _count(conn, "alerts"),
    }


@app.get("/api/correlate")
def get_correlation() -> dict[str, Any]:
    if _LAST_CORRELATION is not None:
        return _LAST_CORRELATION
    with db() as conn:
        return {
            "candidates": [],
            "droppedHubs": [],
            "skippedOversized": [],
            "runAt": None,
            "parameters": {"hubThreshold": 20, "maxCaseSize": 30},
            "alertsConsidered": _count(conn, "alerts"),
        }


@app.post("/api/correlate/run")
def run_correlation(params: CorrelationParams) -> dict[str, Any]:
    if _counts()["alerts"] == 0:
        raise HTTPException(status_code=409, detail="Ingest alerts before running correlation.")
    with _WRITE_LOCK, db() as conn:
        result = correlate_alerts(conn, hub_threshold=params.hub_threshold, max_case_size=params.max_case_size)
        shaped = _shape_correlation(result, params, conn)
    global _LAST_CORRELATION
    _LAST_CORRELATION = shaped
    return shaped


@app.post("/api/correlate/accept")
def accept_candidate(request: CandidateRequest) -> dict[str, Any]:
    global _LAST_CORRELATION
    params = CorrelationParams()
    if _LAST_CORRELATION:
        params = CorrelationParams(
            hub_threshold=_LAST_CORRELATION["parameters"]["hubThreshold"],
            max_case_size=_LAST_CORRELATION["parameters"]["maxCaseSize"],
        )
    with _WRITE_LOCK, db() as conn:
        result = correlate_alerts(conn, hub_threshold=params.hub_threshold, max_case_size=params.max_case_size)
        candidate = next((c for c in result["candidates"] if c["id"] == request.candidate_id), None)
        if not candidate:
            raise HTTPException(
                status_code=404,
                detail=f"Candidate {request.candidate_id} is not part of the current correlation run.",
            )
        try:
            case_id = create_case(conn, candidate, actor=request.actor or "ANALYST")
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        shaped = _shape_correlation(result, params, conn)
    _LAST_CORRELATION = shaped
    return {
        "caseId": case_id,
        "message": f"Candidate {request.candidate_id} accepted as {case_id}.",
    }


# ---------------------------------------------------------------------------
# Cases, risk, graph
# ---------------------------------------------------------------------------


@app.get("/api/cases")
def list_cases(status: str | None = None, severity: str | None = None) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if status and status != "all":
        clauses.append("status = ?")
        params.append(status)
    if severity and severity != "all":
        clauses.append("severity = ?")
        params.append(severity)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db() as conn:
        return _case_rows(conn, where, tuple(params))


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> dict[str, Any]:
    with db() as conn:
        row = _case_or_404(conn, case_id)
        summary = _case_summary(conn, row)
        alerts = [
            _alert(r)
            for r in conn.execute(
                """
                SELECT a.*, ca.case_id
                FROM case_alerts ca JOIN alerts a ON a.alert_id = ca.alert_id
                WHERE ca.case_id = ?
                ORDER BY a.ts DESC
                """,
                (case_id,),
            )
        ]
        transactions = [
            _transaction(r)
            for r in conn.execute(
                """
                SELECT DISTINCT t.*
                FROM case_alerts ca
                JOIN alerts a ON a.alert_id = ca.alert_id
                JOIN transactions t ON t.txn_id = a.txn_id
                WHERE ca.case_id = ?
                ORDER BY t.ts ASC
                """,
                (case_id,),
            )
        ]
        evidence = [
            _evidence(r)
            for r in conn.execute(
                "SELECT * FROM evidence WHERE case_id = ? ORDER BY id ASC", (case_id,)
            )
        ]
        decisions = [
            _decision(r)
            for r in conn.execute(
                "SELECT * FROM decisions WHERE case_id = ? ORDER BY id DESC", (case_id,)
            )
        ]
        audit = [
            _audit(r)
            for r in conn.execute(
                """
                SELECT * FROM audit_log
                WHERE object_id = ? OR details LIKE ?
                ORDER BY id ASC
                """,
                (case_id, f"%{case_id}%"),
            )
        ]
        accounts = [
            {"accountId": r["account_id"], "alertCount": int(r["n"])}
            for r in conn.execute(
                """
                SELECT a.account_id, COUNT(*) AS n
                FROM case_alerts ca JOIN alerts a ON a.alert_id = ca.alert_id
                WHERE ca.case_id = ? AND a.account_id != ''
                GROUP BY a.account_id ORDER BY n DESC
                """,
                (case_id,),
            )
        ]
    return {**summary, "alerts": alerts, "transactions": transactions, "evidence": evidence, "decisions": decisions, "audit": audit, "accounts": accounts}


MODEL_NAMES = {"RandomForest", "LogisticRegression"}


@app.get("/api/cases/{case_id}/risk")
def get_case_risk(case_id: str, model: str = "RandomForest") -> dict[str, Any]:
    if model not in MODEL_NAMES:
        raise HTTPException(status_code=400, detail=f"Unknown model '{model}'.")
    with db() as conn:
        _case_or_404(conn, case_id)
        try:
            result = score_case(case_id, model_name=model, conn=conn)
        except Exception as exc:  # model file or feature failure
            raise HTTPException(status_code=500, detail=f"Scoring failed: {exc}") from exc
    score = float(result.get("score") or 0.0)
    return {
        "caseId": case_id,
        "score": round(score, 4),
        "band": _band(score),
        "model": result.get("model", model),
        "reasons": result.get("reasons", []),
        "scoredAt": _now(),
    }


@app.get("/api/cases/{case_id}/graph")
def get_case_graph(
    case_id: str,
    hops: int = Query(2, ge=1, le=3),
    focus: str | None = None,
) -> dict[str, Any]:
    with db() as conn:
        _case_or_404(conn, case_id)
        focus_account = focus or resolve_case_focus_account(conn, case_id)
        if not focus_account:
            raise HTTPException(status_code=409, detail="This case has no linked account to anchor the graph.")
        txns = pd.read_sql_query("SELECT * FROM transactions", conn)
        if txns.empty:
            raise HTTPException(status_code=409, detail="No transactions are loaded.")
        graph = build_graph(txns)
        if focus_account not in graph:
            raise HTTPException(status_code=404, detail=f"No transactions found for account {focus_account}.")
        sub = extract_ego_subgraph(graph, focus_account, hops=hops)

        case_accounts = {
            r["account_id"]
            for r in conn.execute(
                """
                SELECT a.account_id FROM case_alerts ca
                JOIN alerts a ON a.alert_id = ca.alert_id
                WHERE ca.case_id = ?
                """,
                (case_id,),
            )
        }
        nodes = []
        for node in sub.nodes():
            in_edges = list(sub.in_edges(node, data=True))
            out_edges = list(sub.out_edges(node, data=True))
            nodes.append(
                {
                    "id": str(node),
                    "inDegree": len(in_edges),
                    "outDegree": len(out_edges),
                    "amountIn": round(sum(float(e[2].get("amount", 0)) for e in in_edges), 2),
                    "amountOut": round(sum(float(e[2].get("amount", 0)) for e in out_edges), 2),
                    "role": "focus" if node == focus_account else "suspect" if node in case_accounts else "counterparty",
                }
            )

        grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for u, v, data in sub.edges(data=True):
            grouped.setdefault((str(u), str(v)), []).append(data)

        edges = []
        for (source, target), items in grouped.items():
            items_sorted = sorted(items, key=lambda d: d["ts"])
            edges.append(
                {
                    "id": f"{source}->{target}",
                    "source": source,
                    "target": target,
                    "amount": round(sum(float(d["amount"]) for d in items_sorted), 2),
                    "count": len(items_sorted),
                    "txnIds": [d.get("txn_id", "") for d in items_sorted][:50],
                    "firstAt": items_sorted[0]["ts"].isoformat(),
                    "lastAt": items_sorted[-1]["ts"].isoformat(),
                }
            )

        detectors = run_detectors_on_graph(graph, nodes=list(sub.nodes()))
        motifs = {
            "fanOut": [
                {
                    "node": hit["node"],
                    "targets": hit["target_count"],
                    "windowStart": hit["window_start"],
                    "totalAmount": hit["total_amount"],
                }
                for hit in detectors["fan_out"]
            ],
            "fanIn": [
                {
                    "node": hit["node"],
                    "sources": hit["source_count"],
                    "windowStart": hit["window_start"],
                    "totalAmount": hit["total_amount"],
                }
                for hit in detectors["fan_in"]
            ],
            "passThrough": [
                {
                    "node": hit["node"],
                    "inflow": hit["inflow"],
                    "outflow": hit["outflow"],
                    "ratio": hit["ratio"],
                }
                for hit in detectors["pass_through"]
            ],
        }
        positions = _layout(nodes, edges, focus_account)

    timestamps = [e["firstAt"] for e in edges] + [e["lastAt"] for e in edges]
    return {
        "caseId": case_id,
        "focusAccount": focus_account,
        "hops": hops,
        "nodes": [{**n, **positions[n["id"]]} for n in nodes],
        "edges": edges,
        "motifs": motifs,
        "timeWindow": {"from": min(timestamps), "to": max(timestamps)} if timestamps else None,
    }


def _layout(nodes: list[dict[str, Any]], edges: list[dict[str, Any]], focus: str) -> dict[str, dict[str, float]]:
    """Deterministic left-to-right layout by BFS depth from the focus account."""
    adjacency: dict[str, set[str]] = {n["id"]: set() for n in nodes}
    for edge in edges:
        adjacency.setdefault(edge["source"], set()).add(edge["target"])
        adjacency.setdefault(edge["target"], set()).add(edge["source"])
    depth = {focus: 0}
    queue = [focus]
    while queue:
        current = queue.pop(0)
        for neighbour in sorted(adjacency.get(current, ())):
            if neighbour not in depth:
                depth[neighbour] = depth[current] + 1
                queue.append(neighbour)
    groups: dict[int, list[str]] = {}
    for node in nodes:
        groups.setdefault(depth.get(node["id"], 3), []).append(node["id"])
    positions: dict[str, dict[str, float]] = {}
    for level, ids in groups.items():
        ids.sort()
        for index, node_id in enumerate(ids):
            positions[node_id] = {
                "x": 40 + level * 260,
                "y": (index - (len(ids) - 1) / 2) * 140 + 300,
            }
    return positions


@app.get("/api/model/metrics")
def model_metrics() -> dict[str, Any]:
    path = MODELS_DIR / "eval_metrics.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="models/eval_metrics.json is missing.")
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Workflow and decisions
# ---------------------------------------------------------------------------


class TransitionRequest(BaseModel):
    status: str
    actor: str = "ANALYST"
    reason: str = ""


class DecisionRequest(BaseModel):
    decision_type: str
    grounds: str = ""
    rationale: str
    maker: str
    evidence_refs: str = ""


class CheckerRequest(BaseModel):
    checker: str


class RejectRequest(BaseModel):
    checker: str
    reason: str = ""


@app.post("/api/cases/{case_id}/transition")
def transition_case(case_id: str, payload: TransitionRequest) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        _case_or_404(conn, case_id)
        try:
            state = transition(conn, case_id, payload.status, actor=payload.actor, reason=payload.reason)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        row = _case_or_404(conn, case_id)
        return _case_summary(conn, row) | {"status": state}


@app.post("/api/cases/{case_id}/decisions")
def propose_decision(case_id: str, payload: DecisionRequest) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        _case_or_404(conn, case_id)
        try:
            decision_id = create_decision(
                conn,
                case_id,
                payload.decision_type,
                payload.grounds,
                payload.rationale,
                payload.maker,
                payload.evidence_refs,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        row = conn.execute("SELECT * FROM decisions WHERE id = ?", (decision_id,)).fetchone()
        return _decision(row)


@app.post("/api/decisions/{decision_id}/approve")
def approve(decision_id: int, payload: CheckerRequest) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        try:
            result = approve_decision(conn, decision_id, checker=payload.checker)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        row = conn.execute("SELECT * FROM decisions WHERE id = ?", (decision_id,)).fetchone()
        return {"result": result, "decision": _decision(row)}


@app.post("/api/decisions/{decision_id}/reject")
def reject(decision_id: int, payload: RejectRequest) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        try:
            result = reject_decision(conn, decision_id, checker=payload.checker, reason=payload.reason)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        row = conn.execute("SELECT * FROM decisions WHERE id = ?", (decision_id,)).fetchone()
        return {"result": result, "decision": _decision(row)}


class FileRequest(BaseModel):
    actor: str = "COMPLIANCE_OFFICER"


@app.post("/api/cases/{case_id}/file")
def file_case(case_id: str, payload: FileRequest) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        _case_or_404(conn, case_id)
        try:
            state = mark_filed(conn, case_id, actor=payload.actor)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"caseId": case_id, "status": state}


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


@app.get("/api/evidence")
def list_evidence(case_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        if case_id:
            _case_or_404(conn, case_id)
            rows = conn.execute("SELECT * FROM evidence WHERE case_id = ? ORDER BY id ASC", (case_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM evidence ORDER BY id DESC").fetchall()
        return [_evidence(r) for r in rows]


@app.post("/api/evidence/{item_id}/tamper")
def tamper_evidence(item_id: int) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        row = conn.execute("SELECT * FROM evidence WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Evidence {item_id} not found.")
        path = Path(row["path"])
        if not path.exists():
            raise HTTPException(status_code=409, detail="The evidence file is missing from disk.")
        original = path.read_bytes()
        _TAMPER_BACKUPS[item_id] = original
        backup_path = path.with_suffix(path.suffix + ".demo-original")
        backup_path.write_bytes(original)
        path.write_bytes(original + b"\nTAMPER-DEMO")
        return {
            "id": item_id,
            "message": "One byte block appended to the evidence file on disk.",
            "diskHash": hashlib.sha256(path.read_bytes()).hexdigest(),
        }


@app.post("/api/evidence/{item_id}/restore")
def restore_evidence(item_id: int) -> dict[str, Any]:
    with _WRITE_LOCK, db() as conn:
        row = conn.execute("SELECT * FROM evidence WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Evidence {item_id} not found.")
        path = Path(row["path"])
        backup_path = path.with_suffix(path.suffix + ".demo-original")
        original = _TAMPER_BACKUPS.get(item_id)
        if original is None and backup_path.exists():
            original = backup_path.read_bytes()
        if original is None:
            raise HTTPException(status_code=409, detail="No tamper backup exists for this item.")
        path.write_bytes(original)
        backup_path.unlink(missing_ok=True)
        _TAMPER_BACKUPS.pop(item_id, None)
        return {
            "id": item_id,
            "message": "Original bytes restored on disk.",
            "diskHash": hashlib.sha256(original).hexdigest(),
        }


def _verify_all(conn: sqlite3.Connection) -> dict[str, Any]:
    ok, failing_id, message = verify_chain(conn)
    rows = conn.execute("SELECT * FROM evidence ORDER BY id ASC").fetchall()
    previous = "0" * 64
    items = []
    for row in rows:
        path = Path(row["path"])
        exists = path.exists()
        disk_hash = hashlib.sha256(path.read_bytes()).hexdigest() if exists else ""
        payload = {
            "case_id": row["case_id"],
            "file_hash": row["file_hash"],
            "prev_hash": row["prev_hash"],
            "kind": row["kind"],
        }
        computed = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        state = "VERIFIED"
        if not exists or disk_hash != row["file_hash"]:
            state = "MISMATCH"
        elif row["prev_hash"] != previous:
            state = "MISMATCH"
        elif computed != row["item_hash"]:
            state = "MISMATCH"
        items.append({"id": row["id"], "state": state})
        previous = row["item_hash"]
    return {
        "ok": bool(ok),
        "checked": len(items),
        "failingId": failing_id,
        "message": message,
        "at": _now(),
        "items": items,
    }


@app.post("/api/evidence/verify")
def verify_evidence() -> dict[str, Any]:
    with db() as conn:
        return _verify_all(conn)


def _unique_evidence_path(filename: str, case_id: str) -> Path:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    safe = Path(filename).name or "evidence.bin"
    candidate = EVIDENCE_DIR / f"{case_id}_{safe}"
    if candidate.exists():
        counter = 2
        while True:
            candidate = EVIDENCE_DIR / f"{case_id}_{counter}_{safe}"
            if not candidate.exists():
                break
            counter += 1
    return candidate


@app.post("/api/evidence/attach-sample")
def attach_sample(case_id: str = Query(...), actor: str = Query("INVESTIGATOR")) -> dict[str, Any]:
    sample = DATA_DIR / "sample_evidence_note.txt"
    if not sample.exists():
        raise HTTPException(status_code=404, detail="data/sample_evidence_note.txt is missing.")
    with _WRITE_LOCK, db() as conn:
        _case_or_404(conn, case_id)
        target = _unique_evidence_path("sample_evidence_note.txt", case_id)
        target.write_bytes(sample.read_bytes())
        sealed = add_evidence(conn, case_id, target, kind="DOCUMENT", actor=actor)
        row = conn.execute("SELECT * FROM evidence WHERE id = ?", (sealed["id"],)).fetchone()
        return _evidence(row)


@app.post("/api/evidence/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    case_id: str = Query(...),
    kind: str = Query("DOCUMENT"),
    actor: str = Query("INVESTIGATOR"),
) -> dict[str, Any]:
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id is required.")
    with db() as conn:
        _case_or_404(conn, case_id)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    with _WRITE_LOCK, db() as conn:
        target = _unique_evidence_path(file.filename or "evidence.bin", case_id)
        target.write_bytes(content)
        sealed = add_evidence(conn, case_id, target, kind=kind.upper(), actor=actor)
        row = conn.execute("SELECT * FROM evidence WHERE id = ?", (sealed["id"],)).fetchone()
        return _evidence(row)


@app.get("/api/evidence/{item_id}/download")
def download_evidence(item_id: int) -> FileResponse:
    with db() as conn:
        row = conn.execute("SELECT * FROM evidence WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Evidence {item_id} not found.")
        path = Path(row["path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="The evidence file is missing from disk.")
        return FileResponse(path, filename=path.name)


@app.post("/api/evidence/export")
def export_evidence_bundle(case_id: str = Query(...)) -> FileResponse:
    with _WRITE_LOCK, db() as conn:
        _case_or_404(conn, case_id)
        count = conn.execute("SELECT COUNT(*) FROM evidence WHERE case_id = ?", (case_id,)).fetchone()[0]
        if not count:
            raise HTTPException(status_code=409, detail="This case has no evidence to export.")
        exports = EXPORTS_DIR
        exports.mkdir(parents=True, exist_ok=True)
        out_path = exports / f"{case_id}_evidence_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        export_bundle(conn, case_id, out_path)
        return FileResponse(out_path, filename=out_path.name, media_type="application/zip")


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def _report_history(conn: sqlite3.Connection, case_id: str) -> list[dict[str, Any]]:
    return [
        {
            "id": int(r["id"]),
            "regime": r["regime"],
            "filename": Path(r["path"]).name,
            "path": r["path"],
            "sha256": r["sha256"],
            "createdAt": r["created_at"],
        }
        for r in conn.execute("SELECT * FROM reports WHERE case_id = ? ORDER BY id DESC", (case_id,))
    ]


def _report_pack(conn: sqlite3.Connection, case_id: str) -> dict[str, Any]:
    row = _case_or_404(conn, case_id)
    eligible = row["status"] in ("DECIDED", "FILED")
    pack: dict[str, Any] = {
        "caseId": case_id,
        "status": row["status"],
        "eligible": eligible,
        "blockedReason": None
        if eligible
        else (
            f"Case is {row['status']}. Propose a decision in the case workspace and have a "
            "different reviewer approve it; reports unlock at DECIDED."
        ),
        "pfr": {"content": None, "errors": []},
        "str": {"content": None, "errors": []},
        "fmr": {
            "available": False,
            "todo": "TODO(compliance): the Python repository has no FMR renderer or field specification.",
        },
        "history": _report_history(conn, case_id),
    }
    if not eligible:
        return pack
    try:
        case_object = build_case_object(conn, case_id)
        pfr_text = render_pfr(case_object)
        str_xml = render_str(case_object)
    except Exception as exc:
        pack["blockedReason"] = f"Case object could not be compiled: {exc}"
        return pack
    pack["pfr"] = {"content": pfr_text, "errors": validate_pfr(pfr_text)}
    pack["str"] = {"content": str_xml, "errors": validate_str(str_xml)}
    return pack


@app.get("/api/cases/{case_id}/reports")
def get_reports(case_id: str) -> dict[str, Any]:
    with db() as conn:
        return _report_pack(conn, case_id)


@app.post("/api/cases/{case_id}/reports/{regime}")
def generate_report(case_id: str, regime: str, actor: str = Query("COMPLIANCE_OFFICER")) -> dict[str, Any]:
    regime = regime.upper()
    if regime not in {"PFR", "STR"}:
        raise HTTPException(
            status_code=400,
            detail="Only PFR and STR exist in the source repository. FMR is TODO(compliance).",
        )
    with _WRITE_LOCK, db() as conn:
        row = _case_or_404(conn, case_id)
        if row["status"] not in ("DECIDED", "FILED"):
            raise HTTPException(
                status_code=409,
                detail=f"Case must be DECIDED or FILED before filing (currently {row['status']}).",
            )
        case_object = build_case_object(conn, case_id)
        content = render_pfr(case_object) if regime == "PFR" else render_str(case_object)
        errors = validate_pfr(content) if regime == "PFR" else validate_str(content)
        if errors:
            return {"ok": False, "errors": errors, "history": _report_history(conn, case_id)}
        saved = save_report(conn, case_id, regime, content, actor=actor)
        return {
            "ok": True,
            "errors": [],
            "filename": saved["filename"],
            "sha256": saved["sha256"],
            "history": _report_history(conn, case_id),
        }


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: int) -> FileResponse:
    with db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Report {report_id} not found.")
        path = Path(row["path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="The report file is missing from exports/.")
        media = "text/plain" if row["regime"] == "PFR" else "application/xml"
        return FileResponse(path, filename=path.name, media_type=media)


# ---------------------------------------------------------------------------
# Audit, overview, search, workflow guide
# ---------------------------------------------------------------------------


def _audit_query(
    case_id: str | None,
    action: str | None,
    actor: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if case_id:
        clauses.append("(object_id = ? OR details LIKE ?)")
        params.extend([case_id, f"%{case_id}%"])
    if action:
        clauses.append("action = ?")
        params.append(action)
    if actor:
        clauses.append("actor = ?")
        params.append(actor)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db() as conn:
        rows = conn.execute(
            f"SELECT * FROM audit_log {where} ORDER BY id DESC LIMIT ?",
            tuple(params) + (limit,),
        ).fetchall()
    return [_audit(r) for r in rows]


@app.get("/api/audit")
def audit_log(
    case_id: str | None = None,
    action: str | None = None,
    actor: str | None = None,
    limit: int = Query(500, ge=1, le=5000),
) -> dict[str, Any]:
    with db() as conn:
        actions = [
            {"action": r["action"], "count": int(r["n"])}
            for r in conn.execute("SELECT action, COUNT(*) AS n FROM audit_log GROUP BY action ORDER BY n DESC")
        ]
        actors = [
            {"actor": r["actor"] or "SYSTEM", "count": int(r["n"])}
            for r in conn.execute("SELECT actor, COUNT(*) AS n FROM audit_log GROUP BY actor ORDER BY n DESC")
        ]
    return {
        "items": _audit_query(case_id, action, actor, limit),
        "actions": actions,
        "actors": actors,
    }


@app.get("/api/overview")
def overview() -> dict[str, Any]:
    counts = _counts()
    with db() as conn:
        recent_alerts = [
            _alert(r)
            for r in conn.execute(
                """
                SELECT a.*, ca.case_id
                FROM alerts a LEFT JOIN case_alerts ca ON ca.alert_id = a.alert_id
                ORDER BY a.ts DESC LIMIT 6
                """
            )
        ]
        recent_cases = _case_rows(conn)[:5]
        recent_decisions = [
            _decision(r) for r in conn.execute("SELECT * FROM decisions ORDER BY id DESC LIMIT 5")
        ]
        recent_audit = [_audit(r) for r in conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 5")]
        statuses = {
            r["status"]: int(r["n"]) for r in conn.execute("SELECT status, COUNT(*) AS n FROM cases GROUP BY status")
        }
        severities = {
            r["severity"]: int(r["n"]) for r in conn.execute("SELECT severity, COUNT(*) AS n FROM alerts GROUP BY severity")
        }
        pending = conn.execute("SELECT COUNT(*) FROM decisions WHERE status='PENDING'").fetchone()[0]
        unlinked = conn.execute(
            "SELECT COUNT(*) FROM alerts a LEFT JOIN case_alerts ca ON ca.alert_id=a.alert_id WHERE ca.case_id IS NULL"
        ).fetchone()[0]
    return {
        "counts": counts,
        "loaded": counts["transactions"] > 0 or counts["alerts"] > 0,
        "unlinkedAlerts": int(unlinked),
        "alertSeverities": severities,
        "caseStatuses": statuses,
        "pendingDecisions": int(pending),
        "recentAlerts": recent_alerts,
        "recentCases": recent_cases,
        "recentDecisions": recent_decisions,
        "recentAudit": recent_audit,
    }


@app.get("/api/state")
def workflow_state() -> dict[str, Any]:
    counts = _counts()
    with db() as conn:
        statuses = {
            r["status"]: int(r["n"]) for r in conn.execute("SELECT status, COUNT(*) AS n FROM cases GROUP BY status")
        }
        pending = int(conn.execute("SELECT COUNT(*) FROM decisions WHERE status='PENDING'").fetchone()[0])
        approved = int(conn.execute("SELECT COUNT(*) FROM decisions WHERE status='APPROVED'").fetchone()[0])
        filed = int(conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0])
    loaded = counts["transactions"] > 0 or counts["alerts"] > 0
    active_cases = statuses.get("INVESTIGATING", 0) + statuses.get("DECIDED", 0) + statuses.get("FILED", 0)

    steps = [
        {
            "id": "load",
            "label": "Load sample data",
            "done": loaded,
            "href": "/app/ingest",
            "detail": "Bring the synthetic 5,005-transaction / 300-alert corpus into the database.",
        },
        {
            "id": "ingest",
            "label": "Ingest alerts",
            "done": counts["alerts"] > 0,
            "href": "/app/ingest",
            "detail": "Validate alert rows, reject bad records and deduplicate the batch.",
        },
        {
            "id": "correlate",
            "label": "Correlate alerts",
            "done": counts["cases"] > 0,
            "href": "/app/correlate",
            "detail": "Cluster alerts by shared account, device and beneficiary, then accept a candidate.",
        },
        {
            "id": "investigate",
            "label": "Work the case",
            "done": active_cases > 0,
            "href": "/app/cases",
            "detail": "Move a case through NEW → TRIAGE → INVESTIGATING.",
        },
        {
            "id": "evidence",
            "label": "Seal evidence",
            "done": counts["evidence"] > 0,
            "href": "/app/evidence",
            "detail": "Attach an artifact and verify the SHA-256 chain.",
        },
        {
            "id": "decide",
            "label": "Propose a decision",
            "done": counts["decisions"] > 0,
            "href": "/app/cases",
            "detail": "Record grounds and a rationale of at least 30 characters.",
        },
        {
            "id": "approve",
            "label": "Approve as checker",
            "done": approved > 0,
            "href": "/app/cases",
            "detail": "A different user must approve the pending decision.",
        },
        {
            "id": "report",
            "label": "Generate a filing",
            "done": filed > 0,
            "href": "/app/reports",
            "detail": "Render and register the PFR or STR after the case reaches DECIDED.",
        },
    ]

    next_step: dict[str, Any]
    if not loaded:
        next_step = {
            "id": "load",
            "title": "Load the sample dataset",
            "description": "Nothing is preloaded. Bring in the synthetic transactions and alerts to start the workflow.",
            "href": "/app/ingest",
            "action": "Load sample data",
        }
    elif counts["alerts"] == 0:
        next_step = {
            "id": "ingest",
            "title": "Ingest alerts",
            "description": "Transactions are present. Add the alert feed so correlation has something to cluster.",
            "href": "/app/ingest",
            "action": "Open ingest",
        }
    elif counts["cases"] == 0:
        next_step = {
            "id": "correlate",
            "title": "Run correlation",
            "description": "Alerts are loaded but no case exists yet. Run the correlator and accept a candidate.",
            "href": "/app/correlate",
            "action": "Open correlate",
        }
    elif active_cases == 0:
        next_step = {
            "id": "investigate",
            "title": "Advance a case",
            "description": "A case exists but is still in triage. Move it to INVESTIGATING to begin the review.",
            "href": "/app/cases",
            "action": "Open cases",
        }
    elif counts["evidence"] == 0:
        next_step = {
            "id": "evidence",
            "title": "Seal the first evidence item",
            "description": "Attach the sample evidence note to the case, then run chain verification.",
            "href": "/app/evidence",
            "action": "Open evidence",
        }
    elif counts["decisions"] == 0:
        next_step = {
            "id": "decide",
            "title": "Propose a decision",
            "description": "Record the grounds and rationale. The case must be INVESTIGATING.",
            "href": "/app/cases",
            "action": "Open case",
        }
    elif pending == 0 and approved == 0:
        next_step = {
            "id": "decide",
            "title": "Review the decision",
            "description": "A decision exists. Approve or reject it with a different user name.",
            "href": "/app/cases",
            "action": "Open case",
        }
    elif pending > 0:
        next_step = {
            "id": "approve",
            "title": "Approve the pending decision",
            "description": "Maker-checker requires a reviewer whose name differs from the maker.",
            "href": "/app/cases",
            "action": "Open case",
        }
    elif counts["reports"] == 0:
        next_step = {
            "id": "report",
            "title": "Generate a regulatory filing",
            "description": "The case is decided. Preview, validate and register the PFR or STR.",
            "href": "/app/reports",
            "action": "Open reports",
        }
    elif statuses.get("FILED", 0) == 0:
        next_step = {
            "id": "file",
            "title": "Mark the case as filed",
            "description": "Reports are saved. Sign off the case to complete the workflow.",
            "href": "/app/reports",
            "action": "Open reports",
        }
    else:
        next_step = {
            "id": "done",
            "title": "Workflow complete",
            "description": "A case has been investigated, approved and filed. Reset the dataset to run it again.",
            "href": "/app",
            "action": "Review cases",
        }
    return {"counts": counts, "loaded": loaded, "statuses": statuses, "pendingDecisions": pending, "steps": steps, "nextStep": next_step}


@app.get("/api/search")
def search(q: str = "") -> list[dict[str, Any]]:
    term = q.strip()
    results: list[dict[str, Any]] = []
    with db() as conn:
        if term:
            like = f"%{term}%"
            for row in conn.execute(
                "SELECT case_id, title, status FROM cases WHERE case_id LIKE ? OR title LIKE ? LIMIT 5",
                (like, like),
            ):
                results.append(
                    {"id": row["case_id"], "type": "case", "label": row["case_id"], "sublabel": row["title"], "href": f"/app/cases/{row['case_id']}"}
                )
            for row in conn.execute(
                "SELECT alert_id, account_id, rule FROM alerts WHERE alert_id LIKE ? OR account_id LIKE ? OR rule LIKE ? LIMIT 5",
                (like, like, like),
            ):
                results.append(
                    {"id": row["alert_id"], "type": "alert", "label": row["alert_id"], "sublabel": f"{row['account_id']} · {row['rule']}", "href": "/app/ingest"}
                )
            for row in conn.execute(
                "SELECT id, case_id, file_hash FROM evidence WHERE file_hash LIKE ? LIMIT 5", (like,)
            ):
                results.append(
                    {"id": str(row["id"]), "type": "hash", "label": f"Evidence #{row['id']}", "sublabel": row["file_hash"][:32] + "…", "href": f"/app/evidence?case={row['case_id']}"}
                )
        else:
            for row in conn.execute("SELECT case_id, title FROM cases ORDER BY created_at DESC LIMIT 4"):
                results.append({"id": row["case_id"], "type": "case", "label": row["case_id"], "sublabel": row["title"], "href": f"/app/cases/{row['case_id']}"})
            for row in conn.execute("SELECT alert_id, account_id FROM alerts ORDER BY ts DESC LIMIT 4"):
                results.append({"id": row["alert_id"], "type": "alert", "label": row["alert_id"], "sublabel": row["account_id"], "href": "/app/ingest"})
    return results[:12]


@app.on_event("startup")
def startup() -> None:
    """Create the schema, then clear any data left by a previous session.

    The demo intentionally starts from the delivered empty state every time the
    API boots, so reopening the project never shows a half-worked dataset. The
    sample corpus is only loaded when the user clicks Load sample data (or calls
    POST /api/dataset/load).
    """
    ensure_db()
    _reset_dataset()
