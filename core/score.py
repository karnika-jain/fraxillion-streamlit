"""Runtime ML Risk Scoring for Fraxillion (Segment 3).

Loads pre-trained offline models (trained on 50k transactions) from models/
and scores unseen demo cases stored in SQLite (fraxillion.db).

Handshake contract for teammate integration:
    score_case(case_id: str) -> dict
        Returns {"score": float, "reasons": list[str], "model": str}
"""

from __future__ import annotations

import json
import sqlite3
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from core.features import FEATURE_COLUMNS, build_features

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = PROJECT_ROOT / "models"
DEFAULT_DB_PATH = PROJECT_ROOT / "fraxillion.db"


@lru_cache(maxsize=1)
def load_eval_metrics() -> dict[str, Any]:
    """Load offline 50k training/testing metrics and feature importances."""
    metrics_path = MODELS_DIR / "eval_metrics.json"
    if not metrics_path.exists():
        raise FileNotFoundError(
            f"Missing {metrics_path}. Run scripts/train_models.py first."
        )
    with open(metrics_path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=2)
def load_model(model_name: str = "RandomForest") -> Any:
    """Load a pre-trained joblib model once and cache it in memory."""
    filename = "rf_model.joblib" if model_name == "RandomForest" else "lr_model.joblib"
    model_path = MODELS_DIR / filename
    if not model_path.exists():
        raise FileNotFoundError(
            f"Missing {model_path}. Run scripts/train_models.py first."
        )
    return joblib.load(model_path)


def _get_connection(
    db_path: str | Path | None = None,
    conn: sqlite3.Connection | None = None,
) -> tuple[sqlite3.Connection, bool]:
    """Return an active SQLite connection and whether caller owns closing it."""
    if conn is not None:
        return conn, False
    target = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
    c = sqlite3.connect(str(target), check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c, True


def explain_transaction_row(
    row: pd.Series,
    importances: dict[str, float],
    top_k: int = 5,
) -> list[str]:
    """Build concise, human-readable reasons for a scored transaction row."""
    candidates: list[tuple[float, str]] = []

    benef_24h = int(row.get("distinct_beneficiaries_24h", 0))
    if benef_24h >= 4:
        candidates.append(
            (importances.get("distinct_beneficiaries_24h", 0.2) * 3.0,
             f"High fan-out: {benef_24h} distinct beneficiaries in 24h")
        )

    if int(row.get("is_night", 0)) == 1:
        hr = int(row.get("hour", 0))
        candidates.append(
            (importances.get("is_night", 0.15) * 2.5,
             f"Night-window activity ({hr:02d}:00 hrs)")
        )

    dev_shared = int(row.get("device_shared_count", 1))
    if dev_shared >= 2:
        candidates.append(
            (importances.get("device_shared_count", 0.2) * 2.5,
             f"Shared device used by {dev_shared} accounts")
        )

    ratio = float(row.get("in_out_ratio_24h", 0.0))
    if 0.75 <= ratio <= 1.25:
        candidates.append(
            (importances.get("in_out_ratio_24h", 0.15) * 2.2,
             f"Pass-through flow: {ratio * 100:.0f}% of 24h inflow moved out")
        )

    txn_24h = int(row.get("txn_count_24h", 0))
    if txn_24h >= 4:
        candidates.append(
            (importances.get("txn_count_24h", 0.15) * 2.0,
             f"Burst velocity: {txn_24h} outbound txns in 24h")
        )

    if int(row.get("is_new_beneficiary", 0)) == 1:
        candidates.append(
            (importances.get("is_new_beneficiary", 0.1) * 1.5,
             "First-time transfer to new beneficiary")
        )

    if int(row.get("amount_round", 0)) == 1:
        candidates.append(
            (importances.get("amount_round", 0.05) * 1.3,
             f"Round-amount transfer (INR {float(row.get('amount', 0)):,.0f})")
        )

    # Sort triggered signals by importance weight descending
    candidates.sort(key=lambda x: x[0], reverse=True)
    reasons = [msg for _, msg in candidates[:top_k]]

    # Fill up to top_k with highest-importance raw feature values if few signals fired
    if len(reasons) < top_k:
        for feat, imp in sorted(importances.items(), key=lambda kv: kv[1], reverse=True):
            if len(reasons) >= top_k:
                break
            val = row.get(feat, 0)
            entry = f"{feat} = {val:.2f}" if isinstance(val, float) else f"{feat} = {val}"
            if not any(feat in r for r in reasons):
                reasons.append(f"{entry} (model weight {imp:.2f})")

    return reasons[:top_k]


def score_transactions(
    txns_df: pd.DataFrame,
    model_name: str = "RandomForest",
) -> pd.DataFrame:
    """Compute features and attach predicted fraud probability (`risk_score`)."""
    if txns_df.empty:
        out = txns_df.copy()
        out["risk_score"] = pd.Series(dtype=float)
        return out

    feat_df = build_features(txns_df)
    model = load_model(model_name)
    probs = model.predict_proba(feat_df[FEATURE_COLUMNS])[:, 1]
    feat_df["risk_score"] = np.round(probs.astype(float), 4)
    return feat_df


def score_case(
    case_id: str,
    model_name: str = "RandomForest",
    db_path: str | Path | None = None,
    conn: sqlite3.Connection | None = None,
) -> dict[str, Any]:
    """Score a case from SQLite and return risk score + explainability reasons.

    Exact handshake contract:
        {"score": float, "reasons": list[str], "model": str}
    """
    c, should_close = _get_connection(db_path=db_path, conn=conn)
    try:
        # 1. Resolve alerts & transactions belonging to this case
        alert_rows = c.execute(
            """
            SELECT a.txn_id, a.account_id
            FROM case_alerts ca
            JOIN alerts a ON ca.alert_id = a.alert_id
            WHERE ca.case_id = ?
            """,
            (case_id,),
        ).fetchall()

        if not alert_rows:
            return {
                "score": 0.0,
                "reasons": ["No alerts linked to this case yet."],
                "model": model_name,
            }

        case_txn_ids = {r["txn_id"] for r in alert_rows if r["txn_id"]}
        case_accounts = {r["account_id"] for r in alert_rows if r["account_id"]}

        # 2. Load transactions so rolling 24h & device sharing context is accurate
        txns_df = pd.read_sql_query("SELECT * FROM transactions", c)
        if txns_df.empty:
            return {
                "score": 0.0,
                "reasons": ["No transactions found in database."],
                "model": model_name,
            }

        scored_df = score_transactions(txns_df, model_name=model_name)

        # Match case transactions by txn_id first; fallback to subject accounts
        mask = scored_df["txn_id"].isin(case_txn_ids)
        if not mask.any() and case_accounts:
            mask = scored_df["from_account"].isin(case_accounts) | scored_df["to_account"].isin(
                case_accounts
            )

        case_txns = scored_df.loc[mask]
        if case_txns.empty:
            return {
                "score": 0.0,
                "reasons": ["Case alerts did not match any stored transactions."],
                "model": model_name,
            }

        # Peak transaction risk within the case drives case severity
        peak_idx = case_txns["risk_score"].idxmax()
        peak_row = case_txns.loc[peak_idx]
        peak_score = float(peak_row["risk_score"])

        metrics = load_eval_metrics()
        importances = metrics.get("feature_importances", {})
        reasons = explain_transaction_row(peak_row, importances, top_k=5)

        return {
            "score": round(peak_score, 4),
            "reasons": reasons,
            "model": model_name,
        }
    finally:
        if should_close:
            c.close()
