/** Shared Master compile (nested HMO groups for Template 3 UI). */

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const normName = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

function latestSheet(sheets, keyFn) {
  const picked = new Map();
  for (const sheet of sheets || []) {
    const key = keyFn(sheet);
    const prev = picked.get(key);
    const prevAt = prev ? new Date(prev.updated_at || prev.updatedAt || prev.created_at || prev.createdAt || 0).getTime() : -1;
    const nextAt = new Date(sheet.updated_at || sheet.updatedAt || sheet.created_at || sheet.createdAt || 0).getTime();
    if (!prev || nextAt >= prevAt) picked.set(key, sheet);
  }
  return [...picked.values()];
}

function buildMasterGroups(collationSheets, reconSheets) {
  const periods = new Map();

  const periodOf = (sheet) => {
    const stateKey = sheet.state_code || sheet.state_id;
    const key = `${stateKey}|${sheet.reporting_year}|${sheet.reporting_month}`;
    if (!periods.has(key)) {
      periods.set(key, {
        state_code: sheet.state_code || null,
        state_id: sheet.state_code || sheet.state_id || null,
        state_name: sheet.state?.description ?? null,
        zone_name: sheet.zone?.description ?? null,
        zonal_code: sheet.zonal_code || null,
        reporting_year: Number(sheet.reporting_year),
        reporting_month: Number(sheet.reporting_month),
        rows: new Map(),
      });
    }
    return periods.get(key);
  };

  const touch = (period, hmo, facility, code) => {
    const hmoName = String(hmo || "").trim() || "Unassigned HMO";
    const facilityName = String(facility || "").trim();
    const hcfCode = code ? String(code).trim() : "";
    const nameKey = `${normName(hmoName)}|n|${normName(facilityName)}`;
    const codeKey = hcfCode ? `${normName(hmoName)}|c|${normName(hcfCode)}` : "";
    let row = (codeKey && period.rows.get(codeKey)) || period.rows.get(nameKey);
    if (!row) {
      row = {
        hmo_name: hmoName,
        facility_name: facilityName,
        hcf_code: hcfCode,
        alleged_cap: 0,
        alleged_ffs: 0,
        alleged_phi: 0,
        actual_cap: null,
        actual_ffs: null,
        actual_phi: null,
        agreed_amount: 0,
        amount_paid: 0,
        has_recon: false,
        remarks: [],
      };
    }
    if (facilityName) row.facility_name = facilityName;
    if (hcfCode) row.hcf_code = hcfCode;
    period.rows.set(`${normName(row.hmo_name)}|n|${normName(row.facility_name)}`, row);
    if (row.hcf_code) period.rows.set(`${normName(row.hmo_name)}|c|${normName(row.hcf_code)}`, row);
    return row;
  };

  for (const sheet of latestSheet(
    collationSheets,
    (s) => `${s.state_code || s.state_id}|${s.reporting_year}|${s.reporting_month}`,
  )) {
    const period = periodOf(sheet);
    for (const line of sheet.lines || []) {
      if (!String(line.facility_name || "").trim() && !String(line.hmo_name || "").trim()) continue;
      const row = touch(period, line.hmo_name, line.facility_name, line.hcf_code);
      row.alleged_cap = money(line.nhia_cap);
      row.alleged_ffs = money(line.nhia_ffs);
      row.alleged_phi = money(line.phi);
    }
  }

  const reconLatest = latestSheet(
    reconSheets,
    (s) => `${s.state_code || s.state_id}|${s.reporting_year}|${s.reporting_month}|${s.stream_type}|${normName(s.hmo_name)}`,
  );
  for (const sheet of reconLatest) {
    const stream = sheet.stream_type;
    if (!["cap", "ffs", "phi"].includes(stream)) continue;
    const period = periodOf(sheet);
    for (const line of sheet.lines || []) {
      if (!String(line.hcf_name || "").trim()) continue;
      const row = touch(period, sheet.hmo_name, line.hcf_name, line.hcf_code);
      const allegedKey = `alleged_${stream}`;
      if (!row[allegedKey]) row[allegedKey] = money(line.alleged_amount);
      row[`actual_${stream}`] = money(line.actual_amount);
      if (!row.has_recon) {
        row.agreed_amount = 0;
        row.amount_paid = 0;
        row.has_recon = true;
      }
      row.agreed_amount = money(row.agreed_amount + money(line.agreed_amount));
      row.amount_paid = money(row.amount_paid + money(line.amount_paid));
      const remark = String(line.remarks || "").trim();
      if (remark && !row.remarks.includes(remark)) row.remarks.push(remark);
    }
  }

  return [...periods.values()]
    .map((period) => {
      const lines = [...new Set(period.rows.values())].map((row) => {
        const alleged_total = money(row.alleged_cap + row.alleged_ffs + row.alleged_phi);
        const actualParts = [row.actual_cap, row.actual_ffs, row.actual_phi].filter((v) => v != null);
        const actual_total = actualParts.length ? money(actualParts.reduce((sum, v) => sum + v, 0)) : null;
        const outstanding = row.has_recon ? money(row.agreed_amount - row.amount_paid) : null;
        return {
          hmo_name: row.hmo_name,
          facility_name: row.facility_name,
          hcf_code: row.hcf_code || null,
          alleged_cap: row.alleged_cap,
          alleged_ffs: row.alleged_ffs,
          alleged_phi: row.alleged_phi,
          alleged_total,
          actual_cap: row.actual_cap,
          actual_ffs: row.actual_ffs,
          actual_phi: row.actual_phi,
          actual_total,
          agreed_amount: row.has_recon ? row.agreed_amount : null,
          amount_paid: row.has_recon ? row.amount_paid : null,
          outstanding,
          remarks: row.remarks.join(" · ") || null,
        };
      }).sort((a, b) => a.hmo_name.localeCompare(b.hmo_name) || a.facility_name.localeCompare(b.facility_name));

      const hmos = [];
      for (const line of lines) {
        let group = hmos.find((h) => h.hmo_name === line.hmo_name);
        if (!group) {
          group = { hmo_name: line.hmo_name, lines: [] };
          hmos.push(group);
        }
        group.lines.push(line);
      }
      return {
        state_code: period.state_code,
        state_id: period.state_id,
        state_name: period.state_name,
        zone_name: period.zone_name,
        zonal_code: period.zonal_code,
        reporting_year: period.reporting_year,
        reporting_month: period.reporting_month,
        hmos,
      };
    })
    .filter((period) => period.hmos.length)
    .sort((a, b) =>
      b.reporting_year - a.reporting_year
      || b.reporting_month - a.reporting_month
      || String(a.state_name || "").localeCompare(String(b.state_name || "")));
}

module.exports = { money, buildMasterGroups, latestSheet, normName };
