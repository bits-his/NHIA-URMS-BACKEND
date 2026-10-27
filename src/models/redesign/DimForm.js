const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DimForm = sequelize.define(
  "DimForm",
  {
    form_key: { type: DataTypes.STRING(80), primaryKey: true },
    module_key: { type: DataTypes.STRING(60), allowNull: false },
    label: { type: DataTypes.STRING(150), allowNull: false },
  },
  { tableName: "dim_form", modelName: "DimForm", timestamps: false },
);

module.exports = DimForm;
