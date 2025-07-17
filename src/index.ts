import fs from "fs";
import noExcessProperties from "./no-excess-properties";

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
          "no-excess-properties/no-excess-properties": "warn",
        },
      };
    },
  },
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules: {
    "no-excess-properties": noExcessProperties,
  },
};

export = plugin;
