"""Synthetic UPI dataset generator for Fraxillion.

Generates:
1. data/synthetic_transactions.csv (~5,000 rows, UPI transactions across 30 days)
2. data/synthetic_alerts.csv (exactly 300 rows: 60 fraud + 240 normal alerts)
3. data/synthetic_alerts_dirty.csv (25 rows with specific data hygiene errors)
"""

import random
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd

# Fix random seed for exact reproducibility across runs
random.seed(42)

# Directory configuration
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

START_DATE = datetime(2026, 11, 1, 0, 0, 0)
SHARED_DEVICE_ID = "D0099"
HUB_VPA = "shop@okaxis"
CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Pune"]


def generate_dataset():
    # -------------------------------------------------------------
    # 1. GENERATE TRANSACTIONS (~5,000 rows)
    # -------------------------------------------------------------
    txns = []
    txn_counter = 1

    # Accounts:
    # Normal accounts: A0001 - A0170 (170 accounts)
    # Mule accounts:   A0181 - A0200 (20 accounts)
    normal_accounts = [f"A{i:04d}" for i in range(1, 171)]
    normal_devices = {a: f"D{i:04d}" for i, a in enumerate(normal_accounts, 1)}

    # A. Hub normal transactions (35 transactions to shop@okaxis so alerts can sample >=28)
    for i in range(35):
        day_offset = random.randint(0, 29)
        hour = random.randint(10, 20)
        minute = random.randint(0, 59)
        ts = START_DATE + timedelta(days=day_offset, hours=hour, minutes=minute)
        sender = normal_accounts[i % len(normal_accounts)]
        txns.append({
            "txn_id": f"T{txn_counter:06d}",
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": sender,
            "to_account": "A0001",
            "to_vpa": HUB_VPA,
            "amount": round(random.uniform(100, 2500), 2),
            "channel": "UPI",
            "device_id": normal_devices[sender],
            "city": random.choice(CITIES),
            "is_fraud": 0,
        })
        txn_counter += 1

    # B. Remaining normal transactions (~4,880)
    for i in range(4880):
        day_offset = random.randint(0, 29)
        if random.random() < 0.90:
            hour = random.randint(8, 21)
        else:
            hour = random.choice([22, 23, 0, 1, 2, 3, 4, 5, 6, 7])
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        ts = START_DATE + timedelta(days=day_offset, hours=hour, minutes=minute, seconds=second)

        sender = random.choice(normal_accounts)
        rec_idx = (i % 600) + 1
        to_vpa = f"merchant_{rec_idx}@okaxis"

        txns.append({
            "txn_id": f"T{txn_counter:06d}",
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": sender,
            "to_account": f"REC{rec_idx:04d}",
            "to_vpa": to_vpa,
            "amount": round(random.uniform(50, 5000), 2),
            "channel": "UPI",
            "device_id": normal_devices[sender],
            "city": random.choice(CITIES),
            "is_fraud": 0,
        })
        txn_counter += 1

    # C. Injected Fraud Pattern 1: Mule Fan-Out Rings (3 rings)
    # Ring 1: mule A0181 on Nov 9 at night (primary demo ring: 12 rapid outbound alerts, 8 beneficiaries, device D0080)
    # Ring 2: mule A0182 on Nov 14 at night (8 outbound alerts, device D0082)
    # Ring 3: mule A0183 on Nov 22 at night (8 outbound alerts, device D0083)
    fraud_txns = []

    mule_ring_configs = [
        ("A0181", "D0080", datetime(2026, 11, 9, 23, 20, 0), 12),
        ("A0182", "D0082", datetime(2026, 11, 14, 23, 15, 0), 8),
        ("A0183", "D0083", datetime(2026, 11, 22, 23, 30, 0), 8),
    ]

    for ring_idx, (mule, mule_dev, base_time, num_outflows) in enumerate(mule_ring_configs):
        # 10 inflow credits to the mule from dedicated feeder accounts
        for k in range(10):
            sender = f"FDR_{ring_idx}_{k:02d}"
            inflow_ts = base_time + timedelta(minutes=k * 2)
            t_obj = {
                "txn_id": f"T{txn_counter:06d}",
                "ts": inflow_ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "from_account": sender,
                "to_account": mule,
                "to_vpa": f"mule_{mule.lower()}@okhdfcbank",
                "amount": round(random.uniform(9000, 11000), 2),
                "channel": "UPI",
                "device_id": f"D_FDR_{ring_idx}_{k:02d}",
                "city": "Mumbai",
                "is_fraud": 1,
            }
            txns.append(t_obj)
            fraud_txns.append(t_obj)
            txn_counter += 1

        # Rapid outbound fan-out transactions within 40 minutes at night
        # For Ring 1: 12 transactions across 8 distinct beneficiaries
        # For Rings 2 & 3: 8 transactions across 8 distinct beneficiaries
        outflow_start = base_time + timedelta(minutes=25)
        for j in range(num_outflows):
            benef_idx = j % 8  # exactly 8 distinct beneficiaries for Ring 1
            target = f"BENEF_{ring_idx}_{benef_idx:02d}"
            out_ts = outflow_start + timedelta(minutes=j * 3)
            t_obj = {
                "txn_id": f"T{txn_counter:06d}",
                "ts": out_ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "from_account": mule,
                "to_account": target,
                "to_vpa": f"benef_{benef_idx}_ring{ring_idx}@okhdfcbank",
                "amount": round(random.uniform(8500, 12500), 2),
                "channel": "UPI",
                "device_id": mule_dev,
                "city": "Mumbai",
                "is_fraud": 1,
            }
            txns.append(t_obj)
            fraud_txns.append(t_obj)
            txn_counter += 1

    # D. Injected Fraud Pattern 2: Pass-Through
    # Account A0184 receives Rs 2,00,000, sends 92% out within 2 hours
    pt_base = datetime(2026, 11, 16, 14, 0, 0)
    inflow_pt = {
        "txn_id": f"T{txn_counter:06d}",
        "ts": pt_base.strftime("%Y-%m-%dT%H:%M:%S"),
        "from_account": "FEEDER_PT",
        "to_account": "A0184",
        "to_vpa": "pt_mule@okaxis",
        "amount": 200000.00,
        "channel": "UPI",
        "device_id": "D0084",
        "city": "Delhi",
        "is_fraud": 1,
    }
    txns.append(inflow_pt)
    fraud_txns.append(inflow_pt)
    txn_counter += 1

    # Send 92% (Rs 1,84,000) across 2 outbound transfers within 90 minutes
    outflow_pt1 = {
        "txn_id": f"T{txn_counter:06d}",
        "ts": (pt_base + timedelta(minutes=45)).strftime("%Y-%m-%dT%H:%M:%S"),
        "from_account": "A0184",
        "to_account": "BENEF_PT1",
        "to_vpa": "layer1@okicici",
        "amount": 92000.00,
        "channel": "UPI",
        "device_id": "D0084",
        "city": "Delhi",
        "is_fraud": 1,
    }
    outflow_pt2 = {
        "txn_id": f"T{txn_counter + 1:06d}",
        "ts": (pt_base + timedelta(minutes=85)).strftime("%Y-%m-%dT%H:%M:%S"),
        "from_account": "A0184",
        "to_account": "BENEF_PT2",
        "to_vpa": "layer2@okicici",
        "amount": 92000.00,
        "channel": "UPI",
        "device_id": "D0084",
        "city": "Delhi",
        "is_fraud": 1,
    }
    txns.extend([outflow_pt1, outflow_pt2])
    fraud_txns.extend([outflow_pt1, outflow_pt2])
    txn_counter += 2

    # E. Injected Fraud Pattern 3: Fan-In
    # 8 accounts send small amounts to A0187 on same day
    fi_base = datetime(2026, 11, 18, 10, 0, 0)
    for idx in range(8):
        fi_ts = fi_base + timedelta(minutes=idx * 25)
        sender = f"FI_SND_{idx:02d}"
        t_obj = {
            "txn_id": f"T{txn_counter:06d}",
            "ts": fi_ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": sender,
            "to_account": "A0187",
            "to_vpa": "collector@okaxis",
            "amount": round(random.uniform(1800, 3200), 2),
            "channel": "UPI",
            "device_id": f"D_FI_{idx:02d}",
            "city": "Bengaluru",
            "is_fraud": 1,
        }
        txns.append(t_obj)
        fraud_txns.append(t_obj)
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
                "to_account": f"BENEF_SD_{m_idx}_{t_k}",
                "to_vpa": f"cashout_{m_idx}_{t_k}@okaxis",
                "amount": round(random.uniform(7000, 9500), 2),
                "channel": "UPI",
                "device_id": SHARED_DEVICE_ID,
                "city": "Pune",
                "is_fraud": 1,
            }
            txns.append(t_obj)
            fraud_txns.append(t_obj)
            txn_counter += 1

    # Extra isolated fraud transactions for variety (~12 txns, 1 txn per isolated mule account)
    for i in range(12):
        ts = START_DATE + timedelta(days=random.randint(5, 25), hours=random.randint(1, 4))
        mule = f"A{191 + i:04d}"
        t_obj = {
            "txn_id": f"T{txn_counter:06d}",
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "from_account": mule,
            "to_account": f"BENEF_ISO_{i}",
            "to_vpa": f"iso_mule_{i}@okaxis",
            "amount": round(random.uniform(4000, 8000), 2),
            "channel": "UPI",
            "device_id": f"D{191 + i:04d}",
            "city": "Hyderabad",
            "is_fraud": 1,
        }
        txns.append(t_obj)
        fraud_txns.append(t_obj)
        txn_counter += 1

    # Convert transactions to DataFrame and sort by timestamp
    df_txns = pd.DataFrame(txns)
    df_txns = df_txns.sort_values("ts").reset_index(drop=True)
    df_txns["txn_id"] = [f"T{i+1:06d}" for i in range(len(df_txns))]

    # -------------------------------------------------------------
    # 2. GENERATE ALERTS (exactly 300 rows)
    # -------------------------------------------------------------
    alerts = []
    alert_counter = 1

    fraud_df = df_txns[df_txns["is_fraud"] == 1].copy()
    normal_df = df_txns[df_txns["is_fraud"] == 0].copy()

    # Sample exactly 60 fraud alerts covering the 6 injected typologies:
    # 1. Mule Ring 1 (A0181): 12 outbound alerts on D0080 -> 12 alerts, 8 beneficiaries!
    # 2. Mule Ring 2 (A0182): 8 outbound alerts on D0082 -> 8 alerts, 8 beneficiaries!
    # 3. Mule Ring 3 (A0183): 8 outbound alerts on D0083 -> 8 alerts, 8 beneficiaries!
    # 4. Pass-Through (A0184): 3 alerts (1 inflow + 2 outbound on D0084)
    # 5. Fan-In (collector@okaxis): 8 alerts (8 senders to collector@okaxis)
    # 6. Shared Device (D0099): 9 alerts (3 mules x 3 outbound on D0099)
    # 7. Remaining: 12 isolated fraud alerts (1 alert each on A0191-A0198)
    ring1_txns = fraud_df[fraud_df["from_account"] == "A0181"].head(12)
    ring2_txns = fraud_df[fraud_df["from_account"] == "A0182"].head(8)
    ring3_txns = fraud_df[fraud_df["from_account"] == "A0183"].head(8)
    pt_txns = fraud_df[(fraud_df["from_account"] == "A0184") | (fraud_df["to_account"] == "A0184")].head(3)
    fi_txns = fraud_df[fraud_df["to_vpa"] == "collector@okaxis"].head(8)
    sd_txns = fraud_df[fraud_df["device_id"] == SHARED_DEVICE_ID].head(9)

    core_fraud = pd.concat([ring1_txns, ring2_txns, ring3_txns, pt_txns, fi_txns, sd_txns])
    used_txn_ids = set(core_fraud["txn_id"])
    iso_fraud_txns = fraud_df[fraud_df["to_account"].str.startswith("BENEF_ISO", na=False)]
    rem_fraud_txns = iso_fraud_txns[~iso_fraud_txns["txn_id"].isin(used_txn_ids)].head(12)

    fraud_sample = pd.concat([core_fraud, rem_fraud_txns])

    for _, row in fraud_sample.iterrows():
        txn_ts = datetime.fromisoformat(row["ts"])
        alert_ts = txn_ts + timedelta(minutes=random.randint(1, 4), seconds=random.randint(0, 50))

        if row["device_id"] == SHARED_DEVICE_ID:
            rule = "SHARED_DEVICE"
            score = round(random.uniform(0.85, 0.95), 2)
            reason = "Multiple mule accounts active on device D0099"
            severity = "HIGH"
        elif row["amount"] > 50000 or row["from_account"] == "A0184" or row["to_account"] == "A0184":
            rule = "PASS_THROUGH_90PCT"
            score = round(random.uniform(0.88, 0.98), 2)
            reason = "Large credit immediately followed by rapid pass-through"
            severity = "HIGH"
        elif row["to_vpa"] == "collector@okaxis":
            rule = "FAN_IN_10_IN_24H"
            score = round(random.uniform(0.72, 0.86), 2)
            reason = "Multiple distinct senders funneled to single account"
            severity = "MEDIUM"
        else:
            rule = "FAN_OUT_5_IN_10MIN"
            score = round(random.uniform(0.89, 0.99), 2)
            reason = "Rapid consecutive transfers to new beneficiaries at night"
            severity = "HIGH"

        acct = "A0184" if row["to_account"] == "A0184" else row["from_account"]

        alerts.append({
            "alert_id": f"AL{alert_counter:04d}",
            "txn_id": row["txn_id"],
            "account_id": acct,
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
    # First: include exactly 28 alerts on the hub VPA (shop@okaxis)
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
    # Distinct normal alerts across normal accounts so they don't form artificial bridges
    non_hub_normal_txns = normal_df[normal_df["to_vpa"] != HUB_VPA]
    normal_sample = non_hub_normal_txns.sample(n=212, random_state=42).reset_index(drop=True)

    for idx, row in normal_sample.iterrows():
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

        noise_acct = f"N{idx+1:04d}"
        noise_dev = f"ND{idx+1:04d}"
        alerts.append({
            "alert_id": f"AL{alert_counter:04d}",
            "txn_id": row["txn_id"],
            "account_id": noise_acct,
            "device_id": noise_dev,
            "to_vpa": f"user_noise_{idx:03d}@okaxis",
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

    # 5 rows are exact duplicates of clean alerts (rows 7 to 11 remain identical)

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
