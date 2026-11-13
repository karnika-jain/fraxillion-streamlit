"""Fraxillion - Segment 5: Evidence Management & Hash Chaining.

Provides cryptographic tamper-evidence for investigation artifacts.
Each file is hashed at acquisition and linked into a continuous SHA-256 hash chain.
Includes one-click verification, sealed ZIP bundle export, and live tamper detection.
"""

from datetime import datetime
import os
from pathlib import Path
import pandas as pd
import streamlit as st

from core.db import ensure_db, get_conn
from core.evidence import add_evidence, export_bundle, verify_chain

# Page setup
st.set_page_config(
    page_title="6 · Evidence Management — Fraxillion",
    page_icon="🔒",
    layout="wide",
)

# Guarantee database schema is initialized
ensure_db()

# Academic disclaimer banner
st.warning(
    "⚠️ **Prototype for academic demonstration. Not connected to RBI DAKSH or FIU-IND FINGate. "
    "Report formats are simplified and must not be submitted.**"
)

st.title("🔒 Segment 5: Evidence Management & Hash Chaining")
st.caption("Cryptographic integrity · SHA-256 prev_hash chain · One-click verification · Tamper detection")

st.markdown("---")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
EVIDENCE_DIR = PROJECT_ROOT / "evidence_files"
EXPORTS_DIR = PROJECT_ROOT / "exports"
EVIDENCE_DIR.mkdir(exist_ok=True)
EXPORTS_DIR.mkdir(exist_ok=True)

# ------------------------------------------------------------------
# 1. Case Selection
# ------------------------------------------------------------------
conn = get_conn()
case_rows = conn.execute("SELECT case_id, title, status FROM cases ORDER BY case_id ASC").fetchall()
conn.close()

if not case_rows:
    st.info(
        "ℹ️ **No cases exist in the database yet.**\n\n"
        "In fraud investigation workflows, evidence files must be attached to an active case.\n\n"
        "👉 **To create a case:** Navigate to **2_Correlate** in the sidebar, click **'⚡ Run Correlation'**, "
        "and click **'📥 Accept as Formal Case'** on any candidate cluster. Then return here!"
    )
    st.stop()

case_options = {f"{r['case_id']} — {r['title']} ({r['status']})": r["case_id"] for r in case_rows}
selected_case_label = st.selectbox("Select Active Investigation Case:", options=list(case_options.keys()))
selected_case_id = case_options[selected_case_label]

st.markdown("---")

# ------------------------------------------------------------------
# 2. Upload and Seal Evidence
# ------------------------------------------------------------------
st.subheader("📎 Attach & Seal New Evidence")

col_quick1, col_quick2 = st.columns([3, 1.2])
with col_quick1:
    st.caption("Upload your own file below, or use the 1-click button to attach a pre-made sample note:")
with col_quick2:
    if st.button("📄 + Attach Sample Evidence Note", key="btn_quick_sample_note"):
        sample_src = PROJECT_ROOT / "data" / "sample_evidence_note.txt"
        target_name = f"sample_note_{selected_case_id}.txt"
        target_path = EVIDENCE_DIR / target_name
        target_path.write_bytes(sample_src.read_bytes())
        conn = get_conn()
        try:
            add_evidence(conn, selected_case_id, target_path, kind="DOCUMENT", actor="INVESTIGATOR")
            st.success(f"Sealed {target_name} into evidence chain!")
            st.rerun()
        finally:
            conn.close()

col_up1, col_up2, col_up3 = st.columns([2, 1, 1])

with col_up1:
    uploaded_file = st.file_uploader(
        "Upload Evidence File (Text, Image, PDF, CSV, JSON)",
        type=["txt", "csv", "json", "png", "jpg", "pdf", "docx"],
        key="evidence_uploader",
    )

with col_up2:
    evidence_kind = st.selectbox(
        "Evidence Category",
        options=["DOCUMENT", "SCREENSHOT", "DATASET", "COMMUNICATION", "BANK_STATEMENT"],
        key="evidence_kind_select",
    )

with col_up3:
    st.write("")
    st.write("")
    seal_btn = st.button("🔒 Seal Evidence", type="primary", use_container_width=True)

if seal_btn:
    if uploaded_file is None:
        st.warning("Please select a file to upload first.")
    else:
        # Save file to evidence_files/, ensuring unique name with counter if needed
        base_name, ext = os.path.splitext(uploaded_file.name)
        target_path = EVIDENCE_DIR / uploaded_file.name
        counter = 1
        while target_path.exists():
            target_path = EVIDENCE_DIR / f"{base_name}_{counter}{ext}"
            counter += 1

        with open(target_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

        conn = get_conn()
        try:
            sealed_info = add_evidence(
                conn,
                case_id=selected_case_id,
                path=target_path,
                kind=evidence_kind,
                actor="INVESTIGATOR",
            )
            st.success(
                f"✅ File `{target_path.name}` sealed successfully! "
                f"Evidence ID: #{sealed_info['id']} | SHA-256: `{sealed_info['file_hash'][:16]}...`"
            )
            st.rerun()
        except Exception as e:
            st.error(f"Error sealing evidence: {e}")
        finally:
            conn.close()

# ------------------------------------------------------------------
# 3. Evidence Ledger for Selected Case
# ------------------------------------------------------------------
st.markdown("---")
st.subheader(f"🗂️ Evidence Ledger for Case `{selected_case_id}`")

conn = get_conn()
evidence_rows = conn.execute(
    """
    SELECT id, case_id, path, kind, file_hash, prev_hash, item_hash, created_at
    FROM evidence
    WHERE case_id=?
    ORDER BY id ASC
    """,
    (selected_case_id,),
).fetchall()
conn.close()

if not evidence_rows:
    st.info(f"No evidence items attached to case `{selected_case_id}` yet. Upload a file above to begin the chain.")
else:
    table_data = []
    for r in evidence_rows:
        filename = os.path.basename(r["path"])
        table_data.append({
            "Chain Pos": f"#{r['id']}",
            "File Name": filename,
            "Category": r["kind"],
            "File Hash (SHA-256)": f"{r['file_hash'][:16]}...",
            "Previous Hash": f"{r['prev_hash'][:16]}...",
            "Item Hash": f"{r['item_hash'][:16]}...",
            "Captured At": r["created_at"][:19],
        })

    st.dataframe(pd.DataFrame(table_data), use_container_width=True)

# ------------------------------------------------------------------
# 4. Chain Verification & Export Bundle
# ------------------------------------------------------------------
st.markdown("---")
st.subheader("🛡️ Cryptographic Verification & Export")

col_v1, col_v2 = st.columns(2)

with col_v1:
    st.markdown("#### Cryptographic Chain Integrity")
    st.caption("Checks every link in the hash chain and verifies disk files against original SHA-256 hashes.")
    if st.button("🔍 Verify Cryptographic Chain", type="secondary", use_container_width=True):
        conn = get_conn()
        try:
            ev_count = conn.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
            if ev_count == 0:
                st.info("ℹ️ **No evidence files sealed yet.** Please upload a file above and click **'🔒 Seal Evidence'** first.")
            else:
                ok, failing_id, message = verify_chain(conn)
                if ok:
                    st.success(f"✅ **Chain Verified!** {message} ({ev_count} item(s) checked)")
                else:
                    st.error(f"❌ **TAMPER DETECTED at Item #{failing_id}!**\n\n{message}")
        finally:
            conn.close()

with col_v2:
    st.markdown("#### Evidence Bundle Export")
    st.caption("Packages all evidence files for this case with a cryptographically verified `manifest.json`.")
    if evidence_rows:
        zip_filename = f"evidence_bundle_{selected_case_id}.zip"
        zip_path = EXPORTS_DIR / zip_filename
        
        conn = get_conn()
        try:
            export_bundle(conn, selected_case_id, zip_path)
            with open(zip_path, "rb") as zf:
                zip_bytes = zf.read()
            st.download_button(
                label=f"📦 Download {zip_filename}",
                data=zip_bytes,
                file_name=zip_filename,
                mime="application/zip",
                use_container_width=True,
            )
        finally:
            conn.close()
    else:
        st.info("Attach at least one evidence item to generate an export bundle.")

# ------------------------------------------------------------------
# 5. The 30-Second Tamper Test Instructions
# ------------------------------------------------------------------
st.markdown("---")
with st.expander("🧪 How to Perform the 30-Second Tamper Demonstration (Viva Gold)", expanded=True):
    st.markdown(
        """
        Follow this exact sequence to demonstrate cryptographic evidence integrity during a demo or viva:
        
        1. **Attach a File:** Upload a file (e.g., a `.txt` note or `.csv` export) and click **'🔒 Seal Evidence'**.
        2. **Verify (Clean):** Click **'🔍 Verify Cryptographic Chain'**. A green success message confirms all hashes match.
        3. **Simulate Tampering:**
           * Locate the sealed file in your project folder: `evidence_files/`.
           * Open any `.txt` or `.csv` evidence file in **Notepad**, add a single space character, and press **Ctrl+S** (Save).
        4. **Detect Tampering:**
           * Return to this page and click **'🔍 Verify Cryptographic Chain'** again.
           * **Instant Failure:** The system immediately flags the exact item with a red alert:  
             `❌ TAMPER DETECTED: Stored hash does not match disk hash!`
        5. **Restore Integrity:**
           * Remove the space in Notepad, save the file again, and click **'🔍 Verify Cryptographic Chain'**.
           * The check turns **green** again, proving the evidence is authentic and unmodified.
        """
    )
    
    # 1-Click Interactive Tamper Simulation Buttons for easy demonstration
    st.markdown("##### ⚡ Or Try 1-Click Interactive Tamper Simulation:")
    col_tamp1, col_tamp2 = st.columns(2)
    with col_tamp1:
        if st.button("⚠️ Simulate Tamper on Disk (Adds 1 Byte to File)", type="secondary", key="btn_sim_tamper"):
            if evidence_rows:
                first_path = Path(evidence_rows[0]["path"])
                if first_path.exists():
                    current_content = first_path.read_text(encoding="utf-8")
                    if not current_content.endswith(" "):
                        first_path.write_text(current_content + " ", encoding="utf-8")
                    st.warning(f"Simulated tampering! Added 1 space byte to `{first_path.name}` on disk. Now click 'Verify Cryptographic Chain' above!")
                    st.rerun()
            else:
                st.info("No evidence files to tamper.")
    with col_tamp2:
        if st.button("🔄 Restore Original File (Fix Disk File)", type="secondary", key="btn_sim_restore"):
            if evidence_rows:
                first_path = Path(evidence_rows[0]["path"])
                if first_path.exists():
                    current_content = first_path.read_text(encoding="utf-8")
                    first_path.write_text(current_content.rstrip(" "), encoding="utf-8")
                    st.success(f"Restored `{first_path.name}` to original pristine state! Now click 'Verify Cryptographic Chain' above.")
                    st.rerun()
            else:
                st.info("No evidence files to restore.")
