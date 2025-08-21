import { RuleTester, TestCaseError } from "@typescript-eslint/rule-tester";
import objectLiteral from "./object-literal";
import path from "path";
import * as vitest from "vitest";

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

function createError(props: {
  line: number;
  column: number;
  endColumn: number;
  endLine?: number;
}): TestCaseError<"noExcessProperties"> {
  return {
    column: props.column,
    endColumn: props.endColumn,
    endLine: props.endLine ?? props.line,
    line: props.line,
    messageId: "noExcessProperties",
  };
}

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

ruleTester.run("object-literal", objectLiteral, {
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
  ],
  invalid: [
    {
      code: `
        let test1: { prop1: number; } = { prop1: 1 };
        const test2 = { prop1: 2, prop2: 3 };
        test1 = test2;
      `,
      errors: [createError({ column: 17, endColumn: 22, line: 4 })],
    },
    {
      code: `
        let test1: () => { prop1: number; } = () => ({ prop1: 1 });
        const test2 = () => ({ prop1: 2, prop2: 3 });
        test1 = test2;
      `,
      errors: [createError({ column: 17, endColumn: 22, line: 4 })],
    },
  ],
});

ruleTester.run("object-literal", objectLiteral, {
  valid: [
    `
      const test: () => { prop1: number; } = () => ({ prop1: 1 })
    `,
    `
      const test1: { prop2: number; } = { prop2: 1 };
      const test2: { prop2: number } = { ...test1 };
    `,
    `
      const test1 = { prop1: 2 };
      const test2: { prop2: { prop3: { prop1: number; } } } = { prop2: { prop3: test1 } };
    `,
  ],
  invalid: [
    {
      code: `
        const test: () => { prop1: number; } = () => ({ prop1: 1, prop2: 2 })
      `,
      errors: [createError({ column: 48, endColumn: 78, line: 2 })],
    },
    {
      code: `
        const test1: { prop1: number; } = { prop1: 1 };
        const test2: { prop2: number } = { ...test1, prop2: 2 };
      `,
      errors: [createError({ column: 42, endColumn: 64, line: 3 })],
    },
    {
      code: `
        const test1 = { prop1: 1, prop4: 2 };
        const test2: { prop2: { prop3: { prop1: number; } } } = { prop2: { prop3: test1 } };
      `,
      errors: [createError({ column: 76, endColumn: 88, line: 3 })],
    },
  ],
});

ruleTester.run("object-literal", objectLiteral, {
  valid: [
    `
      function test(param1: { prop1: number }) {}
      test({ prop1: 1 });
    `,
    `
      function test(param1: () => { prop1: number }) {}
      test(() => ({ prop1: 1 }));
    `,
    `
      function test(param1: number, param2: { prop1: number } | null) {}
      test(1, true ? { prop1: 1 } : null);
    `,
  ],
  invalid: [
    {
      code: `
        function test(param1: { prop1: number }) {}
        test({ prop1: 1, prop2: 2 });
      `,
      errors: [createError({ column: 14, endColumn: 36, line: 3 })],
    },
    {
      code: `
        function test(param1: () => { prop1: number }) {}
        test(() => ({ prop1: 1, prop2: 2 }));
      `,
      errors: [createError({ column: 14, endColumn: 44, line: 3 })],
    },
    {
      code: `
        function test(param1: number, param2: { prop1: number } | null) {}
        test(1, true ? { prop1: 1, prop2: 2 } : null);
      `,
      errors: [createError({ column: 17, endColumn: 53, line: 3 })],
    },
  ],
});

ruleTester.run("object-literal", objectLiteral, {
  valid: [
    `
      const test1 = { prop1: 1 };
      function test(): { prop1: number } { return test1 }
    `,
    `
      const test1 = { prop1: 1 };
      async function test(): Promise<{ prop1: number }> { return test1 }
    `,
  ],
  invalid: [
    {
      code: `
        const test1 = { prop1: 1, prop2: 2 };
        function test(): { prop1: number } { return test1 }
      `,
      errors: [createError({ column: 53, endColumn: 58, line: 3 })],
    },
    {
      code: `
        const test1 = { prop1: 1, prop2: 2 };
        async function test(): Promise<{ prop1: number }> { return test1 }
      `,
      errors: [createError({ column: 68, endColumn: 73, line: 3 })],
    },
  ],
});

ruleTester.run("object-literal", objectLiteral, {
  valid: [
    `
      const test1: { prop1: 1 }[] = [{ prop1: 1 }].map(a => ({ ...a, prop1: 2 }))
    `,
    `
      const test: { prop1: number; }[] = [];
      test.push({ prop1: 1 })
    `,
  ],
  invalid: [
    {
      code: `
        const test1: { prop1: 1 }[] = [{ prop1: 1 }].map(a => ({ ...a, prop2: 2 }))
      `,
      errors: [createError({ column: 39, endColumn: 84, line: 2 })],
    },
    {
      code: `
        const test: { prop1: number; }[] = [];
        test.push({ prop1: 1, prop: 2 })
      `,
      errors: [createError({ column: 19, endColumn: 40, line: 3 })],
    },
  ],
});

ruleTester.run("object-literal", objectLiteral, {
  valid: [
    `
      const test: Record<string, number> & { prop2: 1 } = { prop1: 1 };
    `,
    `
      const test: { prop2: 1 } | Record<string, number> = { prop1: 1 };
    `,
    `
      const test: Record<number, number> & { prop2: 1 } = { 1: 1 };
    `,
    `
      interface Test1 { prop1: number }
      interface Test2 extends Test1 { prop2: number }
      const test1: Test2 = { prop1: 1, prop2: 1 }
      const test2: Test1 = test1
    `,
    `
      Object.keys({ prop1: 1 })
    `,
  ],
  invalid: [],
});
