const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PrepaymentAnalysis = sequelize.define("PrepaymentAnalysis", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  controlNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  entryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  procurementInstrument: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contractorName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contractorAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  refInvoiceDeliveryNote: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  itemDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  unitOfMeasure: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  storeLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantityOrdered: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  quantitySupplied: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rate: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.0,
  },
  awardLetterPath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  awardLetterName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  zone_id: { type: DataTypes.INTEGER, allowNull: true },
  state_id: { type: DataTypes.INTEGER, allowNull: true },
  zone_name: { type: DataTypes.STRING, allowNull: true },
  state_name: { type: DataTypes.STRING, allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "prepayment_analyses",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

let columnsReady = false;
async function ensurePrepaymentColumns() {
  if (columnsReady) return;
  const qi = sequelize.getQueryInterface();
  let table;
  try {
    table = await qi.describeTable("prepayment_analyses");
  } catch {
    return;
  }
  const spec = { type: DataTypes.STRING, allowNull: true };
  const align = async (camel, snake) => {
    if (table[snake]) return;
    if (table[camel]) {
      await sequelize.query(
        `ALTER TABLE prepayment_analyses CHANGE \`${camel}\` \`${snake}\` VARCHAR(255) NULL`,
      );
      return;
    }
    await qi.addColumn("prepayment_analyses", snake, spec);
  };
  if (!table.category) await qi.addColumn("prepayment_analyses", "category", spec);
  await align("unitOfMeasure", "unit_of_measure");
  await align("storeLocation", "store_location");
  columnsReady = true;
}

PrepaymentAnalysis.ensurePrepaymentColumns = ensurePrepaymentColumns;

module.exports = PrepaymentAnalysis;
