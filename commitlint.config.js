/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["gitmoji"],
  rules: {
    // Match `.cz-config.js` / `.cz.toml` types (incl. project-specific ones).
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "ref",
        "perf",
        "chore",
        "wip",
        "Bcode",
        "version",
        "deploy",
      ],
    ],
    // `Bcode` is intentionally mixed-case in `.cz-config.js`.
    "type-case": [0],
    "scope-enum": [
      2,
      "always",
      [
        "ui",
        "auth",
        "pedigree",
        "landing",
        "i18n",
        "theme",
        "api",
        "lib",
        "config",
        "docs",
        "tests",
        "ci",
        "deps",
      ],
    ],
    // Scope is optional (matches `.cz.toml` "No scope").
    "scope-empty": [0],
  },
};
