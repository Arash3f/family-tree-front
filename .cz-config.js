module.exports = {
  types: [
    {
      value: ":sparkles: feat",
      name: "✨ feat:\tAdding a new feature.",
    },
    {
      value: ":wrench: fix",
      name: "🔧 fix:\tFixing a bug.",
    },
    {
      value: ":memo: docs",
      name: "📝 docs:\tAdd or update documentation.",
    },
    {
      value: ":hammer: ref",
      name: "🔨 ref:\tRefactoring code.",
    },
    {
      value: ":fire: perf",
      name: "🔥 perf:\tPerformance improvement.",
    },
    {
      value: ":package: chore",
      name: "📦 chore:\tAdd or update compiled files or packages.",
    },
    {
      value: ":construction: wip",
      name: "🚧 wip:\tWork in progress.",
    },
    {
      value: ":poop: Bcode",
      name: "💩 Bcode:\tWrite bad code that needs to be improved.",
    },
    {
      value: ":bookmark: version",
      name: "🔖 ver:\tNew Release or Version.",
    },
    {
      value: ":rocket: deploy",
      name: "🚀 depl:\tReady to deploy.",
    },
  ],
  scopes: [
    { name: "ui" },
    { name: "auth" },
    { name: "pedigree" },
    { name: "landing" },
    { name: "i18n" },
    { name: "theme" },
    { name: "api" },
    { name: "lib" },
    { name: "config" },
    { name: "docs" },
    { name: "tests" },
    { name: "ci" },
    { name: "deps" },
  ],
  allowCustomScopes: false,
  allowEmptyScopes: true,
  subjectLimit: 100,
};
