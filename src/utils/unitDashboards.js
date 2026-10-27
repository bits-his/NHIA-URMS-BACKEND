/**
 * Aggregates for the SERVICOM, SVU, and complaint-register dashboards.
 * Rules match the approved plan: only fields the registers already store.
 */

const {
  workingDaysSinceReceived,
  isComplaintClosed,
  getRuleForPriority,
  FALLBACK_RULES,
} = require("./complaintSla");

const COMMENT_QUESTIONS = [
  { id: "Q01", label: "Reception", max: 5 },
  { id: "Q02", label: "Courteous", max: 4 },
  { id: "Q03", label: "Professional", max: 4 },
  { id: "Q04", label: "Prompt", max: 4 },
  { id: "Q05", label: "Overall", max: 5 },
];

const SATISFACTION_QUESTIONS = [
  { id: "Q01", category: "SERVICE DELIVERY", question: "Physical or bureaucratic obstacles to access" },
  { id: "Q02", category: "SERVICE DELIVERY", question: "Facility open for NHIS enrollees during working hours" },
  { id: "Q03", category: "SERVICE DELIVERY", question: "HCF recognises poor performance" },
  { id: "Q04", category: "SERVICE DELIVERY", question: "Honest explanation of poor performance" },
  { id: "Q05", category: "SERVICE DELIVERY", question: "Remedial action for poor performance" },
  { id: "Q06", category: "TIMELINESS", question: "Staff provide prompt service" },
  { id: "Q07", category: "TIMELINESS", question: "System to monitor waiting time" },
  { id: "Q08", category: "TIMELINESS", question: "Explanation for delays" },
  { id: "Q09", category: "TIMELINESS", question: "Customers told of interruptions" },
  { id: "Q10", category: "INFORMATION", question: "NHIS drug list published" },
  { id: "Q11", category: "INFORMATION", question: "Sufficient information on referrals" },
  { id: "Q12", category: "PROFESSIONALISM", question: "Appointment procedures clearly detailed" },
  { id: "Q13", category: "PROFESSIONALISM", question: "No unfair preference" },
  { id: "Q14", category: "PROFESSIONALISM", question: "No hidden costs" },
  { id: "Q15", category: "STAFF ATTITUDE", question: "Sympathetic to enrollee needs" },
  { id: "Q16", category: "STAFF ATTITUDE", question: "Polite, friendly and attentive" },
  { id: "Q17", category: "STAFF ATTITUDE", question: "Suitable facilities for privacy" },
];

const POOR_CONDITIONS = new Set(["poor", "defective", "damaged"]);
const VERIFIED_STATUSES = new Set(["verified", "verified & passed"]);

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function dateParts(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!y || !m) return null;
  return { year: y, month: m, quarter: Math.ceil(m / 3), iso: s };
}

function matchesPeriod(value, query = {}) {
  const parts = dateParts(value);
  if (query.date) {
    if (!parts) return false;
    return parts.iso === String(query.date).slice(0, 10);
  }
  if (!query.year && !query.quarter && !query.month && !query.from && !query.to) return true;
  if (!parts) return false;
  if (query.year && parts.year !== Number(query.year)) return false;
  if (query.month && parts.month !== Number(query.month)) return false;
  if (query.quarter) {
    const q = Number(String(query.quarter).replace(/^q/i, ""));
    if (parts.quarter !== q) return false;
  }
  if (query.from && parts.iso < String(query.from).slice(0, 10)) return false;
  if (query.to && parts.iso > String(query.to).slice(0, 10)) return false;
  return true;
}

function parseResponses(raw) {
  let rows = raw;
  if (typeof raw === "string") {
    try { rows = JSON.parse(raw); } catch { rows = []; }
  }
  if (!Array.isArray(rows)) return {};
  const out = {};
  for (const row of rows) {
    if (!row?.question_id) continue;
    out[row.question_id] = row.response ?? row.score ?? "";
  }
  return out;
}

function mean(nums) {
  const clean = nums.filter((n) => Number.isFinite(n));
  if (!clean.length) return null;
  return round2(clean.reduce((a, b) => a + b, 0) / clean.length);
}

function countMap(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "Not specified";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildCommentCardSection(cards) {
  const parsed = cards.map((card) => parseResponses(card.responses));
  const reception = [];
  const overall = [];
  const dist = [1, 2, 3, 4, 5].map((score) => ({ score: String(score), reception: 0, overall: 0 }));

  for (const responses of parsed) {
    const r = Number(responses.Q01);
    const o = Number(responses.Q05);
    if (r >= 1 && r <= 5) {
      reception.push(r);
      dist[r - 1].reception += 1;
    }
    if (o >= 1 && o <= 5) {
      overall.push(o);
      dist[o - 1].overall += 1;
    }
  }

  const avg_by_question = COMMENT_QUESTIONS.map((q) => {
    const scores = parsed
      .map((responses) => Number(responses[q.id]))
      .filter((n) => Number.isFinite(n) && n > 0);
    const average = mean(scores);
    return {
      id: q.id,
      label: q.label,
      average,
      max: q.max,
      percent: average == null ? 0 : round1((average / q.max) * 100),
      responses: scores.length,
    };
  });

  return {
    responses: cards.length,
    reception_average: mean(reception),
    overall_rating: mean(overall),
    avg_by_question,
    distribution: dist,
  };
}

function yesRate(yes, answered) {
  if (!answered) return null;
  return round1((yes / answered) * 100);
}

function buildSatisfactionSection(surveys) {
  const facilities = new Set();
  let yesTotal = 0;
  let answeredTotal = 0;

  const perQuestion = SATISFACTION_QUESTIONS.map((q) => ({
    ...q,
    yes: 0,
    answered: 0,
    quarters: new Map(),
  }));

  for (const survey of surveys) {
    const name = String(survey.provider_name || "").trim();
    if (name) facilities.add(name.toLowerCase());
    const responses = parseResponses(survey.responses);
    const parts = dateParts(survey.survey_date);
    const quarterKey = parts ? `${parts.year}-Q${parts.quarter}` : null;

    for (const q of perQuestion) {
      const val = String(responses[q.id] || "").toLowerCase();
      if (val !== "yes" && val !== "no") continue;
      q.answered += 1;
      answeredTotal += 1;
      const positive = val === "yes";
      if (positive) {
        q.yes += 1;
        yesTotal += 1;
      }
      if (quarterKey) {
        if (!q.quarters.has(quarterKey)) q.quarters.set(quarterKey, { yes: 0, answered: 0 });
        const bucket = q.quarters.get(quarterKey);
        bucket.answered += 1;
        if (positive) bucket.yes += 1;
      }
    }
  }

  const indicators = perQuestion.map((q) => {
    const positive_rate = yesRate(q.yes, q.answered);
    let lowQuarters = 0;
    for (const bucket of q.quarters.values()) {
      const rate = yesRate(bucket.yes, bucket.answered);
      if (rate != null && rate < 50) lowQuarters += 1;
    }
    return {
      id: q.id,
      category: q.category,
      question: q.question,
      positive_rate,
      answered: q.answered,
      low: positive_rate != null && positive_rate < 50,
      repeated_low: lowQuarters >= 2,
    };
  });

  const categories = [...new Set(SATISFACTION_QUESTIONS.map((q) => q.category))].map((category) => {
    const rows = indicators.filter((q) => q.category === category);
    const yes = perQuestion.filter((q) => q.category === category).reduce((s, q) => s + q.yes, 0);
    const answered = perQuestion.filter((q) => q.category === category).reduce((s, q) => s + q.answered, 0);
    return {
      category,
      positive_rate: yesRate(yes, answered),
      answered,
      questions: rows,
    };
  });

  const ranked = categories.filter((c) => c.positive_rate != null);
  const strongest = ranked.slice().sort((a, b) => b.positive_rate - a.positive_rate)[0] || null;
  const priority = ranked.slice().sort((a, b) => a.positive_rate - b.positive_rate)[0] || null;

  return {
    facilities_surveyed: facilities.size,
    surveys: surveys.length,
    overall_response_rate: yesRate(yesTotal, answeredTotal),
    strongest_category: strongest ? { name: strongest.category, rate: strongest.positive_rate } : null,
    priority_category: priority ? { name: priority.category, rate: priority.positive_rate } : null,
    by_category: categories.map(({ questions, ...rest }) => rest),
    indicators,
  };
}

function buildServicomQuality(cards, surveys) {
  return {
    comment_card: buildCommentCardSection(cards),
    satisfaction: buildSatisfactionSection(surveys),
  };
}

function assetPlain(row) {
  return row?.toJSON ? row.toJSON() : row;
}

function isTagged(asset) {
  return String(asset.nhiaTagNumber || "").trim().length > 0;
}

function isVerified(asset) {
  return VERIFIED_STATUSES.has(String(asset.verificationStatus || "").trim().toLowerCase());
}

function isPoor(asset) {
  return POOR_CONDITIONS.has(String(asset.physicalCondition || "").trim().toLowerCase());
}

function isUnverifiedOrMissing(asset) {
  const status = String(asset.verificationStatus || "").trim().toLowerCase();
  const condition = String(asset.physicalCondition || "").trim().toLowerCase();
  return status === "unverified" || status === "missing" || condition === "missing";
}

function hasNoCustodian(asset) {
  return !String(asset.assignedCustodian || "").trim() && !String(asset.custodian || "").trim();
}

function isInStore(asset) {
  return String(asset.operationalStatus || "").trim().toLowerCase() === "in store";
}

function nextMaintenanceDate(asset) {
  const attrs = asset.categoryAttributes;
  let parsed = attrs;
  if (typeof attrs === "string") {
    try { parsed = JSON.parse(attrs); } catch { parsed = null; }
  }
  const raw = parsed?.nextMaintenanceDate || parsed?.next_maintenance_date;
  return raw ? String(raw).slice(0, 10) : null;
}

function isMaintenanceOverdue(asset, today) {
  const next = nextMaintenanceDate(asset);
  return !!next && next < today;
}

function officeLabel(asset) {
  const site = String(asset.facilitySite || "").trim();
  if (/^hq$/i.test(site)) return "HQ";
  if (asset.zone_name) return asset.zone_name;
  if (asset.state_name) return asset.state_name;
  return site || "Unassigned";
}

function matchPlace(label, places = {}) {
  const key = String(label || "").trim().toLowerCase();
  if (!key || !places.byStateName) return null;
  if (places.byStateName[key]) return places.byStateName[key];
  return Object.values(places.byStateName).find((entry) => {
    const name = String(entry.state || "").trim().toLowerCase();
    return name && (key.includes(name) || name.includes(key));
  }) || null;
}

function placeOf(asset, places = {}) {
  const site = String(asset.facilitySite || "").trim();
  if (/^hq$/i.test(site)) return { zone: "HQ", state: "HQ" };
  const byId = asset.state_id != null ? places.byStateId?.[asset.state_id] : null;
  const found = byId || matchPlace(asset.state_name, places) || matchPlace(site, places);
  if (found) return { zone: asset.zone_name || found.zone, state: found.state };
  if (asset.zone_name) return { zone: asset.zone_name, state: site || asset.zone_name };
  return { zone: site ? "Unassigned" : "Unassigned", state: site || "Unassigned" };
}

function bumpOffice(map, name, asset, zone) {
  if (!map.has(name)) map.set(name, { name, zone: zone || name, total: 0, verified: 0, tagged: 0 });
  const bucket = map.get(name);
  bucket.total += 1;
  if (asset.verified) bucket.verified += 1;
  if (asset.tagged) bucket.tagged += 1;
}

function finishOffices(map) {
  return [...map.values()]
    .map((row) => ({
      ...row,
      rate: row.total ? Math.round((row.verified / row.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (a.name === "HQ") return -1;
      if (b.name === "HQ") return 1;
      return a.name.localeCompare(b.name);
    });
}

function assetInOfficeFilter(asset, office) {
  if (!office || office === "all") return true;
  if (office === "hq") return /^hq$/i.test(String(asset.facilitySite || "").trim());
  return true;
}

function buildAssetRegister(rows, query = {}, places = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const assets = rows.map(assetPlain).filter((asset) => {
    if (!assetInOfficeFilter(asset, query.office)) return false;
    if (query.category && query.category !== "all") {
      const cat = asset.primaryCategory || asset.category || "";
      if (cat !== query.category) return false;
    }
    if (query.status && query.status !== "all" && asset.operationalStatus !== query.status) return false;
    if (query.condition && query.condition !== "all" && asset.physicalCondition !== query.condition) return false;
    const periodDate = asset.lastVerificationDate || asset.created_at || asset.createdAt;
    return matchesPeriod(periodDate, query);
  });

  const flagsFor = (asset) => {
    const flags = [];
    if (isMaintenanceOverdue(asset, today)) flags.push("Maintenance overdue");
    if (isPoor(asset)) flags.push("Poor / defective");
    if (hasNoCustodian(asset)) flags.push("No custodian");
    if (isUnverifiedOrMissing(asset)) flags.push("Unverified / missing");
    return flags;
  };

  const slim = assets.map((asset) => {
    const flags = flagsFor(asset);
    return {
      id: asset.id,
      name: asset.name,
      assetNumber: asset.assetNumber,
      primaryCategory: asset.primaryCategory || asset.category || "Uncategorised",
      physicalCondition: asset.physicalCondition || "—",
      operationalStatus: asset.operationalStatus || "—",
      verificationStatus: asset.verificationStatus || "—",
      facilitySite: asset.facilitySite || "—",
      specificLocation: asset.specificLocation || asset.location || "—",
      assignedCustodian: asset.assignedCustodian || asset.custodian || "—",
      observations: asset.comments || "",
      office: officeLabel(asset),
      tagged: isTagged(asset),
      verified: isVerified(asset),
      flags,
    };
  });

  const byCategory = countMap(slim, (a) => a.primaryCategory);
  const byCondition = countMap(slim, (a) => a.physicalCondition);

  const zoneMap = new Map();
  const stateMap = new Map();
  assets.forEach((asset, index) => {
    const place = placeOf(asset, places);
    const item = slim[index];
    item.office = place.zone;
    bumpOffice(zoneMap, place.zone, item, place.zone);
    bumpOffice(stateMap, place.state, item, place.zone);
  });
  const by_zone = finishOffices(zoneMap);
  const by_state = finishOffices(stateMap);

  const red_flags = slim.filter((a) => a.flags.length).slice(0, 40);

  return {
    total_recorded: slim.length,
    total_verified: slim.filter((a) => a.verified).length,
    tagged: slim.filter((a) => a.tagged).length,
    poor_defective: slim.filter((a) => POOR_CONDITIONS.has(String(a.physicalCondition).toLowerCase())).length,
    unverified_missing: slim.filter((a) => /unverified|missing/i.test(a.verificationStatus) || String(a.physicalCondition).toLowerCase() === "missing").length,
    no_custodian: slim.filter((a) => a.assignedCustodian === "—").length,
    in_store: slim.filter((a) => String(a.operationalStatus).toLowerCase() === "in store").length,
    by_category: byCategory,
    by_condition: byCondition,
    by_zone,
    by_state,
    by_office: by_zone.map((row) => ({ office: row.name, total: row.total, verified: row.verified, tagged: row.tagged })),
    red_flags,
    rows: slim.slice(0, 400),
  };
}

function lineExpenditure(row) {
  return (Number(row.quantitySupplied) || 0) * (Number(row.rate) || 0);
}

function buildPrepaymentRegister(rows, categoryByControl = {}, query = {}) {
  const lines = rows.map(assetPlain).filter((row) => matchesPeriod(row.entryDate, query)).map((row) => {
    const category = String(row.category || categoryByControl[row.controlNumber] || "Uncategorised");
    return {
      id: row.id,
      controlNumber: row.controlNumber,
      item: row.itemDescription || "—",
      category,
      quantitySupplied: Number(row.quantitySupplied) || 0,
      quantityOrdered: Number(row.quantityOrdered) || 0,
      expenditure: lineExpenditure(row),
      entryDate: row.entryDate,
      location: row.state_name || row.zone_name || "—",
      quarter: (() => {
        const parts = dateParts(row.entryDate);
        return parts ? `${parts.year}-Q${parts.quarter}` : null;
      })(),
    };
  });

  const itemQuarters = new Map();
  for (const line of lines) {
    const key = String(line.item).trim().toLowerCase();
    if (!itemQuarters.has(key)) itemQuarters.set(key, new Set());
    if (line.quarter) itemQuarters.get(key).add(line.quarter);
  }
  const recurrentItems = [...itemQuarters.entries()].filter(([, qs]) => qs.size >= 2).map(([name]) => name);

  const withSpend = lines.filter((l) => l.expenditure > 0);
  const highest = withSpend.slice().sort((a, b) => b.expenditure - a.expenditure)[0] || null;
  const lowest = withSpend.slice().sort((a, b) => a.expenditure - b.expenditure)[0] || null;
  const largest = lines.slice().sort((a, b) => b.quantitySupplied - a.quantitySupplied)[0] || null;
  const total = lines.reduce((s, l) => s + l.expenditure, 0);

  const catMap = new Map();
  for (const line of lines) {
    if (!catMap.has(line.category)) catMap.set(line.category, { category: line.category, quantity: 0, expenditure: 0 });
    const bucket = catMap.get(line.category);
    bucket.quantity += line.quantitySupplied;
    bucket.expenditure += line.expenditure;
  }

  const byItem = new Map();
  for (const line of lines) {
    const key = line.item;
    if (!byItem.has(key)) byItem.set(key, { supply: key, expenditure: 0 });
    byItem.get(key).expenditure += line.expenditure;
  }
  const expenditure_by_supply = [...byItem.values()]
    .sort((a, b) => b.expenditure - a.expenditure)
    .slice(0, 8)
    .map((row) => ({
      ...row,
      percent: total ? round1((row.expenditure / total) * 100) : 0,
    }));

  return {
    total_expenditure: round2(total),
    highest: highest ? { item: highest.item, amount: round2(highest.expenditure) } : null,
    lowest: lowest ? { item: lowest.item, amount: round2(lowest.expenditure) } : null,
    recurrent_supply: recurrentItems.length,
    largest_quantity: largest ? { item: largest.item, quantity: largest.quantitySupplied } : null,
    by_category: [...catMap.values()].sort((a, b) => b.quantity - a.quantity),
    expenditure_by_supply,
  };
}

function complaintPlain(row) {
  const c = row?.toJSON ? row.toJSON() : { ...row };
  return c;
}

function buildComplaintRegister(rows, rulesMap = FALLBACK_RULES) {
  const complaints = rows.map(complaintPlain);
  const total = complaints.length;

  const enriched = complaints.map((c) => {
    const rule = getRuleForPriority(rulesMap, c.priority_rating) || FALLBACK_RULES[c.priority_rating];
    const received = c.date_received || c.complaint_date;
    const closed = isComplaintClosed(c);
    const elapsed = workingDaysSinceReceived(received);
    const storedDays = c.resolution_days != null ? Number(c.resolution_days) : null;
    const target = rule?.target_resolution_days ?? null;
    const withinStored = c.resolution_within_sla;
    let within = null;
    if (withinStored === true || withinStored === 1) within = true;
    else if (withinStored === false || withinStored === 0) within = false;
    else if (closed && storedDays != null && target != null) within = storedDays <= target;
    const overdue = !closed && target != null && elapsed > target;
    const days = storedDays != null && Number.isFinite(storedDays) ? storedDays : null;
    return { ...c, _closed: closed, _within: within, _overdue: overdue, _days: days };
  });

  const closed = enriched.filter((c) => c._closed);
  const pending = enriched.filter((c) => !c._closed);
  const slaTracked = enriched.filter((c) => c._within != null);
  const slaMet = slaTracked.filter((c) => c._within);
  const beyond = closed.filter((c) => c._within === false);
  const overdue = enriched.filter((c) => c._overdue);
  const avgDays = mean(enriched.map((c) => c._days).filter((n) => n != null));

  const repeatKey = (c) => {
    const who = String(c.complainant_id || c.complainant_nhis_id || c.complainant_name || "").trim().toLowerCase();
    const what = String(c.facility_id || c.facility_name || c.complaint_category || c.category || "").trim().toLowerCase();
    if (!who) return null;
    return `${who}|${what}`;
  };
  const groups = new Map();
  for (const c of enriched) {
    const key = repeatKey(c);
    if (!key) continue;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  let repeatCount = 0;
  for (const n of groups.values()) {
    if (n > 1) repeatCount += n - 1;
  }

  const stateCodeByName = new Map();
  const zoneCodeByName = new Map();
  for (const c of enriched) {
    const sn = c.state?.description || c.state_name;
    const sc = c.state_code || c.state?.code;
    if (sn && sc) stateCodeByName.set(sn, sc);
    const zn = c.zone?.description || c.zone_name;
    const zc = c.zonal_code || c.zone?.zonal_code;
    if (zn && zc) zoneCodeByName.set(zn, zc);
  }
  const stateCounts = countMap(enriched, (c) => c.state?.description || c.state_name);
  const zoneCounts = countMap(enriched, (c) => c.zone?.description || c.zone_name);
  const namedStates = stateCounts
    .filter((s) => s.name && s.name !== "Not specified")
    .map((s) => ({ ...s, code: stateCodeByName.get(s.name) || null }));
  const namedZones = zoneCounts
    .filter((s) => s.name && s.name !== "Not specified")
    .map((s) => ({ ...s, code: zoneCodeByName.get(s.name) || null }));

  const resolutionDaysBy = (keyFn) => {
    const map = new Map();
    for (const c of enriched) {
      if (c._days == null) continue;
      const key = keyFn(c);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c._days);
    }
    return [...map.entries()]
      .map(([name, days]) => ({ name, days: mean(days), count: days.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  };

  const top = (list) => list[0]?.name || "—";

  return {
    received: total,
    average_resolution: avgDays,
    resolved_within_sla: slaTracked.length ? round1((slaMet.length / slaTracked.length) * 100) : null,
    resolved_within_sla_count: slaMet.length,
    pending: pending.length,
    top_category: top(countMap(enriched, (c) => c.complaint_category || c.category)),
    top_type: top(countMap(enriched, (c) => c.complaint_type)),
    top_route: top(countMap(enriched, (c) => c.transmission_route)),
    overdue_percent: total ? round1((overdue.length / total) * 100) : 0,
    beyond_sla_percent: closed.length ? round1((beyond.length / closed.length) * 100) : null,
    highest_state: namedStates[0] || null,
    lowest_state: namedStates.length ? namedStates[namedStates.length - 1] : null,
    highest_zone: namedZones[0] || null,
    lowest_zone: namedZones.length ? namedZones[namedZones.length - 1] : null,
    repeat_rate: total ? round1((repeatCount / total) * 100) : 0,
    by_domain: countMap(enriched, (c) => c.complaint_domain),
    by_complainant: countMap(enriched, (c) => c.complainant_category),
    by_outcome: countMap(closed, (c) => c.outcome || c.status),
    top_issues: countMap(enriched, (c) => c.complaint_category || c.category).slice(0, 8),
    avg_resolution_by_state: resolutionDaysBy((c) => c.state?.description),
    avg_resolution_by_zone: resolutionDaysBy((c) => c.zone?.description),
    by_state: namedStates.slice(0, 12),
    by_zone: namedZones.slice(0, 12),
    open_by_status: countMap(pending, (c) => c.status),
  };
}

module.exports = {
  matchesPeriod,
  buildServicomQuality,
  buildAssetRegister,
  buildPrepaymentRegister,
  buildComplaintRegister,
};
