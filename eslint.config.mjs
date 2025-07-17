import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPlugin from "eslint-plugin-eslint-plugin";

export default tseslint.config({
  extends: [
    eslint.configs.recommended,
    eslintPlugin.configs["flat/recommended"],
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
  ],
  ignores: ["dist/**", "*.mjs", "vitest.config.ts"],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
