"""Generate the 50,000-row (2% fraud) offline training dataset.

Completely disjoint from the teammate's 5,000-row demo dataset
(different seed, date window, and TR_* account/device namespaces) so
demo risk scores remain honest out-of-sample predictions.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = PROJECT_ROOT / "data" / "train_transactions_50k.csv"

CITIES = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata"]
VPA_HANDLES = ["okaxis", "okhdfcbank", "okicici", "ybl", "paytm"]


def generate_training_data(seed: int = 101) -> pd.DataFrame:
    """Build ~50,000 UPI-style transactions with ~1,000 fraud rows (~2%)."""
    rng = random.Random(seed)
    base_dt = datetime(2026, 9, 1, 0, 0, 0)
    rows: list[dict] = []
    txn_counter = 1

    def next_txn_id() -> str:
        nonlocal txn_counter
        tid = f"TRT{txn_counter:06d}"
        txn_counter += 1
        return tid

    # 2,500 normal accounts: 90% own a dedicated device, 10% share a family device (2 accounts per device)
    normal_accounts = [f"TR_A{i:04d}" for i in range(1, 2501)]
    acct_device = {
        a: f"TR_D{(idx // 2 if idx % 10 == 0 else idx):04d}"
        for idx, a in enumerate(normal_accounts, start=1)
    }
    acct_contacts = {
        a: rng.sample(normal_accounts, k=rng.randint(5, 14)) for a in normal_accounts
    }
    mule_pool = [f"TR_M{i:04d}" for i in range(1, 201)]

    # --- 1. Normal background traffic (~49,000 rows) ---
    # Reserve the last 300 normal accounts to only appear after day 25 so "new account" != always fraud
    late_joiners = set(normal_accounts[-300:])
    for _ in range(49000):
        src = rng.choice(normal_accounts)
        # 85% transfers go to known circle, 15% to new payees
        if rng.random() < 0.85:
            dst = rng.choice(acct_contacts[src])
        else:
            dst = rng.choice(normal_accounts)
        if dst == src:
            dst = normal_accounts[(normal_accounts.index(src) + 1) % len(normal_accounts)]

        day_offset = rng.randint(25, 44) if src in late_joiners else rng.randint(0, 44)
        # 94% daytime (07:00-22:59), 6% legitimate night activity
        if rng.random() < 0.94:
            hour = rng.randint(7, 22)
        else:
            hour = rng.choice([23, 0, 1, 2, 3, 4, 5])
        minute = rng.randint(0, 59)
        second = rng.randint(0, 59)
        ts = base_dt + timedelta(days=day_offset, hours=hour, minutes=minute, seconds=second)

        # Occasional legitimate round / higher value rent or bill payment (~4%)
        if rng.random() < 0.04:
            amount = float(rng.choice([5000, 10000, 12000, 15000, 20000]))
        else:
            amount = round(rng.uniform(50.0, 5500.0), 2)

        dev = acct_device[src]
        vpa = f"{dst.lower()}@{rng.choice(VPA_HANDLES)}"

        rows.append(
            {
                "txn_id": next_txn_id(),
                "ts": ts.isoformat(),
                "from_account": src,
                "to_account": dst,
                "to_vpa": vpa,
                "amount": amount,
                "channel": "UPI",
                "device_id": dev,
                "city": rng.choice(CITIES),
                "is_fraud": 0,
            }
        )

    # Give ~50% of mule accounts legitimate early-month activity so age alone doesn't leak fraud
    for m in mule_pool[:100]:
        for _ in range(rng.randint(2, 5)):
            t_legit = base_dt + timedelta(days=rng.randint(0, 10), hours=rng.randint(9, 20), minutes=rng.randint(0, 59))
            dst = rng.choice(normal_accounts)
            rows.append(
                {
                    "txn_id": next_txn_id(),
                    "ts": t_legit.isoformat(),
                    "from_account": m,
                    "to_account": dst,
                    "to_vpa": f"{dst.lower()}@{rng.choice(VPA_HANDLES)}",
                    "amount": round(rng.uniform(100.0, 2000.0), 2),
                    "channel": "UPI",
                    "device_id": f"TR_MD_LEGIT_{m}",
                    "city": rng.choice(CITIES),
                    "is_fraud": 0,
                }
            )

    # --- 2. Fraud Typology A: Mule Fan-Out Rings (~450 fraud rows) ---
    # Groups of 3 mules share a device (device_shared_count ~ 3), matching demo typology
    shared_mule_devices = [f"TR_MD{i:03d}" for i in range(1, 51)]

    for ring_idx in range(45):
        mule = mule_pool[ring_idx]
        mule_dev = shared_mule_devices[ring_idx % len(shared_mule_devices)]
        city = rng.choice(CITIES)

        day_offset = rng.randint(2, 43)
        night_hour = rng.choice([23, 0, 1, 2, 3, 4])
        t_start = base_dt + timedelta(
            days=day_offset, hours=night_hour, minutes=rng.randint(0, 45)
        )

        # Prior funding inflow so mule has balance (normal or suspicious feeder)
        feeder = rng.choice(normal_accounts)
        fan_out_count = rng.randint(8, 12)
        total_out = 0.0
        fan_txns = []

        targets = rng.sample(normal_accounts, k=fan_out_count)
        for j, dst in enumerate(targets):
            amt = (
                float(rng.choice([5000, 8000, 10000, 12000]))
                if rng.random() < 0.45
                else round(rng.uniform(4500.0, 14500.0), 2)
            )
            total_out += amt
            t_tx = t_start + timedelta(minutes=rng.randint(2, 5) * (j + 1))
            fan_txns.append((dst, amt, t_tx))

        # 65% receive immediate feeder inflow; 35% fan out from pre-existing balance
        if rng.random() < 0.65:
            rows.append(
                {
                    "txn_id": next_txn_id(),
                    "ts": (t_start - timedelta(minutes=rng.randint(10, 30))).isoformat(),
                    "from_account": feeder,
                    "to_account": mule,
                    "to_vpa": f"{mule.lower()}@{rng.choice(VPA_HANDLES)}",
                    "amount": round(total_out * rng.uniform(1.02, 1.12), 2),
                    "channel": "UPI",
                    "device_id": acct_device[feeder],
                    "city": city,
                    "is_fraud": 0,
                }
            )

        for dst, amt, t_tx in fan_txns:
            rows.append(
                {
                    "txn_id": next_txn_id(),
                    "ts": t_tx.isoformat(),
                    "from_account": mule,
                    "to_account": dst,
                    "to_vpa": f"benef_{dst.lower()}@{rng.choice(VPA_HANDLES)}",
                    "amount": amt,
                    "channel": "UPI",
                    "device_id": mule_dev,
                    "city": city,
                    "is_fraud": 1,
                }
            )

    # --- 3. Fraud Typology B: Pass-Through Laundering (~300 fraud rows) ---
    # 75 episodes: receive large amount, push 84%-97% out across 4 rapid legs within 2 hours
    for pt_idx in range(75):
        mule = mule_pool[45 + pt_idx]
        mule_dev = shared_mule_devices[pt_idx % len(shared_mule_devices)]
        city = rng.choice(CITIES)

        day_offset = rng.randint(2, 43)
        hour = rng.choice([22, 23, 0, 1, 2, 3, 14, 15])
        t_in = base_dt + timedelta(days=day_offset, hours=hour, minutes=rng.randint(0, 50))

        inflow_amt = round(rng.uniform(45000.0, 220000.0), 2)
        feeder = rng.choice(normal_accounts)
        rows.append(
            {
                "txn_id": next_txn_id(),
                "ts": t_in.isoformat(),
                "from_account": feeder,
                "to_account": mule,
                "to_vpa": f"{mule.lower()}@{rng.choice(VPA_HANDLES)}",
                "amount": inflow_amt,
                "channel": "UPI",
                "device_id": acct_device[feeder],
                "city": city,
                "is_fraud": 0,
            }
        )

        pass_pct = rng.uniform(0.84, 0.97)
        num_legs = 4
        remaining = inflow_amt * pass_pct
        targets = rng.sample(normal_accounts, k=num_legs)
        for j, dst in enumerate(targets):
            if j == num_legs - 1:
                amt = round(remaining, 2)
            else:
                amt = round(remaining * rng.uniform(0.25, 0.45), 2)
                remaining -= amt
            t_out = t_in + timedelta(minutes=rng.randint(10, 28) * (j + 1))
            rows.append(
                {
                    "txn_id": next_txn_id(),
                    "ts": t_out.isoformat(),
                    "from_account": mule,
                    "to_account": dst,
                    "to_vpa": f"pt_{dst.lower()}@{rng.choice(VPA_HANDLES)}",
                    "amount": max(amt, 500.0),
                    "channel": "UPI",
                    "device_id": mule_dev,
                    "city": city,
                    "is_fraud": 1,
                }
            )

    # --- 4. Fraud Typology C: Fan-In Collection (~250 fraud rows) ---
    # 20 collector accounts receiving 12-13 small transfers in < 3 hours
    for fi_idx in range(20):
        collector = mule_pool[120 + fi_idx]
        city = rng.choice(CITIES)
        day_offset = rng.randint(2, 43)
        t_base = base_dt + timedelta(days=day_offset, hours=rng.randint(20, 23), minutes=10)

        senders = rng.sample(normal_accounts, k=rng.randint(12, 13))
        shared_dev = shared_mule_devices[fi_idx % len(shared_mule_devices)]
        for j, src in enumerate(senders):
            t_tx = t_base + timedelta(minutes=j * rng.randint(4, 12))
            amt = round(rng.uniform(1500.0, 4900.0), 2)
            rows.append(
                {
                    "txn_id": next_txn_id(),
                    "ts": t_tx.isoformat(),
                    "from_account": src,
                    "to_account": collector,
                    "to_vpa": f"{collector.lower()}@{rng.choice(VPA_HANDLES)}",
                    "amount": amt,
                    "channel": "UPI",
                    "device_id": shared_dev if j < 4 else acct_device[src],
                    "city": city,
                    "is_fraud": 1,
                }
            )

    df = pd.DataFrame(rows).sort_values("ts").reset_index(drop=True)
    return df


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = generate_training_data()
    df.to_csv(OUT_PATH, index=False)
    n_total = len(df)
    n_fraud = int(df["is_fraud"].sum())
    pct = (n_fraud / n_total) * 100.0 if n_total else 0.0
    print(f"Saved training dataset to: {OUT_PATH}")
    print(f"Total rows : {n_total}")
    print(f"Fraud rows : {n_fraud} ({pct:.2f}%)")
    print(f"Normal rows: {n_total - n_fraud}")


if __name__ == "__main__":
    main()
