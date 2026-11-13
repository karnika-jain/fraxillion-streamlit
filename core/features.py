"""Feature engineering for Fraxillion ML Risk Assessment (Segment 3).

Shared identically between offline 50k training (scripts/train_models.py)
and live scoring on the 5k demo database (core/score.py) to prevent
training-serving skew and target leakage.
"""

from __future__ import annotations

from collections import Counter, defaultdict, deque
from typing import Final

import numpy as np
import pandas as pd

FEATURE_COLUMNS: Final[list[str]] = [
    "amount",
    "hour",
    "is_night",
    "txn_count_24h",
    "distinct_beneficiaries_24h",
    "account_age_days",
    "is_new_beneficiary",
    "device_shared_count",
    "amount_round",
    "in_out_ratio_24h",
]

WINDOW_24H_SECONDS: Final[float] = 24.0 * 3600.0


def build_features(txns: pd.DataFrame) -> pd.DataFrame:
    """Compute the 10 tabular fraud features for each transaction row.

    Rows are processed chronologically to ensure no future-looking target
    leakage in rolling velocities, account age, or first-time beneficiary flags.
    The returned DataFrame preserves the input index and original columns,
    with all columns in ``FEATURE_COLUMNS`` populated as finite floats/ints.
    """
    if txns.empty:
        out = txns.copy()
        for col in FEATURE_COLUMNS:
            out[col] = pd.Series(dtype=float)
        return out

    df = txns.copy()
    df["_orig_idx"] = np.arange(len(df))

    # Parse timestamps safely and compute calendar / amount primitives
    parsed_ts = pd.to_datetime(df["ts"], errors="coerce")
    if getattr(parsed_ts.dt, "tz", None) is not None:
        parsed_ts = parsed_ts.dt.tz_localize(None)
    df["_ts_parsed"] = parsed_ts
    if df["_ts_parsed"].isna().any():
        # Fallback for any malformed timestamp so inference does not crash
        fallback_ts = df["_ts_parsed"].dropna().min()
        if pd.isna(fallback_ts):
            fallback_ts = pd.Timestamp("2026-11-01 00:00:00")
        df["_ts_parsed"] = df["_ts_parsed"].fillna(fallback_ts)

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0).astype(float)
    df["hour"] = df["_ts_parsed"].dt.hour.astype(int)
    df["is_night"] = ((df["hour"] >= 23) | (df["hour"] <= 5)).astype(int)
    df["amount_round"] = ((df["amount"] > 0) & (df["amount"] % 1000 == 0)).astype(int)

    # Sort chronologically for online rolling windows (no future leakage)
    sort_cols = ["_ts_parsed", "txn_id"] if "txn_id" in df.columns else ["_ts_parsed"]
    df = df.sort_values(sort_cols, kind="mergesort").reset_index(drop=True)

    # Shared device count across distinct sender accounts
    if "device_id" in df.columns:
        dev_series = df["device_id"].fillna("").astype(str).str.strip()
        df["_dev_clean"] = dev_series
        non_empty = df["_dev_clean"] != ""
        dev_counts = (
            df.loc[non_empty]
            .groupby("_dev_clean")["from_account"]
            .transform("nunique")
        )
        df["device_shared_count"] = 1
        df.loc[non_empty, "device_shared_count"] = dev_counts.astype(int)
    else:
        df["device_shared_count"] = 1

    # Convert timestamps to epoch seconds (explicit [s] unit works in pandas 2.x and 3.x)
    ts_sec = df["_ts_parsed"].astype("datetime64[s]").astype("int64").to_numpy()
    from_accts = df["from_account"].fillna("").astype(str).to_numpy()
    to_accts = df["to_account"].fillna("").astype(str).to_numpy()
    amounts = df["amount"].to_numpy()

    n = len(df)
    txn_count_24h = np.zeros(n, dtype=int)
    distinct_benef_24h = np.zeros(n, dtype=int)
    account_age_days = np.zeros(n, dtype=float)
    is_new_beneficiary = np.zeros(n, dtype=int)
    in_out_ratio_24h = np.zeros(n, dtype=float)

    # State per account updated strictly chronologically
    out_window: dict[str, deque[tuple[int, str, float]]] = defaultdict(deque)
    out_benef_counts: dict[str, Counter[str]] = defaultdict(Counter)
    out_sum_24h: dict[str, float] = defaultdict(float)

    in_window: dict[str, deque[tuple[int, float]]] = defaultdict(deque)
    in_sum_24h: dict[str, float] = defaultdict(float)

    first_seen: dict[str, int] = {}
    seen_pairs: set[tuple[str, str]] = set()

    for i in range(n):
        t = int(ts_sec[i])
        cutoff = t - WINDOW_24H_SECONDS
        src = from_accts[i]
        dst = to_accts[i]
        amt = float(amounts[i])

        # 1. Account age since first appearance (as sender or receiver)
        if src not in first_seen:
            first_seen[src] = t
        if dst not in first_seen:
            first_seen[dst] = t
        account_age_days[i] = max(0.0, (t - first_seen[src]) / 86400.0)

        # 2. First-time beneficiary flag
        pair = (src, dst)
        if pair not in seen_pairs:
            is_new_beneficiary[i] = 1
            seen_pairs.add(pair)

        # 3. Evict expired outbound events for sender (>24h old)
        q_out = out_window[src]
        b_counts = out_benef_counts[src]
        while q_out and q_out[0][0] < cutoff:
            _, old_dst, old_amt = q_out.popleft()
            out_sum_24h[src] -= old_amt
            b_counts[old_dst] -= 1
            if b_counts[old_dst] <= 0:
                del b_counts[old_dst]

        # Record current outbound transaction
        q_out.append((t, dst, amt))
        b_counts[dst] += 1
        out_sum_24h[src] += amt

        txn_count_24h[i] = len(q_out)
        distinct_benef_24h[i] = len(b_counts)

        # 4. Evict expired inbound events for sender (to check 24h inflow)
        q_in_src = in_window[src]
        while q_in_src and q_in_src[0][0] < cutoff:
            _, old_in_amt = q_in_src.popleft()
            in_sum_24h[src] -= old_in_amt

        src_inflow = max(0.0, in_sum_24h[src])
        src_outflow = max(0.0, out_sum_24h[src])
        if src_inflow > 0.0:
            # Cap extreme ratios while keeping pass-through signal (~0.8 - 1.2) clear
            in_out_ratio_24h[i] = round(min(src_outflow / src_inflow, 5.0), 4)
        else:
            in_out_ratio_24h[i] = 0.0

        # 5. Record inflow into receiver for subsequent transactions
        in_window[dst].append((t, amt))
        in_sum_24h[dst] += amt

    df["txn_count_24h"] = txn_count_24h
    df["distinct_beneficiaries_24h"] = distinct_benef_24h
    df["account_age_days"] = np.round(account_age_days, 4)
    df["is_new_beneficiary"] = is_new_beneficiary
    df["in_out_ratio_24h"] = in_out_ratio_24h

    # Restore caller's original row order and drop temporary helper columns
    df = df.sort_values("_orig_idx", kind="mergesort").reset_index(drop=True)
    df = df.drop(columns=[c for c in ["_orig_idx", "_ts_parsed", "_dev_clean"] if c in df.columns])
    df.index = txns.index
    return df
