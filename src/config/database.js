const { Sequelize } = require("sequelize");
require("dotenv").config();

const useSsl = process.env.DB_SSL === "true" || process.env.DB_SSL === "1";

const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || "nhia_db",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  dialectOptions: useSsl
    ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } }
    : {},
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
});

/** Safe summary for logs — never includes password. */
function connectionSummary() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || "nhia_db",
    user: process.env.DB_USER || "root",
    ssl: useSsl,
  };
}

module.exports = sequelize;
module.exports.connectionSummary = connectionSummary;
