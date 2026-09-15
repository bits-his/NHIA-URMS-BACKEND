const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const EtmcTmcActionPointRegister = require("./EtmcTmcActionPointRegister");

const EtmcTmcActionPointLine = sequelize.define("EtmcTmcActionPointLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  report_id: {
    type: DataTypes.INTEGER.UNSIGNED, allowNull: false,
    references: { model: "etmc_tmc_action_point_registers", key: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  },
  sn: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 1 },
  agenda_item: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
  resolution_id: { type: DataTypes.STRING(20), allowNull: false },
  resolutions: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  action_point_id: { type: DataTypes.STRING(30), allowNull: false },
  action_point: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  timeline: { type: DataTypes.DATEONLY, allowNull: true },
  responsible_dept: { type: DataTypes.STRING(100), allowNull: true },
  supporting_dept: { type: DataTypes.STRING(100), allowNull: true },
  status_update: { type: DataTypes.STRING(200), allowNull: true },
}, { tableName: "etmc_tmc_action_point_lines", modelName: "EtmcTmcActionPointLine" });

EtmcTmcActionPointRegister.hasMany(EtmcTmcActionPointLine, {
  foreignKey: "report_id", as: "lines", onDelete: "CASCADE",
});
EtmcTmcActionPointLine.belongsTo(EtmcTmcActionPointRegister, {
  foreignKey: "report_id", as: "report",
});

module.exports = EtmcTmcActionPointLine;
