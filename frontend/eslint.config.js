// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".astro/**",
      "node_modules/**",
      "coverage/**",
      "src/components/ui/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: { "jsx-a11y": jsxA11y, "react-hooks": reactHooks },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // Islands keep growing hooks; a conditional hook slipped through once
      // (ChordDiagram useId below an early return, #7).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
);
