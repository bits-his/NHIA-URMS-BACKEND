const https = require("https");
const { Op } = require("sequelize");
const { NhiaAccreditedProvider } = require("../models");
const { applyStateFilter } = require("../utils/nhiaStateFilter");

const UA = "Mozilla/5.0 (compatible; NHIA-URMS/1.0)";

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

const parseHmos = (html) => {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const rows = [];
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length < 5 || !/^\d+$/.test(cells[0])) continue;
    rows.push({
      provider_type: "hmo",
      provider_code: cells[2] || cells[0],
      name: cells[1],
      address: cells[4]?.slice(0, 500) || null,
    });
  }
  return rows;
};

const CODE_RE = /\b([A-Z]{2}\/\d+\/P)\b/i;

const normalizeHcp = (v) => {
  const rawCode = (v.healthcareprovidercode || "").trim();
  const rawName = (v.healthcareprovidername || "").trim();
  let code = rawCode;
  let name = rawName;

  if (!CODE_RE.test(code)) {
    const fromName = rawName.match(/-\s*([A-Z]{2}\/\d+\/P)\s*$/i);
    if (fromName) code = fromName[1].toUpperCase();
    else if (CODE_RE.test(rawName)) code = rawName.match(CODE_RE)[1].toUpperCase();
  }

  if (!name && code) name = code;
  if (code.length > 80 && name) code = name.match(CODE_RE)?.[1]?.toUpperCase() ?? rawCode.slice(0, 100);

  return {
    provider_type: "hcp",
    provider_code: code.slice(0, 100),
    name: name.slice(0, 500),
    address: (v.address || "").trim().slice(0, 500) || null,
    facility_type: (v.facilitytype || "").trim().slice(0, 100) || null,
  };
};

const fetchHcpChunk = async (chunk) => {
  const url = [
    "https://www.nhia.gov.ng/wp-admin/admin-ajax.php",
    "?action=wp_ajax_ninja_tables_public_action",
    "&table_id=1722",
    "&target_action=get-all-data",
    "&default_sorting=old_first",
    "&skip_rows=0",
    "&limit_rows=0",
    "&ninja_table_public_nonce=c45c2d1cf4",
    `&chunk_number=${chunk}`,
  ].join("");
  const data = await fetchJson(url);
  if (!Array.isArray(data) || !data.length) return [];
  return data.map((row) => normalizeHcp(row.value || {}))
    .filter((r) => r.name && r.provider_code && CODE_RE.test(r.provider_code));
};

const upsertProviders = async (rows) => {
  let count = 0;
  for (const row of rows) {
    const [, created] = await NhiaAccreditedProvider.findOrCreate({
      where: { provider_type: row.provider_type, provider_code: row.provider_code },
      defaults: row,
    });
    if (!created) await NhiaAccreditedProvider.update(row, {
      where: { provider_type: row.provider_type, provider_code: row.provider_code },
    });
    count += 1;
  }
  return count;
};

const syncFromNhia = async () => {
  const hmoHtml = await fetchText("https://www.nhia.gov.ng/hmo/");
  const hmos = parseHmos(hmoHtml);

  const hcps = [];
  for (let chunk = 0; chunk < 10; chunk += 1) {
    const part = await fetchHcpChunk(chunk);
    if (!part.length) break;
    hcps.push(...part);
  }

  const hmoCount = await upsertProviders(hmos);
  const hcpCount = await upsertProviders(hcps);

  return { hmoCount, hcpCount, total: hmoCount + hcpCount };
};

const ensureSynced = async () => {
  const existing = await NhiaAccreditedProvider.count();
  if (existing > 0) return { skipped: true, existing };
  return syncFromNhia();
};

const searchProviders = async ({ type, q, limit = 50, state_id }) => {
  const where = { provider_type: type };
  await applyStateFilter(where, type, state_id);

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    const textFilter = {
      [Op.or]: [
        { name: { [Op.like]: term } },
        { provider_code: { [Op.like]: term } },
        { address: { [Op.like]: term } },
      ],
    };
    if (where[Op.and]) where[Op.and].push(textFilter);
    else if (where.provider_code || where[Op.or]) {
      const existing = { ...where };
      Object.keys(where).forEach((k) => delete where[k]);
      where[Op.and] = [existing, textFilter];
    } else {
      Object.assign(where, textFilter);
    }
  }

  return NhiaAccreditedProvider.findAll({
    where,
    order: [["name", "ASC"]],
    limit: Math.min(Number(limit) || 50, 100),
  });
};

module.exports = { syncFromNhia, ensureSynced, searchProviders };
