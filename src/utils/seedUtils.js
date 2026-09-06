const { Op } = require("sequelize");

function logSkip(label) {
  console.log(`⏭️  ${label} — already seeded, skipping`);
}

function logPartial(label, created, skipped) {
  console.log(`✅  ${label} — ${created} created, ${skipped} skipped (already exist)`);
}

/** True when every value in `values` exists for `field` on `Model`. */
async function allExist(Model, field, values) {
  if (!values.length) return true;
  const count = await Model.count({
    where: { [field]: { [Op.in]: values } },
  });
  return count >= values.length;
}

/** True when at least one row matches `where`. */
async function anyExists(Model, where) {
  return (await Model.count({ where })) > 0;
}

module.exports = {
  logSkip,
  logPartial,
  allExist,
  anyExists,
};
