/**
 * Seed complaint SLA rules + 20 Servicom demo complaints (varied priorities / overdue states).
 * Idempotent — safe to re-run.
 *
 * Run: npm run db:seed-complaint-sla
 */
require("dotenv").config();
const ComplaintSlaRule = require("../models/ComplaintSlaRule");
const { seedServicomComplaintsSlaDemo } = require("./seedServicomComplaintsSlaDemo");

const RULES = [
  {
    priority: "Top",
    acknowledge_days: 1,
    investigation_commence_days: 1,
    escalate_after_days: 3,
    target_resolution_days: 5,
  },
  {
    priority: "High",
    acknowledge_days: 1,
    investigation_commence_days: 2,
    escalate_after_days: 7,
    target_resolution_days: 10,
  },
  {
    priority: "Medium",
    acknowledge_days: 2,
    investigation_commence_days: 3,
    escalate_after_days: 14,
    target_resolution_days: 20,
  },
];

async function seedComplaintSlaRules() {
  await ComplaintSlaRule.sync();
  for (const rule of RULES) {
    const [row, created] = await ComplaintSlaRule.findOrCreate({
      where: { priority: rule.priority },
      defaults: { ...rule, is_active: true },
    });
    if (!created) {
      await row.update({
        acknowledge_days: rule.acknowledge_days,
        investigation_commence_days: rule.investigation_commence_days,
        escalate_after_days: rule.escalate_after_days,
        target_resolution_days: rule.target_resolution_days,
        is_active: true,
      });
    }
    console.log(`  ${created ? "✅" : "↻"}  ${rule.priority}: ack ${rule.acknowledge_days}d, investigate ${rule.investigation_commence_days}d, escalate ${rule.escalate_after_days}d, resolve ${rule.target_resolution_days}d`);
  }
  console.log("\n✅  Complaint SLA rules seeded");
}

async function main() {
  console.log("\n── Complaint SLA rules ──");
  await seedComplaintSlaRules();

  console.log("\n── Servicom complaints (SLA demo) ──");
  await seedServicomComplaintsSlaDemo();

  console.log("\n✅  db:seed-complaint-sla complete\n");
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedComplaintSlaRules, RULES };
