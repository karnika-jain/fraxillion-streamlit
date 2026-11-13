"""Offline ML model training script for Fraxillion (Segment 3).

Loads the 50,000-row training dataset, extracts the 10 shared features via
core.features.build_features, performs a 70/30 stratified split, trains
Logistic Regression (baseline) and Random Forest (primary), evaluates on the
30% holdout set, and exports models + metrics to models/.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.features import FEATURE_COLUMNS, build_features

DATA_PATH = PROJECT_ROOT / "data" / "train_transactions_50k.csv"
MODELS_DIR = PROJECT_ROOT / "models"


def _eval_model(name: str, model, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    """Compute holdout metrics, confusion matrix, and threshold curve."""
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, preds, labels=[0, 1]).tolist()

    threshold_curve = []
    for thr in [round(0.1 * i, 1) for i in range(1, 10)]:
        p_thr = (probs >= thr).astype(int)
        threshold_curve.append(
            {
                "threshold": thr,
                "precision": round(float(precision_score(y_test, p_thr, zero_division=0)), 4),
                "recall": round(float(recall_score(y_test, p_thr, zero_division=0)), 4),
                "f1": round(float(f1_score(y_test, p_thr, zero_division=0)), 4),
                "flagged_count": int(p_thr.sum()),
            }
        )

    return {
        "name": name,
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "precision": round(float(precision_score(y_test, preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probs)), 4),
        "pr_auc": round(float(average_precision_score(y_test, probs)), 4),
        "confusion_matrix": cm,
        "threshold_curve": threshold_curve,
    }


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Training CSV not found at {DATA_PATH}. Run scripts/generate_train_data.py first."
        )

    t0 = time.perf_counter()
    raw_df = pd.read_csv(DATA_PATH)
    feat_df = build_features(raw_df)

    X = feat_df[FEATURE_COLUMNS]
    y = feat_df["is_fraud"].astype(int)

    # 70% train / 30% test stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=42
    )

    # 1. Baseline: Logistic Regression with StandardScaler
    lr_model = make_pipeline(
        StandardScaler(),
        LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42),
    )
    lr_model.fit(X_train, y_train)

    # 2. Challenger / Primary: Random Forest
    rf_model = RandomForestClassifier(
        n_estimators=300,
        max_depth=14,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=1,
    )
    rf_model.fit(X_train, y_train)

    lr_metrics = _eval_model("LogisticRegression", lr_model, X_test, y_test)
    rf_metrics = _eval_model("RandomForest", rf_model, X_test, y_test)

    importances = {
        feat: round(float(imp), 4)
        for feat, imp in zip(FEATURE_COLUMNS, rf_model.feature_importances_)
    }
    sorted_importances = dict(
        sorted(importances.items(), key=lambda kv: kv[1], reverse=True)
    )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(lr_model, MODELS_DIR / "lr_model.joblib", compress=3)
    joblib.dump(rf_model, MODELS_DIR / "rf_model.joblib", compress=3)

    eval_payload = {
        "dataset": {
            "total_rows": int(len(feat_df)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "fraud_rows_total": int(y.sum()),
            "fraud_rate_pct": round(float(y.mean() * 100.0), 2),
            "split": "70% train / 30% test (stratified)",
        },
        "features": FEATURE_COLUMNS,
        "models": {
            "LogisticRegression": lr_metrics,
            "RandomForest": rf_metrics,
        },
        "feature_importances": sorted_importances,
        "training_seconds": round(time.perf_counter() - t0, 2),
    }

    with open(MODELS_DIR / "eval_metrics.json", "w", encoding="utf-8") as f:
        json.dump(eval_payload, f, indent=2)

    elapsed = eval_payload["training_seconds"]
    print(f"Training completed in {elapsed:.2f}s")
    print(f"Train rows: {len(X_train)} | Test rows: {len(X_test)} | Fraud rate: {eval_payload['dataset']['fraud_rate_pct']}%")
    print("-" * 60)
    for m_name, m in eval_payload["models"].items():
        print(
            f"{m_name:20s} | Prec={m['precision']:.3f} | Rec={m['recall']:.3f} | "
            f"F1={m['f1']:.3f} | ROC-AUC={m['roc_auc']:.3f}"
        )
    print("-" * 60)
    print("Top Feature Importances (Random Forest):")
    for feat, imp in sorted_importances.items():
        print(f"  {feat:28s}: {imp:.4f}")


if __name__ == "__main__":
    main()
