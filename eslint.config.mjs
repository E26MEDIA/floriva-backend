import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    // Backend files (CommonJS)
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { "varsIgnorePattern": "^[A-Z_]", "argsIgnorePattern": "^_" }],
      "no-console": "off",
      "no-undef": "error",
    },
  },
  {
    // Config files (ESM)
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ["node_modules/", "uploads/", "public/"],
  },
];
