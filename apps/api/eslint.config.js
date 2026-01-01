export default [
  {
    ignores: ["dist/**", "node_modules/**", "prisma/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: await import("@typescript-eslint/parser"),
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
];
