const { Sequelize } = require("sequelize");
require("dotenv").config();

/** Dedicated Citizens' Comment Card database (`nhia_db3`). */
const sequelizeCommentCards = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB3_NAME || "nhia_db3",
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
});

module.exports = sequelizeCommentCards;
