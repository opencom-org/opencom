"use strict";

const { anyApi, componentsGeneric } = require("convex/server");

exports.api = anyApi;
exports.internal = anyApi;
exports.components = componentsGeneric();
