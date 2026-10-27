/**
 * Core redesign pieces used during form-by-form rebuild.
 * Does NOT load form_submissions / EAV / facts (those are not the primary store).
 */
const Module = require("./Module");
const Feature = require("./Feature");
const UserPrivilege = require("./UserPrivilege");
const LookupDomain = require("./LookupDomain");
const LookupValue = require("./LookupValue");

Module.hasMany(Feature, { foreignKey: "module_id", as: "features", onDelete: "CASCADE" });
Feature.belongsTo(Module, { foreignKey: "module_id", as: "module" });
Feature.hasMany(UserPrivilege, { foreignKey: "feature_id", as: "privileges", onDelete: "CASCADE" });
UserPrivilege.belongsTo(Feature, { foreignKey: "feature_id", as: "feature" });
LookupDomain.hasMany(LookupValue, { foreignKey: "domain_id", as: "values", onDelete: "CASCADE" });
LookupValue.belongsTo(LookupDomain, { foreignKey: "domain_id", as: "domain" });

module.exports = {
  Module,
  Feature,
  UserPrivilege,
  LookupDomain,
  LookupValue,
};
