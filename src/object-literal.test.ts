import { RuleTester } from "@typescript-eslint/rule-tester";
import objectLiteral from "./object-literal";
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

ruleTester.run("no-excess-properties", objectLiteral, {
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
      const test: () => { prop1: number; } = () => ({ prop1: 1 })
    `,
    `
      function test(param1: { prop1: number }) {}
      test({ prop1: 1 });
    `,
    `
      function test(param1: () => { prop1: number } | null) {}
      test(() => ({ prop1: 1 }));
    `,
    `
      const test: { param1: number; }[] = [];
      test.push({ param1: 1 })
    `,
    `
      const test1: { prop2: number; } = { prop2: 1 };
      const test2: { prop2: number } = { ...test1 };
    `,
    `
      const test2: Record<string, number> & { prop2: 1 } = { prop1: 1 };
    `,
    `
      Object.keys({ prop1: 1 })
    `,
    `
      interface Test1 { prop1: number }
      interface Test2 extends Test1 { prop2: number }
      const test1: Test2 = { prop2: 1 }
      const test2: Test1 = test1
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
        const test: () => { prop1: number; } = () => ({ prop1: 1, prop2: 2 })
      `,
      errors: [
        {
          column: 48,
          endColumn: 78,
          endLine: 2,
          line: 2,
          messageId: "noExcessProperties",
        },
      ],
    },
    {
      code: `
        function test(param1: { prop1: number } | null) {}
        test(true ? { prop1: 1, prop2: 2 } : null);
      `,
      errors: [
        {
          column: 14,
          endColumn: 50,
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
    {
      code: `
        const test1: { prop1: number; } = { prop1: 1 };
        const test2: { prop2: number } = { ...test1, prop2: 2 };
      `,
      errors: [
        {
          column: 42,
          endColumn: 64,
          endLine: 3,
          line: 3,
          messageId: "noExcessProperties",
        },
      ],
    },
  ],
});
