"use strict";

const { runUpdateEnvCli } = require("./local-convex-setup");

runUpdateEnvCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
