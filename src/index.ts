import fs from "fs";
import objectLiteral from "./object-literal";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8")) as {
  name: string;
  version: string;
};

const plugin = {
  configs: {
    get recommended() {
      return {
        plugins: {
          "no-excess-properties": plugin,
        },
        rules: {
          "no-excess-properties/object-literal": "warn",
        },
      };
    },
  },
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules: {
    "object-literal": objectLiteral,
  },
};

export = plugin;
