import { RuleTester } from "@typescript-eslint/rule-tester";
import noExcessProperties from "./no-excess-properties";
import path from "path";
import * as vitest from "vitest";

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
        defaultProject: "tsconfig.json",
      },
      tsconfigRootDir: path.join(__dirname, ".."),
    },
  },
});

ruleTester.run("no-excess-properties", noExcessProperties, {
  valid: [
    `
        let test1: { prop1: number; } = { prop1: 1 };
        const test2 = { prop1: 2 };
        test1 = test2;
    `,
    `
      let test1: () => { prop1: number; } = () => ({ prop1: 1 });
      const test2 = () => ({ prop1: 2 });
      test1 = test2;
    `,
    `
      const test: () => { prop1: number; } = () => ({ prop1: "asdf" })
    `,
    `
      function test(param1: { prop1: number }) {}
      test({ prop1: 1 });
    `,
    `
      function test(param1: () => { prop1: number }) {}
      test(() => ({ prop1: 1 }));
    `,
  ],
  invalid: [
    {
      code: `
        let test1: { prop1: number; } = { prop1: 1 };
        const test2 = { prop1: 2, prop2: 3 };
        test1 = test2;
      `,
      errors: [
        {
          column: 17,
          endColumn: 22,
          endLine: 4,
          line: 4,
          messageId: "noExcessProperties",
        },
      ],
    },
    {
      code: `
        let test1: () => { prop1: number; } = () => ({ prop1: 1 });
        const test2 = () => ({ prop1: 2, prop2: 3 });
        test1 = test2;
      `,
      errors: [
        {
          column: 17,
          endColumn: 22,
          endLine: 4,
          line: 4,
          messageId: "noExcessProperties",
        },
      ],
    },
    {
      code: `
        const test: () => { prop1: number; } = () => ({ prop1: "asdf", prop2: "zxcv" })
      `,
      errors: [
        {
          column: 55,
          endColumn: 87,
          endLine: 2,
          line: 2,
          messageId: "noExcessProperties",
        },
      ],
    },
    {
      code: `
        function test(param1: { prop1: number }) {}
        test({ prop1: 1, prop2: 2 });
      `,
      errors: [
        {
          column: 14,
          endColumn: 36,
          endLine: 3,
          line: 3,
          messageId: "noExcessProperties",
        },
      ],
    },
    {
      code: `
        function test(param1: () => { prop1: number }) {}
        test(() => ({ prop1: 1, prop2: 2 }));
      `,
      errors: [
        {
          column: 14,
          endColumn: 44,
          endLine: 3,
          line: 3,
          messageId: "noExcessProperties",
        },
      ],
    },
  ],
});
