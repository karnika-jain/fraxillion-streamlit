"""Synthetic UPI Data Generator for Fraxillion Prototype.

Generates reproducible synthetic transactions, alerts, and dirty alerts
for testing ingestion, correlation, and fraud investigation workflows.
Follows Section 4 and Appendix A of the build plan.
"""

from datetime import datetime, timedelta
from pathlib import Path
import random
import pandas as pd

# Set fixed seed for deterministic, reproducible generation
random.seed(42)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# Configuration constants
START_DATE = datetime(2026, 11, 1, 9, 0, 0)
NUM_TOTAL_TXNS = 5000
NUM_ALERTS = 300
HUB_VPA = "shop@okaxis"
SHARED_DEVICE_ID = "D0099"

CITIES = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Hyderabad", "Chennai"]


def generate_dataset():
    # -------------------------------------------------------------
    # 1. GENERATE TRANSACTIONS (~5,000 rows)
    # -------------------------------------------------------------
    txns = []
    txn_counter = 1

    # Normal accounts: A0001 - A0180
    # Mule accounts:   A0181 - A0200 (20 accounts)
    normal_accounts = [f"A{i:04d}" for i in range(1, 181)]
    mule_accounts = [f"A{i:04d}" for i in range(181, 201)]
    devices = [f"D{i:04d}" for i in range(1, 121) if f"D{i:04d}" != SHARED_DEVICE_ID]

    # A. Hub normal transactions (35 transactions to shop@okaxis so alerts can sample >=28)
    for i in range(35):
        day_offset = random.randint(0, 29)
        hour = random.randint(10, 20)
        minute = random.randint(0, 59)
        ts = START_DATE + timedelta(days=day_offset, hours=hour, minutes=minute)
        sender = random.choice(normal_accounts)
        txns.append({
            "txn_id": f"T{txn_counter:06d}",
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": sender,
            "to_account": "A0001",
            "to_vpa": HUB_VPA,
            "amount": round(random.uniform(100, 2500), 2),
            "channel": "UPI",
            "device_id": random.choice(devices),
            "city": random.choice(CITIES),
            "is_fraud": 0,
        })
        txn_counter += 1

    # B. Remaining normal transactions (total normal = ~4,910)
    num_normal_remaining = 4880
    for _ in range(num_normal_remaining):
        day_offset = random.randint(0, 29)
        # 90% daytime (08:00 - 22:00), 10% night
        if random.random() < 0.90:
            hour = random.randint(8, 21)
        else:
            hour = random.choice([22, 23, 0, 1, 2, 3, 4, 5, 6, 7])
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        ts = START_DATE + timedelta(days=day_offset, hours=hour, minutes=minute, seconds=second)

        sender = random.choice(normal_accounts)
        receiver = random.choice([a for a in normal_accounts if a != sender])
        to_vpa = f"user_{receiver.lower()}@okaxis"

        txns.append({
            "txn_id": f"T{txn_counter:06d}",
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": sender,
            "to_account": receiver,
            "to_vpa": to_vpa,
            "amount": round(random.uniform(50, 5000), 2),
            "channel": "UPI",
            "device_id": random.choice(devices),
            "city": random.choice(CITIES),
            "is_fraud": 0,
        })
        txn_counter += 1

    # C. Injected Fraud Pattern 1: Mule Fan-Out Rings (3 rings)
    # Ring 1: mule A0181 on Nov 9 at night
    # Ring 2: mule A0182 on Nov 14 at night
    # Ring 3: mule A0183 on Nov 22 at night
    fraud_txns_by_pattern = {
        "fan_out": [],
        "pass_through": [],
        "fan_in": [],
        "shared_device": [],
    }

    mule_ring_configs = [
        ("A0181", datetime(2026, 11, 9, 23, 20, 0)),
        ("A0182", datetime(2026, 11, 14, 23, 15, 0)),
        ("A0183", datetime(2026, 11, 22, 23, 30, 0)),
    ]

    for ring_idx, (mule, base_time) in enumerate(mule_ring_configs):
        # 10 inflow credits to the mule
        for k in range(10):
            sender = normal_accounts[k + ring_idx * 10]
            inflow_ts = base_time + timedelta(minutes=k * 2)
            t_obj = {
                "txn_id": f"T{txn_counter:06d}",
                "ts": inflow_ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "from_account": sender,
                "to_account": mule,
                "to_vpa": f"mule_{mule.lower()}@okhdfcbank",
                "amount": round(random.uniform(9000, 11000), 2),
                "channel": "UPI",
                "device_id": f"D{random.randint(100, 120):04d}",
                "city": "Mumbai",
                "is_fraud": 1,
            }
            txns.append(t_obj)
            fraud_txns_by_pattern["fan_out"].append(t_obj)
            txn_counter += 1

        # 8 rapid outbound fan-out transactions within 40 minutes
        outflow_start = base_time + timedelta(minutes=25)
        for j in range(8):
            target = f"A{150 + j + ring_idx * 8:04d}"
            out_ts = outflow_start + timedelta(minutes=j * 4)
            t_obj = {
                "txn_id": f"T{txn_counter:06d}",
                "ts": out_ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "from_account": mule,
                "to_account": target,
                "to_vpa": f"benef_{j}_ring{ring_idx}@okhdfcbank",
                "amount": round(random.uniform(8500, 12500), 2),
                "channel": "UPI",
                "device_id": f"D008{ring_idx}",
                "city": "Mumbai",
                "is_fraud": 1,
            }
            txns.append(t_obj)
            fraud_txns_by_pattern["fan_out"].append(t_obj)
            txn_counter += 1

    # D. Injected Fraud Pattern 2: Pass-Through
    # Account A0184 receives Rs 2,00,000, sends 92% out within 2 hours
    pt_base = datetime(2026, 11, 16, 14, 0, 0)
    inflow_pt = {
        "txn_id": f"T{txn_counter:06d}",
        "ts": pt_base.strftime("%Y-%m-%dT%H:%M:%S"),
        "from_account": "A0045",
        "to_account": "A0184",
        "to_vpa": "pt_mule@okaxis",
        "amount": 200000.00,
        "channel": "UPI",
        "device_id": "D0077",
        "city": "Delhi",
        "is_fraud": 1,
    }
    txns.append(inflow_pt)
    fraud_txns_by_pattern["pass_through"].append(inflow_pt)
    txn_counter += 1

    # Send 92% (Rs 1,84,000) across 2 outbound transfers within 90 minutes
    outflow_pt1 = {
        "txn_id": f"T{txn_counter:06d}",
        "ts": (pt_base + timedelta(minutes=45)).strftime("%Y-%m-%dT%H:%M:%S"),
        "from_account": "A0184",
        "to_account": "A0185",
        "to_vpa": "layer1@okicici",
        "amount": 92000.00,
        "channel": "UPI",
        "device_id": "D0077",
        "city": "Delhi",
        "is_fraud": 1,
    }
    outflow_pt2 = {
        "txn_id": f"T{txn_counter + 1:06d}",
        "ts": (pt_base + timedelta(minutes=85)).strftime("%Y-%m-%dT%H:%M:%S"),
        "from_account": "A0184",
        "to_account": "A0186",
        "to_vpa": "layer2@okicici",
        "amount": 92000.00,
        "channel": "UPI",
        "device_id": "D0077",
        "city": "Delhi",
        "is_fraud": 1,
    }
    txns.extend([outflow_pt1, outflow_pt2])
    fraud_txns_by_pattern["pass_through"].extend([outflow_pt1, outflow_pt2])
    txn_counter += 2

    # E. Injected Fraud Pattern 3: Fan-In
    # 12 accounts send small amounts to A0187 on same day
    fi_base = datetime(2026, 11, 18, 10, 0, 0)
    for idx in range(12):
        fi_ts = fi_base + timedelta(minutes=idx * 25)
        sender = f"A00{70 + idx:02d}"
        t_obj = {
            "txn_id": f"T{txn_counter:06d}",
            "ts": fi_ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": sender,
            "to_account": "A0187",
            "to_vpa": "collector@okaxis",
            "amount": round(random.uniform(1800, 3200), 2),
            "channel": "UPI",
            "device_id": f"D{random.randint(10, 50):04d}",
            "city": "Bengaluru",
            "is_fraud": 1,
        }
        txns.append(t_obj)
        fraud_txns_by_pattern["fan_in"].append(t_obj)
        txn_counter += 1

    # F. Injected Fraud Pattern 4: Shared Device (D0099 used by 3 mule accounts)
    shared_mules = ["A0188", "A0189", "A0190"]
    sd_base = datetime(2026, 11, 20, 11, 0, 0)
    for m_idx, mule in enumerate(shared_mules):
        for t_k in range(3):
            sd_ts = sd_base + timedelta(hours=m_idx * 2, minutes=t_k * 15)
            t_obj = {
                "txn_id": f"T{txn_counter:06d}",
                "ts": sd_ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "from_account": mule,
                "to_account": f"A01{10 + t_k:02d}",
                "to_vpa": f"cashout_{m_idx}_{t_k}@okaxis",
                "amount": round(random.uniform(7000, 9500), 2),
                "channel": "UPI",
                "device_id": SHARED_DEVICE_ID,
                "city": "Pune",
                "is_fraud": 1,
            }
            txns.append(t_obj)
            fraud_txns_by_pattern["shared_device"].append(t_obj)
            txn_counter += 1

    # Convert transactions to DataFrame and sort by timestamp
    df_txns = pd.DataFrame(txns)
    df_txns = df_txns.sort_values("ts").reset_index(drop=True)
    # Reassign clean sequential txn_ids
    df_txns["txn_id"] = [f"T{i+1:06d}" for i in range(len(df_txns))]

    # -------------------------------------------------------------
    # 2. GENERATE ALERTS (exactly 300 rows)
    # -------------------------------------------------------------
    # 60 fraud alerts + 240 normal alerts (including >=28 hub alerts)
    alerts = []
    alert_counter = 1

    fraud_df = df_txns[df_txns["is_fraud"] == 1].copy()
    normal_df = df_txns[df_txns["is_fraud"] == 0].copy()

    # Sample exactly 60 fraud alerts covering all injected typologies:
    # - Mule Ring 1 (A0181): 6 alerts
    # - Mule Ring 2 (A0182): 6 alerts
    # - Mule Ring 3 (A0183): 6 alerts
    # - Pass-Through (A0184): 3 alerts
    # - Fan-In (collector@okaxis): 8 alerts
    # - Shared Device (D0099): 6 alerts
    # - Other fraud txns: 25 alerts
    ring1_txns = fraud_df[fraud_df["from_account"] == "A0181"].head(6)
    ring2_txns = fraud_df[fraud_df["from_account"] == "A0182"].head(6)
    ring3_txns = fraud_df[fraud_df["from_account"] == "A0183"].head(6)
    pt_txns = fraud_df[fraud_df["from_account"] == "A0184"].head(3)
    fi_txns = fraud_df[fraud_df["to_account"] == "A0187"].head(8)
    sd_txns = fraud_df[fraud_df["device_id"] == SHARED_DEVICE_ID].head(6)

    used_txn_ids = set(pd.concat([ring1_txns, ring2_txns, ring3_txns, pt_txns, fi_txns, sd_txns])["txn_id"])
    remaining_fraud_txns = fraud_df[~fraud_df["txn_id"].isin(used_txn_ids)].sample(n=25, random_state=42)

    fraud_sample = pd.concat([ring1_txns, ring2_txns, ring3_txns, pt_txns, fi_txns, sd_txns, remaining_fraud_txns])

    for _, row in fraud_sample.iterrows():
        txn_ts = datetime.fromisoformat(row["ts"])
        alert_ts = txn_ts + timedelta(minutes=random.randint(1, 4), seconds=random.randint(0, 50))

        if row["device_id"] == SHARED_DEVICE_ID:
            rule = "SHARED_DEVICE"
            score = round(random.uniform(0.85, 0.95), 2)
            reason = "Multiple mule accounts active on device D0099"
            severity = "HIGH"
        elif row["amount"] > 50000:
            rule = "PASS_THROUGH_90PCT"
            score = round(random.uniform(0.88, 0.98), 2)
            reason = "Large credit immediately followed by rapid pass-through"
            severity = "HIGH"
        elif row["to_account"] == "A0187":
            rule = "FAN_IN_10_IN_24H"
            score = round(random.uniform(0.72, 0.86), 2)
            reason = "Multiple distinct senders funneled to single account"
            severity = "MEDIUM"
        else:
            rule = "FAN_OUT_5_IN_10MIN"
            score = round(random.uniform(0.89, 0.99), 2)
            reason = "Rapid consecutive transfers to new beneficiaries at night"
            severity = "HIGH"

        alerts.append({
            "alert_id": f"AL{alert_counter:04d}",
            "txn_id": row["txn_id"],
            "account_id": row["from_account"],
            "device_id": row["device_id"],
            "to_vpa": row["to_vpa"],
            "rule": rule,
            "severity": severity,
            "score": score,
            "reason": reason,
            "ts": alert_ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "is_fraud": 1,
        })
        alert_counter += 1

    # 240 normal alerts:
    # First: include 28 alerts on the hub VPA (shop@okaxis)
    hub_txns = normal_df[normal_df["to_vpa"] == HUB_VPA]
    hub_sample = hub_txns.head(28)
    for _, row in hub_sample.iterrows():
        txn_ts = datetime.fromisoformat(row["ts"])
        alert_ts = txn_ts + timedelta(minutes=random.randint(1, 5))
        alerts.append({
            "alert_id": f"AL{alert_counter:04d}",
            "txn_id": row["txn_id"],
            "account_id": row["from_account"],
            "device_id": row["device_id"],
            "to_vpa": row["to_vpa"],
            "rule": "NEW_BENEFICIARY",
            "severity": "LOW",
            "score": round(random.uniform(0.30, 0.45), 2),
            "reason": "First-time payment to merchant handle",
            "ts": alert_ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "is_fraud": 0,
        })
        alert_counter += 1

    # Remaining normal alerts (240 - 28 = 212)
    non_hub_normal_txns = normal_df[normal_df["to_vpa"] != HUB_VPA]
    normal_sample = non_hub_normal_txns.sample(n=212, random_state=42)

    for _, row in normal_sample.iterrows():
        txn_ts = datetime.fromisoformat(row["ts"])
        alert_ts = txn_ts + timedelta(minutes=random.randint(1, 5))
        if row["amount"] > 3500:
            rule = "HIGH_VALUE"
            score = round(random.uniform(0.50, 0.68), 2)
            severity = "MEDIUM"
            reason = "Transfer amount above 30-day user average"
        else:
            rule = "NEW_BENEFICIARY"
            score = round(random.uniform(0.30, 0.58), 2)
            severity = "LOW"
            reason = "First transfer to beneficiary"

        alerts.append({
            "alert_id": f"AL{alert_counter:04d}",
            "txn_id": row["txn_id"],
            "account_id": row["from_account"],
            "device_id": row["device_id"],
            "to_vpa": row["to_vpa"],
            "rule": rule,
            "severity": severity,
            "score": score,
            "reason": reason,
            "ts": alert_ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "is_fraud": 0,
        })
        alert_counter += 1

    df_alerts = pd.DataFrame(alerts)
    df_alerts = df_alerts.sort_values("ts").reset_index(drop=True)
    df_alerts["alert_id"] = [f"AL{i+1:04d}" for i in range(len(df_alerts))]

    # -------------------------------------------------------------
    # 3. GENERATE DIRTY ALERTS (~25 rows) FOR REJECTED ROWS DEMO
    # -------------------------------------------------------------
    # Take a sample of 25 rows and inject specific errors:
    dirty_sample = df_alerts.sample(n=25, random_state=99).copy().reset_index(drop=True)

    # 3 rows with score > 1 or negative
    dirty_sample.loc[0, "score"] = 1.45
    dirty_sample.loc[1, "score"] = -0.25
    dirty_sample.loc[2, "score"] = 2.05

    # 2 rows with invalid timestamp
    dirty_sample.loc[3, "ts"] = "INVALID_TIMESTAMP"
    dirty_sample.loc[4, "ts"] = "2026-99-99 25:00:00"

    # 2 rows missing alert_id
    dirty_sample.loc[5, "alert_id"] = ""
    dirty_sample.loc[6, "alert_id"] = ""

    # 5 rows are exact duplicates of clean alerts (rows 7 to 11 remain identical to df_alerts rows)
    # The remaining 13 rows are valid alerts from df_alerts

    # -------------------------------------------------------------
    # 4. SAVE TO CSV
    # -------------------------------------------------------------
    txns_path = DATA_DIR / "synthetic_transactions.csv"
    alerts_path = DATA_DIR / "synthetic_alerts.csv"
    dirty_path = DATA_DIR / "synthetic_alerts_dirty.csv"

    df_txns.to_csv(txns_path, index=False)
    df_alerts.to_csv(alerts_path, index=False)
    dirty_sample.to_csv(dirty_path, index=False)

    # -------------------------------------------------------------
    # 5. PRINT SUMMARY
    # -------------------------------------------------------------
    hub_count = (df_alerts["to_vpa"] == HUB_VPA).sum()
    print("=" * 60)
    print("FRAXILLION SYNTHETIC DATA GENERATION COMPLETE")
    print("=" * 60)
    print(f"Total Transactions : {len(df_txns):,}")
    print(f"  - Fraud Txns     : {(df_txns['is_fraud'] == 1).sum():,}")
    print(f"  - Normal Txns    : {(df_txns['is_fraud'] == 0).sum():,}")
    print(f"Total Alerts       : {len(df_alerts):,}")
    print(f"  - Fraud Alerts   : {(df_alerts['is_fraud'] == 1).sum():,}")
    print(f"  - Normal Alerts  : {(df_alerts['is_fraud'] == 0).sum():,}")
    print(f"Hub '{HUB_VPA}' alerts count : {hub_count} (exceeds threshold 25)")
    print(f"Dirty Alerts File  : {len(dirty_sample)} rows")
    print(f"Saved files in     : {DATA_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    generate_dataset()
