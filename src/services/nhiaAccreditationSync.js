const https = require("https");
const { Op } = require("sequelize");
const { NhiaAccreditedProvider } = require("../models");
const { applyStateFilter, applyStateAddressFallback } = require("../utils/nhiaStateFilter");

const UA = "Mozilla/5.0 (compatible; NHIA-URMS/1.0)";
const HCP_TABLE_ID = 1722;
const HCP_NONCE = "c45c2d1cf4";
const HCP_CHUNK_SIZE = 3000;
const UPSERT_BATCH = 500;

/** Supports 2–4 letter state prefixes (e.g. AB, FCT) and optional spaces in codes */
const CODE_RE = /([A-Z]{2,4}\/\d+\/P)/i;

const fetchText = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { "User-Agent": UA } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchText(res.headers.location).then(resolve).catch(reject);
      return;
    }
    let data = "";
    res.on("data", (c) => { data += c; });
    res.on("end", () => resolve(data));
  }).on("error", reject);
});

const fetchJson = async (url) => {
  const text = await fetchText(url);
  return JSON.parse(text);
};

const stripHtml = (html) => html.replace(/<[^>]+>/g, "").trim();

const extractHref = (html) => {
  const m = html.match(/href=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
};

const normalizeProviderCode = (raw) => {
  const compact = String(raw || "").replace(/\s+/g, "").toUpperCase();
  const match = compact.match(CODE_RE);
  return match ? match[1].toUpperCase() : compact.slice(0, 100);
};

const parseHmos = (html) => {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const rows = [];
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const rawCells = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      rawCells.push(cellMatch[1]);
    }
    if (rawCells.length < 5) continue;

    const cells = rawCells.map(stripHtml);
    if (!/^\d+$/.test(cells[0])) continue;

    const websiteRaw = rawCells[3] || "";
    rows.push({
      provider_type: "hmo",
      provider_code: (cells[2] || cells[0]).slice(0, 100),
      name: cells[1].slice(0, 500),
      address: cells[4]?.slice(0, 500) || null,
      email: cells[5]?.slice(0, 255) || null,
      phone: cells[6]?.slice(0, 100) || null,
      website: extractHref(websiteRaw)?.slice(0, 500) || null,
    });
  }
  return rows.filter((r) => r.name && r.provider_code);
};

const normalizeHcp = (v) => {
  const rawCode = (v.healthcareprovidercode || "").trim();
  const rawName = (v.healthcareprovidername || "").trim();
  let code = normalizeProviderCode(rawCode);
  let name = rawName;

  if (!CODE_RE.test(code)) {
    const fromName = normalizeProviderCode(rawName);
    if (CODE_RE.test(fromName)) code = fromName;
    else {
      const embedded = rawName.match(CODE_RE);
      if (embedded) code = embedded[1].toUpperCase();
    }
  }

  if (!name && code) name = code;
  if (name.includes("-") && CODE_RE.test(name)) {
    name = name.replace(/\s*-\s*[A-Z]{2,4}\/\d+\/P\s*$/i, "").trim() || name;
  }

  return {
    provider_type: "hcp",
    provider_code: code.slice(0, 100),
    name: name.slice(0, 500),
    address: (v.address || "").trim().slice(0, 500) || null,
    facility_type: (v.facilitytype || "").trim().slice(0, 100) || null,
  };
};

const isValidHcp = (row) => !!(row.name && row.provider_code && CODE_RE.test(row.provider_code));

const hcpChunkUrl = (chunk) => [
  "https://www.nhia.gov.ng/wp-admin/admin-ajax.php",
  "?action=wp_ajax_ninja_tables_public_action",
  `&table_id=${HCP_TABLE_ID}`,
  "&target_action=get-all-data",
  "&default_sorting=old_first",
  "&skip_rows=0",
  "&limit_rows=0",
  `&ninja_table_public_nonce=${HCP_NONCE}`,
  `&chunk_number=${chunk}`,
].join("");

const fetchHcpChunk = async (chunk) => {
  const data = await fetchJson(hcpChunkUrl(chunk));
  if (!Array.isArray(data) || !data.length) return [];
  return data
    .map((row) => normalizeHcp(row.value || {}))
    .filter(isValidHcp);
};

const fetchAllHcps = async (onProgress) => {
  const hcps = [];
  let chunk = 0;
  while (true) {
    const part = await fetchHcpChunk(chunk);
    if (!part.length) break;
    hcps.push(...part);
    onProgress?.({ stage: "hcp", chunk, chunkRows: part.length, total: hcps.length });
    if (part.length < HCP_CHUNK_SIZE) break;
    chunk += 1;
  }
  return hcps;
};

const upsertBatch = async (rows) => {
  if (!rows.length) return 0;
  await NhiaAccreditedProvider.bulkCreate(rows, {
    updateOnDuplicate: ["name", "address", "email", "phone", "website", "facility_type"],
  });
  return rows.length;
};

const upsertProviders = async (rows, onProgress) => {
  let count = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    count += await upsertBatch(batch);
    onProgress?.({ stage: "upsert", processed: count, total: rows.length });
  }
  return count;
};

const syncFromNhia = async (onProgress) => {
  onProgress?.({ stage: "hmo", message: "Fetching HMO list from nhia.gov.ng/hmo/" });
  const hmoHtml = await fetchText("https://www.nhia.gov.ng/hmo/");
  const hmos = parseHmos(hmoHtml);
  onProgress?.({ stage: "hmo", fetched: hmos.length });

  const hcps = await fetchAllHcps(onProgress);
  onProgress?.({ stage: "hcp", fetched: hcps.length });

  onProgress?.({ stage: "upsert", message: `Saving ${hmos.length} HMO(s)...` });
  const hmoCount = await upsertProviders(hmos, onProgress);

  onProgress?.({ stage: "upsert", message: `Saving ${hcps.length} HCP(s)...` });
  const hcpCount = await upsertProviders(hcps, onProgress);

  const total = await NhiaAccreditedProvider.count();
  const hmoTotal = await NhiaAccreditedProvider.count({ where: { provider_type: "hmo" } });
  const hcpTotal = await NhiaAccreditedProvider.count({ where: { provider_type: "hcp" } });

  return {
    hmoCount,
    hcpCount,
    total: hmoCount + hcpCount,
    dbTotal: total,
    dbHmo: hmoTotal,
    dbHcp: hcpTotal,
  };
};

const ensureSynced = async () => {
  const existing = await NhiaAccreditedProvider.count();
  if (existing > 0) return { skipped: true, existing };
  return syncFromNhia();
};

const searchProviders = async ({ type, q, limit = 50, state_id }) => {
  const where = { provider_type: type };
  const resolved = await applyStateFilter(where, type, state_id);

  const applyTextFilter = (target) => {
    if (!q?.trim()) return;
    const term = `%${q.trim()}%`;
    const textFilter = {
      [Op.or]: [
        { name: { [Op.like]: term } },
        { provider_code: { [Op.like]: term } },
        { address: { [Op.like]: term } },
      ],
    };
    if (target[Op.and]) target[Op.and].push(textFilter);
    else if (target.provider_code || target[Op.or]) {
      const existing = { ...target };
      Object.keys(target).forEach((k) => delete target[k]);
      target[Op.and] = [existing, textFilter];
    } else {
      Object.assign(target, textFilter);
    }
  };

  applyTextFilter(where);

  const queryLimit = Math.min(Number(limit) || 50, 200);
  let rows = await NhiaAccreditedProvider.findAll({
    where,
    order: [["name", "ASC"]],
    limit: queryLimit,
  });

  if (state_id && type === "hcp" && rows.length === 0 && resolved) {
    const fallbackWhere = { provider_type: "hcp" };
    applyStateAddressFallback(fallbackWhere, resolved);
    applyTextFilter(fallbackWhere);
    rows = await NhiaAccreditedProvider.findAll({
      where: fallbackWhere,
      order: [["name", "ASC"]],
      limit: queryLimit,
    });
  }

  return rows;
};

module.exports = {
  syncFromNhia,
  ensureSynced,
  searchProviders,
  parseHmos,
  normalizeHcp,
  isValidHcp,
  CODE_RE,
};
