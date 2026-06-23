#!/usr/bin/env python3
"""
Regenerate monthly-report INSERT blocks in seed_data.sql from the DGO Excel (2025 sheet).

Quarterly metrics use exact Excel Q1–Q4 values on month-end rows (Mar/Jun/Sep/Dec)
so annual aggregation matches the spreadsheet without dividing totals.

Run: python3 scripts/generate_seed_monthly_from_excel.py
"""
from __future__ import annotations

import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
EXCEL = ROOT / "STATE OFFICE OPERATIONAL DATA  2024_2025 FOR DGO.xlsx"
SEED = ROOT / "seed_data.sql"
SHEET = "STATE OFFICES OPERATIONAL DATA "
YEAR = 2025
QUARTER_MONTHS = {1: 3, 2: 6, 3: 9, 4: 12}

# Column indices (0-based) from 2025 header row 3
COL = {
    "staff": 2,
    "vehicles": 3,
    "hcf_nhia": 4,
    "hcf_acc": 5,
    "budget": 6,
    "utilized": 7,
    "cemonc_hcf": 8,
    "cemonc_ben": 9,
    "ffp_fac": 10,
    "ffp_ben": 11,
    "gifship": 12,
    "gifship_prem": 17,
    "ops": 22,
    "fsship": 27,
    "extra_dep": 32,
    "extra_prem": 37,
    "add_dep": 42,
    "cop": 47,
    "bhcpf": 52,
    "tiship": 53,
    "mha": 54,
    "sshia": 55,
    "compl_reg": 56,
    "compl_res": 57,
    "compl_esc": 58,
    "ms_visit": 59,
    "ms_ok": 60,
    "ms_fail": 61,
    "igr": 62,
    "qa": 67,
    "acc_req": 72,
    "acc_done": 77,
    "marketing": 82,
    "stakeholders": 87,
    "media": 88,
    "recon_meet": 89,
    "indebtedness": 90,
    "recovered": 91,
}


def norm_state(name: str) -> str:
    return re.sub(r"\s+", " ", str(name or "").strip())


def sql_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return "NULL"
        return "'" + s.replace("'", "''") + "'"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def qvals(row, base: int):
    return [row[base + i] if row[base + i] is not None else None for i in range(4)]


def q_at(row, base: int, quarter: int):
    return row[base + quarter - 1] if row[base + quarter - 1] is not None else None


def load_rows():
    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    ws = wb[SHEET]
    out = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row[0]:
            continue
        try:
            sid = int(row[0])
        except (TypeError, ValueError):
            continue
        out.append((sid, list(row)))
    return out


def finance_block(rows) -> str:
    lines = [
        "-- 5. Finance Monthly Reports — section: finance (IGR quarterly: Mar/Jun/Sep/Dec from Excel Q1–Q4)",
        "TRUNCATE TABLE finance_monthly_reports;",
    ]
    n = 0
    for state_id, row in rows:
        state = norm_state(row[1])
        for q in range(1, 5):
            n += 1
            month = QUARTER_MONTHS[q]
            ref = f"FIN-{YEAR}-{n:05d}"
            igr = q_at(row, COL["igr"], q)
            is_dec = q == 4
            lines.append(
                f"INSERT INTO finance_monthly_reports "
                f"(reference_id, state_id, reporting_year, reporting_month, staff_no, total_vehicles, "
                f"approved_budget, total_amount_utilized, igr_amount, total_indebtedness, amount_recovered, "
                f"reconciliation_meetings, submitted_by, section, status, created_at, updated_at) VALUES "
                f"('{ref}', {state_id}, {YEAR}, {month}, NULL, NULL, "
                f"{sql_val(row[COL['budget']]) if is_dec else 'NULL'}, "
                f"{sql_val(row[COL['utilized']]) if is_dec else 'NULL'}, "
                f"{sql_val(igr)}, "
                f"{sql_val(row[COL['indebtedness']]) if is_dec else 'NULL'}, "
                f"{sql_val(row[COL['recovered']]) if is_dec else 'NULL'}, "
                f"{sql_val(row[COL['recon_meet']]) if is_dec else 'NULL'}, "
                f"'Finance · {state}', 'finance', 'submitted', NOW(), NOW());"
            )
    return "\n".join(lines)


def admin_block(rows) -> str:
    lines = [
        "",
        "-- 5b. Finance Monthly Reports — section: admin (staff & vehicles — year-end snapshot)",
    ]
    n = 0
    for state_id, row in rows:
        n += 1
        state = norm_state(row[1])
        ref = f"ADM-{YEAR}-{n:05d}"
        lines.append(
            f"INSERT INTO finance_monthly_reports "
            f"(reference_id, state_id, reporting_year, reporting_month, staff_no, total_vehicles, "
            f"approved_budget, total_amount_utilized, igr_amount, total_indebtedness, amount_recovered, "
            f"reconciliation_meetings, submitted_by, section, status, created_at, updated_at) VALUES "
            f"('{ref}', {state_id}, {YEAR}, 12, {sql_val(row[COL['staff']])}, {sql_val(row[COL['vehicles']])}, "
            f"NULL, NULL, NULL, NULL, NULL, NULL, 'Admin · {state}', 'admin', 'submitted', NOW(), NOW());"
        )
    return "\n".join(lines)


def sqa_block(rows) -> str:
    lines = [
        "",
        "-- 6. SQA Monthly Reports — section: sqa (QA & accreditation quarterly on Mar/Jun/Sep/Dec)",
        "TRUNCATE TABLE sqa_monthly_reports;",
    ]
    n = 0
    for state_id, row in rows:
        state = norm_state(row[1])
        for q in range(1, 5):
            n += 1
            month = QUARTER_MONTHS[q]
            ref = f"SQA-{YEAR}-{n:05d}"
            hcf = row[COL["hcf_nhia"]] if q == 4 else None
            hcf_acc = row[COL["hcf_acc"]] if q == 4 else None
            lines.append(
                f"INSERT INTO sqa_monthly_reports "
                f"(reference_id, state_id, reporting_year, reporting_month, total_hcf_under_nhia, total_accredited_hcf, "
                f"cemonc_accredited_hcf, cemonc_beneficiaries, ffp_accredited_facilities, ffp_beneficiaries, "
                f"qa_conducted, accreditation_requests, accreditation_conducted, "
                f"mystery_shopping_visited, mystery_shopping_complied, mystery_shopping_non_complied, "
                f"complaints_registered, complaints_resolved, complaints_escalated, "
                f"submitted_by, section, status, created_at, updated_at) VALUES "
                f"('{ref}', {state_id}, {YEAR}, {month}, "
                f"{sql_val(hcf)}, {sql_val(hcf_acc)}, "
                f"{sql_val(row[COL['cemonc_hcf']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['cemonc_ben']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['ffp_fac']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['ffp_ben']]) if q == 4 else 'NULL'}, "
                f"{sql_val(q_at(row, COL['qa'], q))}, "
                f"{sql_val(q_at(row, COL['acc_req'], q))}, "
                f"{sql_val(q_at(row, COL['acc_done'], q))}, "
                f"{sql_val(row[COL['ms_visit']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['ms_ok']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['ms_fail']]) if q == 4 else 'NULL'}, "
                f"NULL, NULL, NULL, "
                f"'SQA · {state}', 'sqa', 'submitted', NOW(), NOW());"
            )
    return "\n".join(lines)


def complaints_block(rows) -> str:
    lines = ["", "-- 6b. SQA Monthly Reports — section: complaints (annual totals, December)"]
    n = 0
    for state_id, row in rows:
        n += 1
        state = norm_state(row[1])
        ref = f"CMP-{YEAR}-{n:05d}"
        lines.append(
            f"INSERT INTO sqa_monthly_reports "
            f"(reference_id, state_id, reporting_year, reporting_month, total_hcf_under_nhia, total_accredited_hcf, "
            f"cemonc_accredited_hcf, cemonc_beneficiaries, ffp_accredited_facilities, ffp_beneficiaries, "
            f"qa_conducted, accreditation_requests, accreditation_conducted, "
            f"mystery_shopping_visited, mystery_shopping_complied, mystery_shopping_non_complied, "
            f"complaints_registered, complaints_resolved, complaints_escalated, "
            f"submitted_by, section, status, created_at, updated_at) VALUES "
            f"('{ref}', {state_id}, {YEAR}, 12, NULL, NULL, NULL, NULL, NULL, NULL, "
            f"NULL, NULL, NULL, NULL, NULL, NULL, "
            f"{sql_val(row[COL['compl_reg']])}, {sql_val(row[COL['compl_res']])}, {sql_val(row[COL['compl_esc']])}, "
            f"'Complaints · {state}', 'complaints', 'submitted', NOW(), NOW());"
        )
    return "\n".join(lines)


def programmes_enrol_block(rows) -> str:
    lines = [
        "",
        "-- 7. Programmes Monthly Reports — section: enrolment",
        "-- Quarterly enrolment metrics: Mar=Q1, Jun=Q2, Sep=Q3, Dec=Q4 (exact Excel values).",
        "-- Scheme totals (BHCPF/TISHIP/MHA/SSHIA) + participating_institutions: December only.",
        "TRUNCATE TABLE programmes_monthly_reports;",
    ]
    n = 0
    fields = [
        ("gifship_enrolments", COL["gifship"]),
        ("gifship_premium", COL["gifship_prem"]),
        ("ops_count", COL["ops"]),
        ("fsship_new_enrolments", COL["fsship"]),
        ("extra_dependants", COL["extra_dep"]),
        ("extra_dependant_premium", COL["extra_prem"]),
        ("additional_dependants", COL["add_dep"]),
        ("change_of_provider", COL["cop"]),
    ]
    for state_id, row in rows:
        state = norm_state(row[1])
        for q in range(1, 5):
            n += 1
            month = QUARTER_MONTHS[q]
            ref = f"PRG-{YEAR}-{n:05d}"
            vals = {name: sql_val(q_at(row, base, q)) for name, base in fields}
            lines.append(
                f"INSERT INTO programmes_monthly_reports "
                f"(reference_id, state_id, reporting_year, reporting_month, "
                f"gifship_enrolments, gifship_premium, ops_count, fsship_new_enrolments, "
                f"extra_dependants, extra_dependant_premium, additional_dependants, change_of_provider, "
                f"bhcpf_beneficiaries, bhcpf_facilities, tiship_lives, participating_institutions, mha_lives, sshia_lives, "
                f"stakeholder_meetings, media_appearances, marketing_sensitization, "
                f"submitted_by, section, status, created_at, updated_at) VALUES "
                f"('{ref}', {state_id}, {YEAR}, {month}, "
                f"{vals['gifship_enrolments']}, {vals['gifship_premium']}, {vals['ops_count']}, {vals['fsship_new_enrolments']}, "
                f"{vals['extra_dependants']}, {vals['extra_dependant_premium']}, {vals['additional_dependants']}, {vals['change_of_provider']}, "
                f"{sql_val(row[COL['bhcpf']]) if q == 4 else 'NULL'}, "
                f"NULL, "
                f"{sql_val(row[COL['tiship']]) if q == 4 else 'NULL'}, "
                f"NULL, "
                f"{sql_val(row[COL['mha']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['sshia']]) if q == 4 else 'NULL'}, "
                f"NULL, NULL, NULL, "
                f"'Enrolment · {state}', 'enrolment', 'submitted', NOW(), NOW());"
            )
    return "\n".join(lines)


def programmes_outreach_block(rows) -> str:
    lines = [
        "",
        "-- 7b. Programmes Monthly Reports — section: outreach",
        "-- Marketing quarterly on Mar/Jun/Sep/Dec; stakeholders & media annual on December.",
    ]
    n = 0
    for state_id, row in rows:
        state = norm_state(row[1])
        for q in range(1, 5):
            n += 1
            month = QUARTER_MONTHS[q]
            ref = f"OUT-{YEAR}-{n:05d}"
            lines.append(
                f"INSERT INTO programmes_monthly_reports "
                f"(reference_id, state_id, reporting_year, reporting_month, "
                f"gifship_enrolments, gifship_premium, ops_count, fsship_new_enrolments, "
                f"extra_dependants, extra_dependant_premium, additional_dependants, change_of_provider, "
                f"bhcpf_beneficiaries, bhcpf_facilities, tiship_lives, participating_institutions, mha_lives, sshia_lives, "
                f"stakeholder_meetings, media_appearances, marketing_sensitization, "
                f"submitted_by, section, status, created_at, updated_at) VALUES "
                f"('{ref}', {state_id}, {YEAR}, {month}, "
                f"NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, "
                f"{sql_val(row[COL['stakeholders']]) if q == 4 else 'NULL'}, "
                f"{sql_val(row[COL['media']]) if q == 4 else 'NULL'}, "
                f"{sql_val(q_at(row, COL['marketing'], q))}, "
                f"'Outreach · {state}', 'outreach', 'submitted', NOW(), NOW());"
            )
    return "\n".join(lines)


def patch_seed(sql_chunk: str):
    text = SEED.read_text(encoding="utf-8")
    start = text.index("-- 5. Finance Monthly Reports")
    end = text.index("SET FOREIGN_KEY_CHECKS = 1;")
    new_text = text[:start] + sql_chunk + "\n\n" + text[end:]
    SEED.write_text(new_text, encoding="utf-8")


def main():
    rows = load_rows()
    if len(rows) != 38:
        raise SystemExit(f"Expected 38 states, got {len(rows)}")

    chunk = "\n".join([
        finance_block(rows),
        admin_block(rows),
        sqa_block(rows),
        complaints_block(rows),
        programmes_enrol_block(rows),
        programmes_outreach_block(rows),
    ])

    patch_seed(chunk)
    print(f"✅ Updated {SEED}")
    print(f"   Finance rows: {38 * 4 + 38} (IGR quarterly + admin)")
    print(f"   SQA rows: {38 * 4 + 38} (QA quarterly + complaints)")
    print(f"   Programmes rows: {38 * 4 * 2} (enrolment + outreach quarterly)")
    print("   Scheme totals & staff/vehicles on December rows; participating_institutions NULL (not in 2025 Excel)")


if __name__ == "__main__":
    main()
